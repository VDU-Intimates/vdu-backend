const mongoose = require('mongoose');
const BulkOrder = require('../models/bulk-order-model');
const Product = require('../models/allproduct-model');

function isMongoId(v) {
  return mongoose.Types.ObjectId.isValid(String(v));
}

// Ensure doc for user
async function ensureForUser(userId) {
  let doc = await BulkOrder.findOne({ userId });
  if (!doc) doc = await BulkOrder.create({ userId, items: [] });
  return doc;
}

// GET /api/selections
// Returns user's selections (populated) with statuses
async function getSelections(req, res) {
  try {
    const userId = req.user.id;
    const doc = await ensureForUser(userId);
    await doc.populate('items.productId');

    // Filter out items whose product has been deleted
    const validItems = doc.items.filter((it) => it.productId !== null);

    // If some items were removed, clean up the DB
    if (validItems.length !== doc.items.length) {
      doc.items = validItems;
      await doc.save();
      console.log(
        `🧹 Cleaned up ${doc.items.length - validItems.length} invalid selections for user ${userId}`
      );
    }

    // Return only valid items to client
    res.json({
      items: validItems.map((it) => ({
        productId: it.productId,
        size: it.size,
        qty: it.qty,
        status: it.status,
        unitPriceSnapshot: it.unitPriceSnapshot,
        productNameSnapshot: it.productNameSnapshot,
      })),
    });
  } catch (err) {
    console.error('getSelections error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}


// POST /api/selections/add
// body: { items: [{ productId: <mongo id OR business productId>, size, qty }] }
async function addSelections(req, res) {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    const sel = await ensureForUser(req.user.id);

    for (const item of items) {
      if (!item?.productId || !item?.size || !item?.qty) continue;

      // Resolve product _id from either _id or business productId
      let productDoc = null;
      if (isMongoId(item.productId)) {
        productDoc = await Product.findById(item.productId).select('_id price productName');
      } else {
        productDoc = await Product.findOne({ productId: String(item.productId) }).select('_id price productName');
      }

      const sizeStr = String(item.size);
      const qtyNum = Number(item.qty);

      if (!productDoc) {
        // push orphan selection (no productId) so user can still see/remove it
        sel.items.push({
          productId: undefined,
          size: sizeStr,
          qty: qtyNum,
          status: 'in_review',
          unitPriceSnapshot: 0,
          productNameSnapshot: '(unavailable)',
        });
        continue;
      }

      const pidStr = String(productDoc._id);

      const existing = sel.items.find(
        (i) => String(i.productId) === pidStr && i.size === sizeStr
      );

      if (existing) {
        existing.qty += qtyNum;
        // If it was previously removed/in_cart/ordered, push back to review on add:
        existing.status = 'in_review';
        existing.unitPriceSnapshot = productDoc.price ?? 0;
        existing.productNameSnapshot = productDoc.productName ?? '';
      } else {
        sel.items.push({
          productId: productDoc._id,
          size: sizeStr,
          qty: qtyNum,
          status: 'in_review',
          unitPriceSnapshot: productDoc.price ?? 0,
          productNameSnapshot: productDoc.productName ?? '',
        });
      }
    }

    await sel.save();
    await sel.populate('items.productId');

    res.status(201).json({
      items: sel.items.map((it) => ({
        productId: it.productId || null,
        size: it.size,
        qty: it.qty,
        status: it.status,
        unitPriceSnapshot: it.unitPriceSnapshot,
        productNameSnapshot: it.productNameSnapshot,
      })),
    });
  } catch (err) {
    console.error('addSelections error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// POST /api/selections/remove
// body: { productId: <mongo id OR null>, size }
async function removeSelection(req, res) {
  try {
    const { productId, size } = req.body || {};
    if (!size) return res.status(400).json({ error: 'size is required' });

    const sel = await ensureForUser(req.user.id);

    if (productId && isMongoId(productId)) {
      sel.items = sel.items.filter(
        (i) => !(String(i.productId) === String(productId) && i.size === size)
      );
    } else {
      // remove orphaned line (no productId stored)
      sel.items = sel.items.filter(
        (i) => !(i.productId == null && i.size === size)
      );
    }

    await sel.save();
    await sel.populate('items.productId');

    res.json({
      items: sel.items.map((it) => ({
        productId: it.productId || null,
        size: it.size,
        qty: it.qty,
        status: it.status,
        unitPriceSnapshot: it.unitPriceSnapshot,
        productNameSnapshot: it.productNameSnapshot,
      })),
    });
  } catch (err) {
    console.error('removeSelection error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// DELETE /api/selections/clear
async function clearSelections(req, res) {
  try {
    const sel = await ensureForUser(req.user.id);
    sel.items = [];
    await sel.save();
    res.json({ items: [] });
  } catch (err) {
    console.error('clearSelections error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

/**
 * NEW: POST /api/selections/to-cart
 * Moves all available `in_review` items to `in_cart` and returns a payload the
 * frontend can use to add them to your normal cart endpoint.
 * 
 * body: { onlyIds?: string[] }  // optional: limit to specific productIds (Mongo _id)
 * resp: { added: [{ productId, size, qty }], skipped: [{ reason, productId?, size? }] }
 */
// controllers/bulk-order-controller.js
async function moveSelectionsToCart(req, res) {
  try {
    const { onlyIds } = req.body || {};
    const doc = await BulkOrder.findOne({ userId: req.user.id });
    if (!doc || !doc.items.length) {
      return res.json({ added: [], skipped: [] });
    }

    const wantIds = Array.isArray(onlyIds) && onlyIds.length
      ? new Set(onlyIds.map(String))
      : null;

    const added = [];
    const skipped = [];

    for (const it of doc.items) {
      const status = it.status || 'in_review'; // default old data

      if (status !== 'in_review') {
        skipped.push({
          reason: 'not_in_review',
          productId: it.productId ? String(it.productId) : null,
          size: it.size,
        });
        continue;
      }

      if (wantIds && (!it.productId || !wantIds.has(String(it.productId)))) {
        continue;
      }

      let prodDoc = null;
      if (it.productId) {
        prodDoc = await Product.findById(it.productId).lean();
      }
      if (!prodDoc) {
        skipped.push({
          reason: 'product_missing',
          productId: it.productId ? String(it.productId) : null,
          size: it.size,
        });
        it.status = 'removed'; // keep this, so orphans don’t persist
        continue;
      }

      // return both ids so the frontend can call your /api/cart with whichever it needs
      added.push({
        mongoId: String(prodDoc._id),
        businessId: prodDoc.productId,
        size: it.size,
        qty: it.qty,
      });

      // NOTE: don't flip status here anymore
      // we will commit after the cart adds succeed
      it.productNameSnapshot = prodDoc.productName;
      it.unitPriceSnapshot = prodDoc.price;
    }

    await doc.save();
    return res.json({ added, skipped });
  } catch (err) {
    console.error('selectionsToCart error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function markInCart(req, res) {
  try {
    const { items } = req.body || {}; // [{ mongoId, size }]
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ ok: true, updated: 0 });
    }
    const doc = await BulkOrder.findOne({ userId: req.user.id });
    if (!doc) return res.json({ ok: true, updated: 0 });

    let updated = 0;
    for (const it of items) {
      const idStr = String(it.mongoId);
      const sizeStr = String(it.size);
      for (const row of doc.items) {
        if (row.productId && String(row.productId) === idStr && row.size === sizeStr) {
          row.status = 'in_cart';
          updated++;
        }
      }
    }
    await doc.save();
    res.json({ ok: true, updated });
  } catch (err) {
    console.error('markInCart error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

/**
 * OPTIONAL: POST /api/selections/mark-ordered
 * Marks current in_cart items as ordered (call when your normal checkout succeeds).
 */
async function markOrdered(req, res) {
  try {
    const sel = await ensureForUser(req.user.id);
    for (const it of sel.items) {
      if (it.status === 'in_cart') it.status = 'ordered';
    }
    await sel.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('markOrdered error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  getSelections,
  addSelections,
  removeSelection,
  clearSelections,
  moveSelectionsToCart,
  markOrdered,
  markInCart
};
