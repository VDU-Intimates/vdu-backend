const Order = require('../models/order-model');

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

module.exports = {
    placeOrder
};
