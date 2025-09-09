// controllers/product-controller.js
const Product = require("../models/allproduct-model");


// GET /api/products?q=&category=&color=&size=&minPrice=&maxPrice=&sort=&page=&limit=
async function listProducts(req, res) {
  try {
    const {
      q,
      category,
      color,
      size,
      minPrice,
      maxPrice,
      sort = "-createdAt",
      page = "1",
      limit = "20",
    } = req.query;

    const filter = {};

    // text search on name & description
    if (q) {
      const rx = new RegExp(String(q), "i");
      filter.$or = [{ productName: rx }, { description: rx }];
    }

    if (category) filter.category = new RegExp(String(category), "i");
    if (color) filter.color = new RegExp(String(color), "i");
    if (size) filter.size = new RegExp(String(size), "i");

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

// POST /api/products   (admin only)
// body must include required fields from schema
// async function createProduct(req, res) {
//   try {
//     const {
//       productId,          // optional (autogenerate if missing)
//       productName,
//       description,
//       price,
//       photoUrl,
//       color,
//       size,
//       category,
//     } = req.body || {};

//     // validate required fields
//     if (
//       !productName ||
//       !description ||
//       price == null ||
//       !photoUrl ||
//       !color ||
//       !size ||
//       !category
//     ) {
//       return res.status(400).json({ error: "Missing required fields." });
//     }

//     const payload = {
//       productId: productId?.trim(),
//       productName: String(productName).trim(),
//       description: String(description).trim(),
//       price: Number(price),
//       photoUrl: String(photoUrl).trim(),
//       color: String(color).trim(),
//       size: String(size).trim(),
//       category: String(category).trim(),
//     };

//     const doc = await Product.create(payload);
//     res.status(201).json(doc);
//   } catch (err) {
//     console.error("createProduct error:", err);
//     if (err && err.code === 11000) {
//       // duplicate key (likely productId)
//       return res.status(409).json({ error: "productId must be unique" });
//     }
//     res.status(500).json({ error: "Server error" });
//   }
// }

// // PATCH /api/products/:id   (admin only)
// // id can be productId or Mongo _id
// async function updateProductById(req, res) {
//   try {
//     const id = req.params.id;

//     // Only allow these fields to be patched; productId is immutable by default
//     const allowed = [
//       "productName",
//       "description",
//       "price",
//       "photoUrl",
//       "color",
//       "size",
//       "category",
//     ];
//     const patch = {};

//     for (const k of allowed) {
//       if (req.body[k] !== undefined) patch[k] = req.body[k];
//     }

//     // normalize
//     if (patch.productName != null) patch.productName = String(patch.productName).trim();
//     if (patch.description != null) patch.description = String(patch.description).trim();
//     if (patch.price != null) patch.price = Number(patch.price);
//     if (patch.photoUrl != null) patch.photoUrl = String(patch.photoUrl).trim();
//     if (patch.color != null) patch.color = String(patch.color).trim();
//     if (patch.size != null) patch.size = String(patch.size).trim();
//     if (patch.category != null) patch.category = String(patch.category).trim();

//     // find target
//     const byProductId = await Product.findOneAndUpdate(
//       { productId: id },
//       { $set: patch },
//       { new: true, runValidators: true }
//     ).lean();

//     if (byProductId) return res.json(byProductId);

//     // fallback _id
//     let byMongoId = null;
//     try {
//       byMongoId = await Product.findByIdAndUpdate(
//         id,
//         { $set: patch },
//         { new: true, runValidators: true }
//       ).lean();
//     } catch (_) {}

//     if (!byMongoId) return res.status(404).json({ error: "Not found" });
//     res.json(byMongoId);
//   } catch (err) {
//     console.error("updateProductById error:", err);
//     if (err && err.code === 11000) {
//       return res.status(409).json({ error: "Duplicate key" });
//     }
//     res.status(500).json({ error: "Server error" });
//   }
// }

// // DELETE /api/products/:id   (admin only)
// // id can be productId or Mongo _id
// async function deleteProductById(req, res) {
//   try {
//     const id = req.params.id;

//     const byProductId = await Product.findOneAndDelete({ productId: id }).lean();
//     if (byProductId) return res.json({ success: true });

//     let byMongoId = null;
//     try {
//       byMongoId = await Product.findByIdAndDelete(id).lean();
//     } catch (_) {}

//     if (!byMongoId) return res.status(404).json({ error: "Not found" });
//     res.json({ success: true });
//   } catch (err) {
//     console.error("deleteProductById error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// }

module.exports = {
  listProducts,
  getProductById,
  // createProduct,
  // updateProductById,
  // deleteProductById,
};
