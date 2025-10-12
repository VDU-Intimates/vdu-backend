// controllers/bulk-order-controller.js
const mongoose = require('mongoose');
const BulkOrder = require('../models/bulk-order-model');
const Product = require('../models/allproduct-model');

function isMongoId(v) {
  return mongoose.Types.ObjectId.isValid(String(v));
}

// GET /api/selections
async function getSelections(req, res) {
  try {
    const doc = await BulkOrder.findOne({ userId: req.user.id }).populate('items.productId');
    res.json(doc || { items: [] });
  } catch (err) {
    console.error('getSelections error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// POST /api/selections/add
async function addSelections(req, res) {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    // always use Mongo _id from token
    let sel = await BulkOrder.findOne({ userId: req.user.id });
    if (!sel) {
      sel = await BulkOrder.create({ userId: req.user.id, items: [] });
    }

    for (const item of items) {
      if (!item?.productId || !item?.size || !item?.qty) continue;

      // Resolve product _id from either _id or business productId
      let productDoc = null;
      if (isMongoId(item.productId)) {
        productDoc = await Product.findById(item.productId).select('_id');
      } else {
        productDoc = await Product.findOne({ productId: String(item.productId) }).select('_id');
      }
      if (!productDoc) continue;

      const prodIdStr = String(productDoc._id);
      const sizeStr = String(item.size);
      const qtyNum = Number(item.qty);

      const existing = sel.items.find(
        (i) => String(i.productId) === prodIdStr && i.size === sizeStr
      );

      if (existing) {
        existing.qty += qtyNum;
      } else {
        sel.items.push({
          productId: productDoc._id,
          size: sizeStr,
          qty: qtyNum,
        });
      }
    }

    await sel.save();
    await sel.populate('items.productId');
    res.status(201).json(sel);
  } catch (err) {
    console.error('addSelections error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// POST /api/selections/remove
async function removeSelection(req, res) {
  try {
    const { productId, size } = req.body || {};
    if (!productId || !size) {
      return res.status(400).json({ error: 'productId and size are required' });
    }

    const sel = await BulkOrder.findOne({ userId: req.user.id });
    if (!sel) return res.status(404).json({ error: 'Selection not found' });

    // Normalize to Mongo _id
    let prod = null;
    if (isMongoId(productId)) {
      prod = await Product.findById(productId).select('_id');
    } else {
      prod = await Product.findOne({ productId: String(productId) }).select('_id');
    }
    if (!prod) return res.status(404).json({ error: 'Product not found' });

    const pid = String(prod._id);
    const sizeStr = String(size);

    sel.items = sel.items.filter(
      (i) => !(String(i.productId) === pid && i.size === sizeStr)
    );

    await sel.save();
    await sel.populate('items.productId');
    res.json(sel);
  } catch (err) {
    console.error('removeSelection error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// DELETE /api/selections/clear
async function clearSelections(req, res) {
  try {
    const sel = await BulkOrder.findOne({ userId: req.user.id });
    if (!sel) return res.json({ items: [] });

    sel.items = [];
    await sel.save();
    await sel.populate('items.productId');
    res.json(sel);
  } catch (err) {
    console.error('clearSelections error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { getSelections, addSelections, removeSelection, clearSelections };
