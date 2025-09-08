const Product = require("../models/product-model");

async function listProducts(req, res) {
  try {
    const { q, category, minPrice, maxPrice, sort = "-createdAt", page = 1, limit = 20 } = req.query;
    const filter = {};
    if (q) filter.title = new RegExp(q, "i");
    if (category) filter.category = new RegExp(category, "i");
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    const docs = await Product.find(filter)
      .sort(sort)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    const total = await Product.countDocuments(filter);
    res.json({ data: docs, total });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}

async function getProductById(req, res) {
  try {
    const doc = await Product.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

async function createProduct(req, res) {
  try {
    const { title, price, image, category, rating, inStock, sku } = req.body;
    if (!title || price == null) return res.status(400).json({ error: "title and price are required" });
    const doc = await Product.create({ title, price, image, category, rating, inStock, sku });
    res.status(201).json(doc);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

async function updateProductById(req, res) {
  try {
    const allowed = ["title", "price", "image", "category", "rating", "inStock", "sku"];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    const doc = await Product.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true });
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

async function deleteProductById(req, res) {
  try {
    const doc = await Product.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProductById,
  deleteProductById,
};
