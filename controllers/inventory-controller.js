// POST /api/products   (admin only)
// body must include required fields from schema
const Product = require("../models/allproduct-model");

function toStringArray(val) {
  if (Array.isArray(val)) return val.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof val === "string")
    return val.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}



async function listProducts(req, res) {
  try {
    const {
      q, category, color, size,
      minPrice, maxPrice,
      stock,             // optional exact match
      minStock, maxStock,// optional range
      sort = "-createdAt", page = "1", limit = "20"
    } = req.query;

    const filter = {};
    if (q) filter.productName = new RegExp(String(q), "i");
    if (category) filter.category = String(category).trim();
    if (color) filter.colors = { $in: [String(color).trim()] };
    if (size)  filter.sizes  = { $in: [String(size).trim()] };

    if (minPrice != null || maxPrice != null) {
      filter.price = {};
      if (minPrice != null) filter.price.$gte = Number(minPrice);
      if (maxPrice != null) filter.price.$lte = Number(maxPrice);
    }

    // ✅ stock filter (don’t set when undefined)
    if (stock != null && stock !== "") {
      filter.stock = Number(stock);
    } else if (minStock != null || maxStock != null) {
      filter.stock = {};
      if (minStock != null) filter.stock.$gte = Number(minStock);
      if (maxStock != null) filter.stock.$lte = Number(maxStock);
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

    const [docs, total] = await Promise.all([
      Product.find(filter).sort(String(sort))
        .limit(limitNum).skip((pageNum - 1) * limitNum).lean(),
      Product.countDocuments(filter),
    ]);

    res.json({ data: docs, total, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error("listProducts error:", err);
    res.status(500).json({ error: "Server error" });
  }
}






async function createProduct(req, res) {
  try {
    const {
      productId, productName, description, price, photoUrl,
      colors, sizes, category, stock
    } = req.body || {};

    if (!productName || !description || price == null || !photoUrl || !category) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const payload = {
      productId: productId?.trim(),
      productName: String(productName).trim(),
      description: String(description).trim(),
      price: Number(price),
      photoUrl: String(photoUrl).trim(),
      colors: toStringArray(colors),
      sizes:  toStringArray(sizes),
      category: String(category).trim(),

      // ✅ NEW
      stock: Math.max(0, Number(stock ?? 0)),
    };

    if (payload.colors.length === 0 || payload.sizes.length === 0) {
      return res.status(400).json({ error: "sizes and colors must have at least one value" });
    }

    const doc = await Product.create(payload);
    res.status(201).json(doc);
  } catch (err) {
    console.error("createProduct error:", err);
    if (err && err.code === 11000) {
      return res.status(409).json({ error: "productId must be unique" });
    }
    res.status(500).json({ error: "Server error" });
  }
}



async function updateProductById(req, res) {
  try {
    const patch = {};
    const allowed = [
      "productId","productName","description","price",
      "photoUrl","colors","sizes","category",
      "stock" // ✅ NEW
    ];
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];

    if (patch.productName != null) patch.productName = String(patch.productName).trim();
    if (patch.description != null) patch.description = String(patch.description).trim();
    if (patch.price != null) patch.price = Number(patch.price);
    if (patch.photoUrl != null) patch.photoUrl = String(patch.photoUrl).trim();
    if (patch.category != null) patch.category = String(patch.category).trim();
    if ("colors" in patch) patch.colors = toStringArray(patch.colors);
    if ("sizes"  in patch) patch.sizes  = toStringArray(patch.sizes);
    if (patch.stock != null) patch.stock = Math.max(0, Number(patch.stock)); // ✅ NEW

    const doc = await Product.findByIdAndUpdate(
      req.params.id, { $set: patch }, { new: true, runValidators: true }
    ).lean();

    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (err) {
    console.error("updateProductById error:", err);
    if (err && err.code === 11000) {
      return res.status(409).json({ error: "productId must be unique" });
    }
    res.status(500).json({ error: "Server error" });
  }
}

async function deleteProductById(req, res) {
  try {
    const id = req.params.id;

    const byProductId = await Product.findOneAndDelete({ productId: id }).lean();
    if (byProductId) return res.json({ success: true });

    let byMongoId = null;
    try {
      byMongoId = await Product.findByIdAndDelete(id).lean();
    } catch (_) {}

    if (!byMongoId) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("deleteProductById error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
module.exports = {
  listProducts,
  createProduct,
  updateProductById,
  deleteProductById,
};
