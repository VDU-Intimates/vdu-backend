// models/cart-model.js
const mongoose = require("mongoose");

const CustomTextSchema = new mongoose.Schema(
  {
    content: String,
    fontFamily: String,
    fontSize: Number,
    color: String,
    left: Number,
    top: Number,
    angle: Number,
  },
  { _id: false }
);

const CustomSchema = new mongoose.Schema(
  {
    isCustomized: { type: Boolean, default: false },
    designId: { type: String },          // your saved Design._id (string)
    previewUrl: { type: String },        // composed image for cart
    imageUrls: [{ type: String }],
    texts: [CustomTextSchema],
    color: { type: String },
    note: { type: String },
  },
  { _id: false }
);

const CartItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },

    // Business product id, not _id
    productId: { type: String, required: true, index: true },

    // Variant
    size: { type: String, required: true, trim: true },

    quantity: { type: Number, required: true, min: 1, default: 1 },

    // Snapshot fields
    productName: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    photoUrl: { type: String, required: true, trim: true },

    // NEW: customization payload
    custom: { type: CustomSchema, default: undefined },

    // NEW: uniqueness discriminator ("BASE" | "DESIGN:<id>" | "HASH:<digest>")
    customKey: { type: String, required: true, default: "BASE" },
  },
  { timestamps: true }
);

// NEW unique line identity: user + product + size + customKey
CartItemSchema.index(
  { userId: 1, productId: 1, size: 1, customKey: 1 },
  { unique: true }
);

module.exports = mongoose.models.CartItem || mongoose.model("CartItem", CartItemSchema);
