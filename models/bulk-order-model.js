const mongoose = require('mongoose');

const SelectionItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: false, // may be missing if product was deleted later
    },
    size: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },

    // NEW: track lifecycle
    status: {
      type: String,
      enum: ['in_review', 'in_cart', 'ordered', 'removed'],
      default: 'in_review',
      index: true,
    },

    // Optional snapshots (useful if product later disappears/changes)
    unitPriceSnapshot: { type: Number, default: 0 },
    productNameSnapshot: { type: String, default: '' },
  },
  { _id: false }
);

const BulkOrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, unique: true },
    items: { type: [SelectionItemSchema], default: [] },
  },
  { timestamps: true }
);

// Keep 1 row per user
// BulkOrderSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('BulkOrder', BulkOrderSchema);
