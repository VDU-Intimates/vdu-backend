const Order = require('../models/order-model');
const OrderItem = require('../models/order-item-model')

const placeOrder = async (req, res) => {
    const { userId, totalAmount, date, quantity, isBulk } = req.body;

    try {
        const newOrder = new Order({
            userId,
            totalAmount,
            date,
            quantity,
            orderStatus: 'Pending',
            isBulk
        });
        const savedOrder = await newOrder.save();
        res.status(201).json(savedOrder);
    } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).json({ message: "Server error" });
    }
}

const getOrderInvoice = async (req, res) => {
    try {
    // Find all orders
    const orders = await Order.find();

    // Fetch items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const orderItems = await OrderItem.find({ orderId: order.orderId });

        return {
          orderId: order.orderId,
          date: order.date,
          totalAmount: order.totalAmount,
          items: orderItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        };
      })
    );

    res.json(ordersWithItems);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
    placeOrder,
    getOrderInvoice
};
