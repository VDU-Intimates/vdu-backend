// models/design-model.js
const mongoose = require("mongoose");

const DesignTextSchema = new mongoose.Schema(
  {
    content: { type: String, required: true },   // user typed string
    fontFamily: { type: String, default: "Raleway" },
    fontSize: { type: Number, default: 16 },
    color: { type: String, default: "#000000" },
    left: { type: Number, default: 0 },          // optional placement metadata
    top: { type: Number, default: 0 },
    angle: { type: Number, default: 0 },
  },
  { _id: false }
);

const DesignSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false, // optional; set true if you always tie a design to a product
    },
    productName: { type: String, trim: true },   // optional display help

    // Main render of the design (e.g., canvas.toDataURL())
    designUrl: { type: String, required: true },

    // Raw images the user added (can be data URLs for now; consider S3 later)
    imageUrls: {
      type: [String],
      default: [],
      validate: v => Array.isArray(v),
    },

    // Texts the user added (keep minimal but structured)
    texts: {
      type: [DesignTextSchema],
      default: [],
      validate: v => Array.isArray(v),
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Design || mongoose.model("Design", DesignSchema);
