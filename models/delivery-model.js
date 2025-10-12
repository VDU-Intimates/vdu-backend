const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
    deliveryId: {
        type: String,
        required: true,
        unique: true
    },
    orderId: {
        type: String,
        required: true,
        unique: true,
        ref: 'Order'
    },
    deliverFee: {
        type: Number,
        required: true
    },
    customerName: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    email: {
        type: String,
    }
});

module.exports = mongoose.model('Delivery', deliverySchema);