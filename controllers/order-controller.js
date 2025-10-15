// controllers/order-controller.js
const Order = require('../models/order-model');
const OrderItem = require('../models/order-item-model'); // unchanged
const Delivery = require('../models/delivery-model');   // unchanged

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
    paymentType // <-- NEW: 'COD' or 'ONLINE'
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

module.exports = {
  placeOrder,
  getOrderInvoiceById,
};
