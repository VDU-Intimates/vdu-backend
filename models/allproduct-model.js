const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    image: { type: String, trim: true },
    category: { type: String, trim: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    inStock: { type: Boolean, default: true },
    sku: { type: String, trim: true, unique: true, sparse: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Product || mongoose.model("Product", ProductSchema);
