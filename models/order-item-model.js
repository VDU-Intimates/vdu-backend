const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        ref: 'Order'
    },
    name: {
        type: String,
        required: true
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

module.exports = mongoose.model("OrderItem", orderItemSchema);

// function generateOrderItemId() {

// }