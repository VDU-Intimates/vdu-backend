const mongoose = require("mongoose");

const BulkOrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    size: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const BulkOrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId,
             ref: "User", 
             required: true, 
             index: true, 
             unique: true },
    items: { type: [BulkOrderItemSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.models.BulkOrder || mongoose.model("BulkOrder", BulkOrderSchema);
