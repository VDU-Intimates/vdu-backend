// controllers/cart-controller.js
const mongoose = require("mongoose"); // ADD THIS LINE
const CartItem = require("../models/cart-model");
const Product = require("../models/allproduct-model");

/**
 * GET /api/cart
 * Returns all items for current user with the fields you need visible.
 */
exports.getCart = async (req, res) => {
  try {
    const userId = req.user?.id; // set by auth middleware from JWT
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const items = await CartItem.find({ userId }).sort({ createdAt: -1 }).lean();

    const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

    res.json({
      items, // each item contains: productId, productName, price, photoUrl, size, quantity
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
 * body: { productId, size, quantity? }
 * Adds (or increments) a cart line. Validates size against product.sizes.
 */
exports.addToCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { productId, size, quantity = 1 } = req.body || {};
    if (!productId || !size) {
      return res.status(400).json({ message: "productId and size are required" });
    }
    if (quantity < 1) {
      return res.status(400).json({ message: "quantity must be >= 1" });
    }

    // Find product by public productId
    const product = await Product.findOne({ productId }).lean();
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Validate requested size exists on product
    if (!product.sizes.includes(size)) {
      return res.status(400).json({ message: "Invalid size for this product" });
    }

    // Upsert: if same (user, productId, size) exists, just bump quantity
    const existing = await CartItem.findOne({ userId, productId, size });

    if (existing) {
      existing.quantity += quantity;
      await existing.save();
      return res.status(200).json({ item: existing, message: "Cart updated" });
    }

    // Create new line with snapshot fields
    const item = await CartItem.create({
      userId,
      productId,
      size,
      quantity,
      productName: product.productName,
      price: product.price,
      photoUrl: product.photoUrl,
    });

    res.status(201).json({ item, message: "Added to cart" });
  } catch (err) {
    // Handle unique index race (duplicate key) gracefully
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Item already in cart (same size)" });
    }
    console.error("addToCart error:", err);
    res.status(500).json({ message: "Failed to add to cart" });
  }
};

/**
 * PATCH /api/cart/:itemId
 * body: { quantity?, size? }  (size change re-validates against product)
 */
exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { itemId } = req.params;
    const { quantity, size } = req.body || {};

    const item = await CartItem.findOne({ _id: itemId, userId });
    if (!item) return res.status(404).json({ message: "Cart item not found" });

    // Update quantity
    if (quantity != null) {
      const q = Number(quantity);
      if (Number.isNaN(q) || q < 1) {
        return res.status(400).json({ message: "quantity must be >= 1" });
      }
      item.quantity = q;
    }

    // Update size (must validate against product)
    if (size != null && size !== item.size) {
      const product = await Product.findOne({ productId: item.productId }).lean();
      if (!product) return res.status(404).json({ message: "Product not found" });
      if (!product.sizes.includes(size)) {
        return res.status(400).json({ message: "Invalid size for this product" });
      }

      // If changing size results in duplicate (same user+prod+size), merge quantities
      const duplicate = await CartItem.findOne({
        userId,
        productId: item.productId,
        size,
        _id: { $ne: item._id },
      });

      if (duplicate) {
        duplicate.quantity += item.quantity;
        await duplicate.save();
        await item.deleteOne();
        return res.json({ item: duplicate, message: "Size updated and merged" });
      }

      item.size = size;
    }

    await item.save();
    res.json({ item, message: "Cart item updated" });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Item already exists with that size" });
    }
    console.error("updateCartItem error:", err);
    res.status(500).json({ message: "Failed to update cart item" });
  }
};

/**
 * DELETE /api/cart (with body)
 * Removes one cart line by cartItemId in body.
 */
/**
 * DELETE /api/cart/:itemId
 * Removes one cart line by itemId in URL params.
 */
exports.removeCartItem = async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log("🔍 User ID:", userId);
    
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { itemId } = req.params; // Changed from req.body to req.params
    console.log("🔍 Cart Item ID to delete:", itemId);
    
    // Validate itemId
    if (!itemId) {
      return res.status(400).json({ message: "Cart item ID is required" });
    }

    // Validate if itemId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid cart item ID format" });
    }

    // Check all cart items BEFORE deletion
    const allItemsBefore = await CartItem.find({ userId });
    console.log("🔍 Total cart items BEFORE delete:", allItemsBefore.length);
    console.log("🔍 Items BEFORE:", allItemsBefore.map(i => ({ id: i._id.toString(), name: i.productName })));

    // Delete ONE specific cart item by its MongoDB _id and userId
    const deletedItem = await CartItem.findOneAndDelete({ 
      _id: itemId, // No need for new mongoose.Types.ObjectId(), Mongoose handles it
      userId 
    });

    console.log("🔍 Deleted item:", deletedItem ? { id: deletedItem._id.toString(), name: deletedItem.productName } : "NONE");

    // Check all cart items AFTER deletion
    const allItemsAfter = await CartItem.find({ userId });
    console.log("🔍 Total cart items AFTER delete:", allItemsAfter.length);
    console.log("🔍 Items AFTER:", allItemsAfter.map(i => ({ id: i._id.toString(), name: i.productName })));

    if (!deletedItem) {
      return res.status(404).json({ message: "Cart item not found or doesn't belong to you" });
    }
    
    res.json({ 
      message: "Cart item removed successfully", 
      removedItem: deletedItem 
    });
  } catch (err) {
    console.error("❌ removeCartItem error:", err);
    res.status(500).json({ 
      message: "Failed to remove cart item",
      error: err.message
    });
  }
};


/**
 * DELETE /api/cart
 * Clears the whole cart for the user.
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