// models/allproduct-model.js
const mongoose = require("mongoose");

function generateProductId() {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  const today = new Date();
  const year = today.getFullYear();
  const monthStr = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const datePart = `${year}${monthStr}${day}`;
  return `PROD-${datePart}-${randomDigits}`;
}

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
      trim: true 
    },
    description: { 
      type: String, 
      required: true, 
      trim: true 
    },
    price: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    photoUrl: { 
      type: [String], 
      required: true, 
      trim: true 
    },
    colors: {
      type: [String],
      required: true,
      validate: (v) => Array.isArray(v) && v.length > 0,
    },
    sizes: {
      type: [String],
      required: true,
      validate: (v) => Array.isArray(v) && v.length > 0,
    },
    category: { 
      type: String, 
      enum: ["T-Shirt", "Intimate"], 
      required: true, 
      trim: true 
    },
    stock: { 
      type: Number, 
      required: true, 
      min: 0, 
      default: 0 
    },
    // NEW: denormalized rating fields so every product "has a rating"
    avgRating: { 
      type: Number, 
      required: true, 
      default: 0 
    },      // 0.00 – 5.00
    ratingCount: { 
      type: Number, 
      required: true, 
      default: 0 
    },    // number of ratings
  },
  { timestamps: true }
);

module.exports = mongoose.models.Product || mongoose.model("Product", ProductSchema);
