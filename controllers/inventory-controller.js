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
      productId, productName, description, price, stock, photoUrl,
      colors, sizes, category,
    } = req.body || {};

    if (!productName || !description || price == null || !photoUrl || !category) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const payload = {
      productId: productId?.trim(),
      productName: String(productName).trim(),
      description: String(description).trim(),
      price: Number(price),
      // stock: Math.max(0, Number(stock ?? 0)),
      
      photoUrl: String(photoUrl).trim(),
      colors: toStringArray(colors),
      sizes:  toStringArray(sizes),
      category: String(category).trim(),
      stock:stock,
      // ✅ NEW
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
    for (const k of allowed) if (k in req.body)   [k] = req.body[k];

    if (patch.productName != null) patch.productName = String(patch.productName).trim();
    if (patch.description != null) patch.description = String(patch.description).trim();
    if (patch.price != null) patch.price = Number(patch.price);
    if (patch.photoUrl != null) patch.photoUrl = String(patch.photoUrl).trim();
    if (patch.category != null) patch.category = String(patch.category).trim();
    if ("colors" in patch) patch.colors = toStringArray(patch.colors);
    if ("sizes"  in patch) patch.sizes  = toStringArray(patch.sizes);
    // if (patch.stock != null) patch.stock = Math.max(0, Number(patch.stock)); // ✅ NEW
    if(patch.stock != null) patch.stock = patch.stock;

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














// routes/demoSim.js
const express = require('express');
const router = express.Router();

/*
  SAFE demonstration endpoint.
  - Local/staging only.
  - Does NOT execute any DB queries.
  - Returns a JSON object showing:
      - intended: how server *should* treat inputs (safe view)
      - constructedQuery: direct spread of req.body (what insecure code would pass to DB)
*/

function buildQueryFromLogin(body) {
  return {
    intended: {
      email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email,
      // redact password length for privacy
      password: typeof body.password === 'string' ? '[REDACTED_LENGTH:' + String(body.password).length + ']' : body.password,
    },
    constructedQuery: { ...body },
  };
}

router.post('/simulate-login-query', (req, res) => {
  try {
    const demo = buildQueryFromLogin(req.body);

    // Log to console for instructor evidence (local only)
    console.warn('[DEMO-SIM] constructedQuery preview:', {
      time: new Date().toISOString(),
      path: req.originalUrl,
      ip: req.ip,
      constructedQueryPreview: demo.constructedQuery,
    });

    // Return the simulated query object to the caller (safe — no DB ops)
    return res.json({
      message: 'Simulation: server built this query object from your request (no DB interaction).',
      simulated: demo,
    });
  } catch (err) {
    console.error('Demo sim error', err && err.stack ? err.stack : err);
    return res.status(500).json({ message: 'Simulation error.' });
  }
});

module.exports = router;









// controllers/inventory-controller.js  (same file you showed)
// ...existing imports & helpers (Product, toStringArray, etc.)

function buildProductFilter(qs = {}) {
  const {
    q, category, color, size,
    minPrice, maxPrice,
    stock, minStock, maxStock
  } = qs;

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

  if (stock != null && stock !== "") {
    filter.stock = Number(stock);
  } else if (minStock != null || maxStock != null) {
    filter.stock = {};
    if (minStock != null) filter.stock.$gte = Number(minStock);
    if (maxStock != null) filter.stock.$lte = Number(maxStock);
  }

  return filter;
}

// --- New: CSV Export ---
function csvEscape(val) {
  if (val == null) return "";
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportProductsCsv(req, res) {
  try {
    const filter = buildProductFilter(req.query);
    const sort = String(req.query.sort || "-createdAt");

    const docs = await Product.find(filter).sort(sort).lean();

    // columns you want in the report
    const headers = [
      "Product ID", "Product Name", "Category", "Price",
      "Stock", "Colors", "Sizes", "Description", "Created At"
    ];

    const rows = docs.map(p => ([
      p.productId || "",
      p.productName || "",
      p.category || "",
      (p.price ?? "").toString(),
      (p.stock ?? "").toString(),
      Array.isArray(p.colors) ? p.colors.join("|") : "",
      Array.isArray(p.sizes) ? p.sizes.join("|") : "",
      p.description || "",
      p.createdAt ? new Date(p.createdAt).toISOString() : ""
    ]));

    // Build CSV string with BOM for Excel friendliness
    let csv = "\uFEFF" + headers.map(csvEscape).join(",") + "\n";
    for (const r of rows) csv += r.map(csvEscape).join(",") + "\n";

    const dt = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="inventory-${dt}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error("exportProductsCsv error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// export along with your existing functions
module.exports = {
  listProducts,
  createProduct,
  updateProductById,
  deleteProductById,
  exportProductsCsv, // <---
};
