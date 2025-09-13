const mongoose = require("mongoose");

function generateOrderId() {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;
    return `ORD-${datePart}-${randomDigits}`;
}

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true,
        default: generateOrderId
    },
    userId: {
        type: String,
        required: true,
        ref: 'User'
    },
    subTotal: {
        type: Number,
        required: true
    },
    deliverFee: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        required: true,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    orderStatus: {
        type: String,
        enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
    },
    isBulk: {
        type: Boolean,
        required: true,
        default: false
    },
});

orderSchema.pre('save', function (next) {
    if (this.quantity && this.quantity > 500) {
        this.isBulk = true;
    }
    next();
});

module.exports = mongoose.model("Order", orderSchema);
