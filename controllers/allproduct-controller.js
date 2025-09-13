// controllers/product-controller.js
const Product = require("../models/allproduct-model");



// GET /api/products?q=&category=&color=&size=&minPrice=&maxPrice=&sort=&page=&limit=
// async function listProducts(req, res) {
//   try {
//     const {
//       q,
//       category,
//       color,
//       size,
//       minPrice,
//       maxPrice,
//       sort = "-createdAt",
//       page = "1",
//       limit = "20",
//     } = req.query;

//     const filter = {};

//     // text search on name & description
//     if (q) {
//       const rx = new RegExp(String(q), "i");
//       filter.$or = [{ productName: rx }, { description: rx }];
//     }

//     if (category) filter.category = new RegExp(String(category), "i");
//     if (color) filter.color = new RegExp(String(color), "i");
//     if (size) filter.size = new RegExp(String(size), "i");

//     if (minPrice != null || maxPrice != null) {
//       filter.price = {};
//       if (minPrice != null) filter.price.$gte = Number(minPrice);
//       if (maxPrice != null) filter.price.$lte = Number(maxPrice);
//     }

//     const pageNum = Math.max(1, Number(page) || 1);
//     const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

//     const [docs, total] = await Promise.all([
//       Product.find(filter)
//         .sort(String(sort))
//         .limit(limitNum)
//         .skip((pageNum - 1) * limitNum)
//         .lean(),
//       Product.countDocuments(filter),
//     ]);

//     res.json({ data: docs, total, page: pageNum, limit: limitNum });
//   } catch (err) {
//     console.error("listProducts error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// }


async function listProducts(req, res) {
  try {
    const { q, category, color, size, minPrice, maxPrice, sort = "-createdAt", page = "1", limit = "20" } = req.query;

    const filter = {};
    if (q) filter.productName = new RegExp(String(q), "i");
    if (category) filter.category = String(category).trim();

    // match when array contains a value
    if (color) filter.colors = { $in: [String(color).trim()] };
    if (size)  filter.sizes  = { $in: [String(size).trim()] };

    if (minPrice != null || maxPrice != null) {
      filter.price = {};
      if (minPrice != null) filter.price.$gte = Number(minPrice);
      if (maxPrice != null) filter.price.$lte = Number(maxPrice);
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

    const [docs, total] = await Promise.all([
      Product.find(filter)
        .sort(String(sort))
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.json({ data: docs, total, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error("listProducts error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// helper: resolve by productId (preferred) or Mongo _id fallback
async function findByParamId(id) {
  // prefer productId
  let doc = await Product.findOne({ productId: id }).lean();
  if (doc) return doc;

  // fallback to _id if someone passed a Mongo ObjectId
  try {
    doc = await Product.findById(id).lean();
  } catch (_) {
    /* ignore cast errors */
  }
  return doc;
}

// GET /api/products/:id   (id = productId or Mongo _id)
async function getProductById(req, res) {
  try {
    const doc = await findByParamId(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (err) {
    console.error("getProductById error:", err);
    res.status(500).json({ error: "Server error" });
  }
}


module.exports = {
  listProducts,
  getProductById,
};
