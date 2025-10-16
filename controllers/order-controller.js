const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/order-model');
const OrderItem = require('../models/order-item-model');
const Delivery = require('../models/delivery-model');
const { sendOrderStatusUpdateEmail } = require('../utils/mailer');

// --- Place Order (used by BOTH COD and Online after Stripe success) ---
const placeOrder = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "User is not authorized" });

  const {
    subTotal,
    deliverFee,
    discount,
    totalAmount,
    date,
    quantity,
    isBulk,
    items,
    paymentType,
    paymentIntentId
  } = req.body;

  try {
    if (!paymentType || !['COD', 'ONLINE'].includes(paymentType)) {
      return res.status(400).json({ message: "Invalid or missing paymentType" });
    }

    const newOrder = new Order({
      userId,
      subTotal,
      deliverFee,
      discount,
      totalAmount,
      date,
      orderStatus: 'Pending',
      isBulk: isBulk || (quantity > 500),
      paymentType, // <-- persist it
      paymentIntentId: paymentType === 'ONLINE' ? paymentIntentId : null,
    });

    const savedOrder = await newOrder.save();

    if (Array.isArray(items) && items.length > 0) {
      const orderItems = items.map(item => ({
        orderId: savedOrder.orderId,
        name: item.name,
        productId: item.productId,
        customisedProductId: item.customisedProductId || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }));
      await OrderItem.insertMany(orderItems);
    }

    res.status(201).json(savedOrder);
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Invoice getter (now also returns paymentType) ---
const getOrderInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({ orderId: id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const delivery = await Delivery.findOne({ orderId: id });
    
    const orderItems = await OrderItem.find({ orderId: order.orderId });

    const orderWithItems = {
      orderId: order.orderId,
      userId: order.userId,
      date: order.date,
      paymentType: order.paymentType, // <-- expose it
      subTotal: order.subTotal,
      discount: order.discount,
      totalAmount: order.totalAmount,
      deliveryFee: order.deliverFee,
      items: orderItems.map((item) => ({
        _id: item._id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      deliveryDetails: {
        fullName: delivery ? delivery.customerName : 'N/A',
        address: delivery ? delivery.address : 'N/A',
        phoneNumber: delivery ? delivery.phone : 'N/A',
        email: delivery ? delivery.email : 'N/A',
      },
    };

    res.json(orderWithItems);
  } catch (error) {
    console.error("Error fetching order by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getAllOrders = async (req, res) => {
  try {
    // Fetch all orders and sort them by the most recent date
    // We only select the fields needed for the order list page for efficiency
    const orders = await Order.find({})
      .select('orderId totalAmount orderStatus date')
      .sort({ date: -1 });

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
      { $match: { orderId: orderId } },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: 'productId',
          as: 'productDetails'
        }
      },
      { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: 1,
          quantity: 1,
          unitPrice: 1,
          productId: 1,
          // --- FIX IS HERE ---
          // Return null instead of an empty string if the photoUrl is missing.
          photoUrl: { $ifNull: ['$productDetails.photoUrl', null] }
        }
      }
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
