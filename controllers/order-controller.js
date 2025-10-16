const mongoose = require('mongoose');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/order-model');
const OrderItem = require('../models/order-item-model');
const Delivery = require('../models/delivery-model');
const { sendOrderStatusUpdateEmail } = require('../utils/mailer');

function bad(msg, code = 400) {
  const err = new Error(msg || 'Bad Request');
  err.status = code;
  return err;
}

// --- Place Order (used by BOTH COD and ONLINE) ---
const placeOrder = async (req, res) => {
  const userId = req.user?.id; // assume your auth middleware sets this
  if (!userId) return res.status(401).json({ message: 'User is not authorized' });

  const {
    subTotal,
    deliverFee,
    discount = 0,
    totalAmount,
    date,
    items,
    paymentType,
    paymentIntentId
  } = req.body;

  // 1) Validate
  try {
    if (!paymentType || !['COD', 'ONLINE'].includes(paymentType)) {
      throw bad('Invalid or missing paymentType');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw bad('Items array is required and must not be empty');
    }

    for (const it of items) {
      if (!it.productId) throw bad('Each item requires productId');
      if (!it.size) throw bad('Each item requires size');
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) throw bad('Invalid item.quantity');
      if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) throw bad('Invalid item.unitPrice');
    }
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message || 'Invalid request' });
  }

  // 2) Transaction: create Order + OrderItems atomically
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const quantity = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
    const orderDoc = await Order.create([{
      userId,                          // keep as-is (string or ObjectId according to your model)
      paymentType,
      subTotal,
      deliverFee,
      discount,
      totalAmount,
      date: date ? new Date(date) : new Date(),
      quantity,
      isBulk: quantity > 500,
      orderStatus: 'Pending',
    }], { session });

    const savedOrder = orderDoc[0];

    // 3) Insert order items (flatten customization snapshot)
    const orderItems = items.map((it) => ({
      orderId: savedOrder.orderId,
      name: it.name || 'Item',
      productId: it.productId,
      size: it.size, // IMPORTANT for fulfilment and invoice
      customisedProductId: it.customisedProductId || null,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      isCustomized: !!it.isCustomized,
      customPreviewUrl: it.customPreviewUrl || '',
      customImageUrls: Array.isArray(it.customImageUrls) ? it.customImageUrls : [],
      customTexts: Array.isArray(it.customTexts) ? it.customTexts : [],
    }));

    await OrderItem.insertMany(orderItems, { session });

    await session.commitTransaction();

    // 4) Return order + items so Invoice page can render lines immediately
    return res.status(201).json({
      orderId: savedOrder.orderId,
      order: {
        ...savedOrder.toObject(),
        items: orderItems,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Error placing order:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    session.endSession();
  }
};

// --- Invoice getter: returns { order, items, deliveryDetails } ---
const getOrderInvoiceById = async (req, res) => {
  try {
    const { id: orderId } = req.params;

    const order = await Order.findOne({ orderId }).lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const [items, delivery] = await Promise.all([
      OrderItem.find({ orderId }).lean(),
      Delivery.findOne({ orderId }).lean(),
    ]);

    return res.json({
      orderId: order.orderId,
      userId: order.userId,
      date: order.date,
      paymentType: order.paymentType,
      subTotal: order.subTotal,
      discount: order.discount,
      totalAmount: order.totalAmount,
      deliveryFee: order.deliverFee,
      items: items.map((it) => ({
        _id: it._id,
        name: it.name,
        productId: it.productId,
        size: it.size,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        isCustomized: !!it.isCustomized,
        customPreviewUrl: it.customPreviewUrl || '',
        customImageUrls: it.customImageUrls || [],
        customTexts: it.customTexts || [],
      })),
      deliveryDetails: {
        fullName: delivery?.customerName || 'N/A',
        address: delivery?.address || 'N/A',
        phoneNumber: delivery?.phone || 'N/A',
        email: delivery?.email || 'N/A',
      },
    });
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// controllers/order-controller.js

const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.aggregate([
      { $sort: { date: -1 } },
      {
        $lookup: {
          from: 'orderitems',
          localField: 'orderId',
          foreignField: 'orderId',
          as: 'items'
        }
      },
      {
        $addFields: {
          hasCustomizedItems: {
            $anyElementTrue: {
              $map: {
                input: '$items',
                as: 'item',
                in: '$$item.isCustomized'
              }
            }
          }
        }
      },
      {
        $project: {
          orderId: 1,
          totalAmount: 1,
          orderStatus: 1,
          date: 1,
          hasCustomizedItems: 1,
          _id: 0
        }
      }
    ]);

    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ message: 'Server error while fetching orders.' });
  }
};

