// controllers/order-controller.js
const Order = require('../models/order-model');
const User = require('../models/user-model');
const OrderItem = require('../models/order-item-model');
const Delivery = require('../models/delivery-model');

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
    paymentType
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
    
    // --- MODIFICATION START ---
    // Get the role of the logged-in user from the JWT token.
    // Your validateToken middleware must add the role to the req.user object.
    const loggedInUserRole = req.user.role; 
    // --- MODIFICATION END ---

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required.' });
    }

    // The aggregation pipeline remains the same
    const aggregationPipeline = [
      { $match: { orderId: orderId } },
      { $lookup: { from: 'orderitems', localField: 'orderId', foreignField: 'orderId', as: 'items' } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: 'userId', as: 'userDetails' } },
      { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } },
      { $addFields: { hasItems: { $gt: [{ $size: '$items' }, 0] } } },
      {
        $project: {
          _id: 0,
          productId: { $cond: { if: '$hasItems', then: { $arrayElemAt: ['$items.productId', 0] }, else: null } },
          productName: { $cond: { if: '$hasItems', then: { $arrayElemAt: ['$items.name', 0] }, else: 'N/A' } },
          price: { $cond: { if: '$hasItems', then: { $arrayElemAt: ['$items.unitPrice', 0] }, else: '$totalAmount' } },
          quantity: { $cond: { if: '$hasItems', then: { $arrayElemAt: ['$items.quantity', 0] }, else: 0 } },
          userId: '$userId',
          fName: '$userDetails.fName',
          lName: '$userDetails.lName',
          date: '$date',
          orderStatus: '$orderStatus',
          isBulk: '$isBulk'
        }
      }
    ];

    const results = await Order.aggregate(aggregationPipeline);

    if (results.length === 0) {
      return res.status(404).json({ message: `Order with ID '${orderId}' not found.` });
    }

    const orderDetails = results[0];

    // --- AUTHORIZATION CHECK MODIFIED ---
    // Now, we verify that the user making the request has the 'Admin' role.
    if (loggedInUserRole !== 'Admin') {
        return res.status(403).json({ message: "Forbidden: You do not have permission to view this resource." });
    }
    // --- END AUTHORIZATION CHECK ---

    res.status(200).json(orderDetails);

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: 'Server error while fetching order details.' });
  }
};

const getOrderItemsByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Use an aggregation pipeline to join OrderItems with Products
    const items = await OrderItem.aggregate([
      // Stage 1: Find all items for the given orderId
      { $match: { orderId: orderId } },
      
      // Stage 2: Join with the 'products' collection
      {
        $lookup: {
          from: 'products', // The name of your products collection in MongoDB
          localField: 'productId',
          foreignField: 'productId',
          as: 'productDetails'
        }
      },
      
      // Stage 3: Deconstruct the productDetails array to get a single object
      {
        $unwind: {
          path: '$productDetails',
          preserveNullAndEmptyArrays: true // Keep the item even if its product was deleted
        }
      },

      // Stage 4: Project only the fields we need for the frontend
      {
        $project: {
          _id: 1,
          name: 1,
          quantity: 1,
          unitPrice: 1,
          productId: 1,
          // Get photoUrl from the joined product, provide a default if null
          photoUrl: { $ifNull: ['$productDetails.photoUrl', ''] }
        }
      }
    ]);

    if (!items || items.length === 0) {
      return res.status(404).json({ message: "No items found for this order." });
    }

    res.status(200).json(items);

  } catch (error) {
    console.error('Error fetching order items:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    // 1. Check if the user is an admin (from JWT middleware)
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: "Forbidden: You do not have permission to perform this action." });
    }

    const { orderId } = req.params;
    const { status } = req.body;

    // 2. Validate the incoming status
    if (!status || !['Accepted', 'Cancelled'].includes(status)) {
      return res.status(400).json({ message: "Invalid status provided. Must be 'Accepted' or 'Cancelled'." });
    }

    // 3. Find the order and update its status
    // { new: true } ensures the updated document is returned
    const updatedOrder = await Order.findOneAndUpdate(
      { orderId: orderId },
      { orderStatus: status },
      { new: true }
    );

    // 4. Handle case where the order is not found
    if (!updatedOrder) {
      return res.status(404).json({ message: `Order with ID '${orderId}' not found.` });
    }

    // 5. Send the updated order as a confirmation
    res.status(200).json(updatedOrder);

  } catch (error) {
    console.error('Error updating order status:', error);
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
