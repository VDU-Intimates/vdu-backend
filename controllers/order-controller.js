const Order = require('../models/order-model');
const OrderItem = require('../models/order-item-model');

const placeOrder = async (req, res) => {
    // Get userId from JWT token (set by auth middleware)
    const userId = req.user?.id;
    if (!userId) {
        console.log("req.user:", req.user); // Debug log
        return res.status(401).json({ message: "User is not authorized" });
    }
    
    console.log("Authenticated user ID:", userId); // Success log
    
    const { subTotal, deliverFee, discount, totalAmount,
             date, quantity, isBulk, items } = req.body;

    try {
        const newOrder = new Order({
            userId,
            subTotal,
            deliverFee,
            discount,
            totalAmount,
            date,
            orderStatus: 'Pending',
            isBulk: isBulk || (quantity > 500)
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
}

const getOrderInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    // Find order by ID
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Fetch items linked to that order
    const orderItems = await OrderItem.find({ orderId: order._id });

    const orderWithItems = {
      orderId: order.orderId,
      _id: order._id,
      userId: order.userId,
      date: order.date,
      subTotal: order.subTotal,
      discount: order.discount,
      totalAmount: order.totalAmount,
      deliveryFee: order.deliveryFee,
      items: orderItems.map((item) => ({
        _id: item._id,
        name: item.name,
        productId: item.productId,
        customisedProductId: item.customisedProductId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    };

    res.json(orderWithItems);
  } catch (error) {
    console.error("Error fetching order by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
};
module.exports = {
    placeOrder,
    getOrderInvoiceById
};
