// models/order-item.js
const mongoose = require("mongoose");

const CustomTextSchema = new mongoose.Schema(
  {
    content: { type: String, required: true },
    fontFamily: { type: String, default: "Raleway" },
    fontSize: { type: Number, default: 16 },
    color: { type: String, default: "#000000" },
    left: { type: Number, default: 0 },
    top: { type: Number, default: 0 },
    angle: { type: Number, default: 0 },
  },
  { _id: false }
);

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

  // Keep size on the order item (important for fulfilment)
  size: {
    type: String,
    required: true,
  },

  // If design saved server-side
  customisedProductId: {
    type: String,
    ref: 'Design',
    default: null
  },

  quantity: {
    type: Number,
    required: true
  },
  unitPrice: {
    type: Number,
    required: true
  },

  // Customization snapshot for admin visibility
  isCustomized: { type: Boolean, default: false },
  customPreviewUrl: { type: String, default: "" },
  customImageUrls: { type: [String], default: [] },
  customTexts: { type: [CustomTextSchema], default: [] },
});

module.exports = mongoose.model("OrderItem", orderItemSchema);
