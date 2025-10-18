// models/design-model.js
const mongoose = require("mongoose");

const DesignTextSchema = new mongoose.Schema({
  content: { type: String, required: true, trim: true, maxlength: 2000 },
  fontFamily: { type: String, default: "Raleway" },
  fontSize: { type: Number, default: 16 },
  color: { type: String, default: "#000000" },
  left: { type: Number, default: 0 },
  top: { type: Number, default: 0 },
  angle: { type: Number, default: 0 },
}, { _id: false });

const DesignSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  productName: { type: String, trim: true },
  designUrl: { type: String, required: true },
  imageUrls: { type: [String], default: [] },
  texts: { type: [DesignTextSchema], default: [] },
}, { timestamps: true });

// ✅ indexes to support your query pattern
DesignSchema.index({ userId: 1, createdAt: -1 });
DesignSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Design || mongoose.model("Design", DesignSchema);
