// models/cart-model.js
const mongoose = require("mongoose");

const CartItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },

    // We store the product by its public productId (string) and also keep a snapshot.
    productId: {
      type: String, // e.g., "PROD-20250913-123456"
      required: true,
      index: true,
    },

    // Variant
    size: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    // Snapshot fields (visible fields requested)
    productName: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    photoUrl: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// Prevent duplicates of same (user, productId, size)
CartItemSchema.index({ userId: 1, productId: 1, size: 1 }, { unique: true });

module.exports =
  mongoose.models.CartItem || mongoose.model("CartItem", CartItemSchema);
