// controllers/cart-controller.js
const mongoose = require("mongoose");
const crypto = require("crypto");
const CartItem = require("../models/cart-model");
const Product = require("../models/allproduct-model");

// resolve product by mongo _id or business productId
async function findProductByAnyId(anyId) {
  if (anyId && mongoose.Types.ObjectId.isValid(String(anyId))) {
    const byMongo = await Product.findById(anyId).lean();
    if (byMongo) return byMongo;
  }
  return Product.findOne({ productId: String(anyId) }).lean();
}

function makeCustomKey(custom) {
  if (!custom) return "BASE";
  // saved design has priority
  if (custom.designId) return `DESIGN:${String(custom.designId)}`;
  // ad-hoc custom (no design id) -> stable hash of payload
  const payload = {
    imageUrls: Array.isArray(custom.imageUrls) ? custom.imageUrls : [],
    texts: Array.isArray(custom.texts) ? custom.texts : [],
    color: custom.color || "",
    note: custom.note || "",
  };
  const digest = crypto
    .createHash("sha1")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
  return `HASH:${digest}`;
}

/** GET /api/cart */
exports.getCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const items = await CartItem.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    res.json({
      items,
      subtotal,
      count: items.reduce((sum, it) => sum + it.quantity, 0),
    });
  } catch (err) {
    console.error("getCart error:", err);
    res.status(500).json({ message: "Failed to load cart" });
  }
};

/**
 * POST /api/cart
 * Body:
 *  - Single: { productId, size, quantity, custom? }
 *  - Bulk:   { items: [{ productId, size, quantity?, custom? }, ...] }
 */
exports.addToCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const body = req.body || {};
    const entries = Array.isArray(body.items) ? body.items : [body];

    const results = [];
    for (const raw of entries) {
      if (!raw) continue;
      const { productId, size, quantity = 1, custom } = raw;
      if (!productId || !size) continue;
      const q = Number(quantity) || 1;
      if (q < 1) continue;

      const product = await findProductByAnyId(productId);
      if (!product) continue;
      if (!Array.isArray(product.sizes) || !product.sizes.includes(size)) continue;

      const customKey = makeCustomKey(custom);

      // Upsert by unique identity (no E11000)
      const where = { userId, productId: product.productId, size, customKey };
      const update = {
        $setOnInsert: {
          userId,
          productId: product.productId,
          size,
          productName: product.productName,
          price: product.price,
          photoUrl: Array.isArray(product.photoUrl) ? product.photoUrl[0] : product.photoUrl,
          custom: custom
            ? { ...custom, isCustomized: true }
            : undefined,
          customKey,
        },
        $inc: { quantity: q },
      };

      const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
      const doc = await CartItem.findOneAndUpdate(where, update, opts).lean();
      results.push(doc);
    }

    if (results.length === 0) {
      return res.status(400).json({ message: "No valid items were added" });
    }

    res.status(201).json({
      message: results.length > 1
        ? `${results.length} item(s) added/merged`
        : "Item added/merged",
      items: results,
    });
  } catch (err) {
    // Normalize duplicate key into a friendly message (shouldn't happen with $inc upsert)
    if (err?.code === 11000) {
      return res
        .status(200)
        .json({ message: "Duplicate cart line for this design/size. Quantity already merged." });
    }
    console.error("addToCart error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/** PATCH /api/cart/:itemId (quantity only) */
exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { itemId } = req.params;
    const { quantity } = req.body || {};
    const q = Number(quantity);

    if (!mongoose.Types.ObjectId.isValid(itemId))
      return res.status(400).json({ message: "Invalid item ID" });
    if (!Number.isFinite(q) || q < 1)
      return res.status(400).json({ message: "Quantity must be >= 1" });

    const item = await CartItem.findOneAndUpdate(
      { _id: itemId, userId },
      { $set: { quantity: q } },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: "Cart item not found" });
    res.json({ item, message: "Cart item updated" });
  } catch (err) {
    console.error("updateCartItem error:", err);
    res.status(500).json({ message: "Failed to update cart item" });
  }
};

/** DELETE /api/cart/:itemId */
exports.removeCartItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { itemId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(itemId))
      return res.status(400).json({ message: "Invalid item ID" });

    const deleted = await CartItem.findOneAndDelete({ _id: itemId, userId });
    if (!deleted) return res.status(404).json({ message: "Item not found or unauthorized" });

    res.json({ message: "Item removed", deleted });
  } catch (err) {
    console.error("removeCartItem error:", err);
    res.status(500).json({ message: "Failed to remove item" });
  }
};

/** DELETE /api/cart/deleteAll */
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await CartItem.deleteMany({ userId });
    res.json({ message: "Cart cleared" });
  } catch (err) {
    console.error("clearCart error:", err);
    res.status(500).json({ message: "Failed to clear cart" });
  }
};
