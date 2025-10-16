// models/rating-model.js
const mongoose = require("mongoose");

const RatingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Use your public product id (string) so you can aggregate with your existing productId field
    productId: { type: String, required: true, index: true },
    value: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true }
);

// Enforce one rating per user per product
RatingSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model("Rating", RatingSchema);