const getOrderDetailsById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const loggedInUserRole = req.user.role; 

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required.' });
    }

    const aggregationPipeline = [
      { $match: { orderId: orderId } },
      // Join with users and items as before
      { $lookup: { from: 'orderitems', localField: 'orderId', foreignField: 'orderId', as: 'items' } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: 'userId', as: 'userDetails' } },
      
      // --- ADD THIS NEW STAGE ---
      // Join with the 'deliveries' collection to get the delivery name
      { $lookup: { from: 'deliveries', localField: 'orderId', foreignField: 'orderId', as: 'deliveryDetails' } },
      // --- END OF NEW STAGE ---

      // Unwind the results
      { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$deliveryDetails', preserveNullAndEmptyArrays: true } }, // Also unwind deliveryDetails

      { $addFields: { hasItems: { $gt: [{ $size: { $ifNull: ['$items', []] } }, 0] } } },
      
      {
        $project: {
          _id: 0,
          // ... other fields remain the same
          date: '$date',
          orderStatus: '$orderStatus',
          discount: '$discount',
          totalAmount: '$totalAmount',
          // Get the registered user's name (can be used as a fallback)
          fName: '$userDetails.fName',
          lName: '$userDetails.lName',
          // --- ADD THIS LINE ---
          // Explicitly get the customerName from the delivery details
          customerName: '$deliveryDetails.customerName'
        }
      }
    ];

    const results = await Order.aggregate(aggregationPipeline);

    if (results.length === 0) {
      return res.status(404).json({ message: `Order with ID '${orderId}' not found.` });
    }

    const orderDetails = results[0];

    if (loggedInUserRole !== 'Admin') {
        return res.status(403).json({ message: "Forbidden: You do not have permission." });
    }

    res.status(200).json(orderDetails);

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: 'Server error while fetching order details.' });
  }
};

const getOrderItemsByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    const items = await OrderItem.aggregate([
      { $match: { orderId } },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: 'productId',
          as: 'productDetails',
        },
      },
      { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },

      // --- MODIFICATION IS HERE ---
      // We now project all the necessary fields for both regular and custom items.
      {
        $project: {
          _id: 1,
          name: 1,
          quantity: 1,
          unitPrice: 1,
          productId: 1,
          // Customization Fields
          isCustomized: 1,
          customPreviewUrl: 1,
          customImageUrls: 1,
          customTexts: 1,
          // Regular product photo (we get the first one from the array)
          photoUrl: { $ifNull: [{ $arrayElemAt: ['$productDetails.photoUrl', 0] }, null] },
        },
      },
    ]);

    res.status(200).json(items);
  } catch (error) {
    console.error('Error fetching order items:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: "Forbidden: You do not have permission." });
    }

    const { orderId } = req.params;
    const { status: newStatus } = req.body;

    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      return res.status(404).json({ message: `Order with ID '${orderId}' not found.` });
    }

    const currentStatus = order.orderStatus;
    const validTransitions = {
      Pending: ['Accepted', 'Cancelled'],
      Accepted: ['Shipped'],
      Shipped: ['Delivered'],
    };

    if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
      return res.status(400).json({
        message: `Cannot change status from '${currentStatus}' to '${newStatus}'.`,
      });
    }

    if (newStatus === 'Cancelled' && order.paymentType === 'ONLINE' && order.paymentIntentId) {
      await stripe.refunds.create({ payment_intent: order.paymentIntentId });
      console.log(`Stripe refund issued for order ${orderId}`);
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { orderId: orderId },
      { $set: { orderStatus: newStatus } },
      { new: true }
    );

    // --- MODIFICATION START: Fetch email from the correct place ---
    // 2. Find the delivery details associated with this specific order
    const deliveryDetails = await Delivery.findOne({ orderId: order.orderId });

    if (deliveryDetails && deliveryDetails.email) {
      // 3. Use the customerName and email from the delivery document
      await sendOrderStatusUpdateEmail(
        deliveryDetails.email, 
        deliveryDetails.customerName, 
        order.orderId, 
        newStatus
      );
    } else {
      console.warn(`Could not find delivery details or email for order ${orderId}. Email not sent.`);
    }
    // --- END OF MODIFICATION ---

    res.status(200).json(updatedOrder);

  } catch (error) {
    console.error('Error updating order status:', error);
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ message: `Stripe error: ${error.message}` });
    }
    res.status(500).json({ message: 'Server error while updating order status.' });
  }
};

module.exports = {
    placeOrder,
    getOrderInvoiceById,
    getAllOrders,
    getOrderItemsByOrderId,
    getOrderDetailsById,
    updateOrderStatus
};
