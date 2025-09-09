const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    orderItemId: {
        type: String,
        required: true,
        unique: true,
        // default: generateOrderItemId()
    },
    orderId: {
        type: String,
        required: true,
        ref: 'Order'
    },
    productId: {
        type: String,
        required: true,
        ref: 'Product'
    },
    customisedProductId: {
        type: String,
        ref: 'CustomisedProduct'
    },
    quantity: {
        type: Number,
        required: true
    },
    unitPrice: {
        type: Number,
        required: true
    }
})

// function generateOrderItemId() {

// }