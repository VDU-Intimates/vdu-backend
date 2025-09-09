// models/product-model.js
const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: generateProductId,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    photoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

function generateProductId() {
  const randomDigits = Math.floor(100000 + Math.random() * 900000); 
  const today = new Date();
  const year = today.getFullYear();
  const monthStr = String(today.getMonth() + 1).padStart(2, "0"); 
  const day = String(today.getDate()).padStart(2, "0");
  const datePart = `${year}${monthStr}${day}`;
  return `PROD-${datePart}-${randomDigits}`;
}



module.exports =
  mongoose.models.Product || mongoose.model("Product", ProductSchema);