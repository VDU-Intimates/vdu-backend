// controllers/cart-controller.js
const mongoose = require("mongoose");
const CartItem = require("../models/cart-model");
const Product = require("../models/allproduct-model");

// Helper: resolve product by Mongo _id or business productId
async function findProductByAnyId(anyId) {
  // try mongo id first
  if (anyId && mongoose.Types.ObjectId.isValid(String(anyId))) {
    const byMongo = await Product.findById(anyId).lean();
    if (byMongo) return byMongo;
  }
  // then business id
  return Product.findOne({ productId: String(anyId) }).lean();
}

/**
 * GET /api/cart
 */
exports.getCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const items = await CartItem.find({ userId }).sort({ createdAt: -1 }).lean();
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
 * Accepts EITHER:
 *  - { productId, size, quantity }
 *  - { items: [{ productId, size, quantity }] }
 */
exports.addToCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const body = req.body || {};
    const itemsArray = Array.isArray(body.items) ? body.items : [body];

    const createdOrUpdated = [];
    for (const entry of itemsArray) {
      if (!entry) continue;
      const { productId, size, quantity = 1 } = entry;

      if (!productId || !size) continue;
      if (Number(quantity) < 1) continue;

      const product = await findProductByAnyId(productId);
      if (!product) continue;
      if (!Array.isArray(product.sizes) || !product.sizes.includes(size)) continue;

      // Upsert by (userId, product.productId (business id), size)
      const where = { userId, productId: product.productId, size };
      const existing = await CartItem.findOne(where);

      if (existing) {
        existing.quantity += Number(quantity);
        await existing.save();
        createdOrUpdated.push(existing);
      } else {
        const item = await CartItem.create({
          userId,
          productId: product.productId,         // store business id in cart
          size,
          quantity: Number(quantity),
          productName: product.productName,
          price: product.price,
          photoUrl: Array.isArray(product.photoUrl) ? product.photoUrl[0] : product.photoUrl, // main image
        });
        createdOrUpdated.push(item);
      }
    }

    if (createdOrUpdated.length === 0) {
      return res.status(400).json({ message: "No valid items were added" });
    }

    res.status(201).json({
      message: `${createdOrUpdated.length} item(s) added to cart`,
      items: createdOrUpdated,
    });
  } catch (err) {
    console.error("addToCart error:", err);
    res.status(500).json({ message: "Failed to add to cart" });
  }
};

/**
 * PATCH /api/cart/:itemId
 */
exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { itemId } = req.params;
    const { quantity } = req.body || {};

    const item = await CartItem.findOne({ _id: itemId, userId });
    if (!item) return res.status(404).json({ message: "Cart item not found" });

    if (quantity != null) {
      const q = Number(quantity);
      if (!Number.isFinite(q) || q < 1) {
        return res.status(400).json({ message: "Quantity must be >= 1" });
      }
      item.quantity = q;
    }

    await item.save();
    res.json({ item, message: "Cart item updated" });
  } catch (err) {
    console.error("updateCartItem error:", err);
    res.status(500).json({ message: "Failed to update cart item" });
  }
};

/**
 * DELETE /api/cart/:itemId
 */
exports.removeCartItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { itemId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    const deleted = await CartItem.findOneAndDelete({ _id: itemId, userId });
    if (!deleted) {
      return res.status(404).json({ message: "Item not found or unauthorized" });
    }
    res.json({ message: "Item removed", deleted });
  } catch (err) {
    console.error("removeCartItem error:", err);
    res.status(500).json({ message: "Failed to remove item" });
  }
};

/**
 * DELETE /api/cart/deleteAll
 */
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
