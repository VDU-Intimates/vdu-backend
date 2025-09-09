const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true,
        default: generateOrderId()
    },
    userId: {
        type: String,
        required: true,
        unique: true,
        ref: 'User'
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
    quantity: {
        type: Number,
        required: true
    },
    isBulk: {
        type: Boolean,
        required: true,
        default: false
    },
});

function generateOrderId() {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePart = `${year}${month}${day}`;
    return `ORD-${datePart}-${randomDigits}`;
}

orderSchema.pre('save', function (next) {
    if (this.quantity > 500) {
        this.isBulk = true;
    } else {
        this.isBulk = false;
    }
    next();
});

// Pre-save hook to generate a custom orderId
// orderSchema.pre('save', function(next) {
//     const doc = this;

//     // Only generate the ID if it's a new document and the orderId is not already set.
//     if (doc.isNew && !doc.orderId) {
//         // Generate a random 6-digit number
//         const randomDigits = Math.floor(100000 + Math.random() * 900000);

//         // Get the current date in YYYYMMDD format
//         const today = new Date();
//         const year = today.getFullYear();
//         const month = String(today.getMonth() + 1).padStart(2, '0');
//         const day = String(today.getDate()).padStart(2, '0');
//         const datePart = `${year}${month}${day}`;

//         // Create the custom orderId
//         doc.orderId = `ORD-${datePart}-${randomDigits}`;
//     }

//     next();
// });

module.exports = mongoose.model("Order", orderSchema);
