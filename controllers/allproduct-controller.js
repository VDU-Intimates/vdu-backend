// controllers/product-controller.js
const mongoose = require("mongoose");
const Product = require("../models/allproduct-model"); // <-- ensure path matches your project
const Rating = require("../models/rating-model");   // <-- add the rating model from previous step

/**
 * Build a Mongo filter from query params
 */
function buildFilter(qs) {
  const { q, category, color, size, minPrice, maxPrice } = qs || {};
  const filter = {};

  if (q) {
    const rx = new RegExp(String(q), "i");
    filter.$or = [{ productName: rx }, { description: rx }];
  }

  if (category) filter.category = String(category).trim();

  if (color) filter.colors = { $in: [String(color).trim()] };
  if (size)  filter.sizes  = { $in: [String(size).trim()] };

  if (minPrice != null || maxPrice != null) {
    filter.price = {};
    if (minPrice != null) filter.price.$gte = Number(minPrice);
    if (maxPrice != null) filter.price.$lte = Number(maxPrice);
  }

  return filter;
}

/**
 * If the user requests sort by avgRating / ratingCount,
 * we need an aggregation pipeline to compute ratings per product.
 */
function isRatingsSort(sort) {
  if (!sort) return false;
  const s = String(sort);
  return s.includes("avgRating") || s.includes("ratingCount");
}

/**
 * GET /api/products
 * Query:
 *  - q, category, color, size, minPrice, maxPrice
 *  - sort (e.g., "-createdAt", "price", "-avgRating", "-ratingCount")
 *  - page, limit
 *  - includeRatings=1 to append avgRating & ratingCount
 */
async function listProducts(req, res) {
  try {
    const {
      sort = "-createdAt",
      page = "1",
      limit = "20",
      includeRatings,
    } = req.query;

    const filter = buildFilter(req.query);
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const wantRatings = String(includeRatings || "") === "1";
    const wantsRatingsSort = isRatingsSort(sort);

    // If sorting by rating fields, use aggregation to compute and sort on the fly
    if (wantRatings && wantsRatingsSort) {
      const sortObj = {};
      // support multi-field sorts like "-avgRating,ratingCount" if passed
      String(sort)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((field) => {
          if (!field) return;
          const dir = field.startsWith("-") ? -1 : 1;
          const key = field.replace(/^-/, "");
          // only allow known sort fields from the outside for safety
          if (["avgRating", "ratingCount", "createdAt", "price"].includes(key)) {
            sortObj[key] = dir;
          }
        });
      if (Object.keys(sortObj).length === 0) sortObj["avgRating"] = -1;

      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "ratings",
            let: { pid: "$productId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$productId", "$$pid"] } } },
              { $group: { _id: null, avgRating: { $avg: "$value" }, ratingCount: { $sum: 1 } } },
              { $project: { _id: 0, avgRating: { $round: ["$avgRating", 2] }, ratingCount: 1 } },
            ],
            as: "ratingSummary",
          },
        },
        {
          $addFields: {
            avgRating: { $ifNull: [{ $arrayElemAt: ["$ratingSummary.avgRating", 0] }, 0] },
            ratingCount: { $ifNull: [{ $arrayElemAt: ["$ratingSummary.ratingCount", 0] }, 0] },
          },
        },
        { $project: { ratingSummary: 0 } },
        { $sort: sortObj },
        { $skip: skip },
        { $limit: limitNum },
      ];

      const [docs, totalAgg] = await Promise.all([
        Product.aggregate(pipeline),
        Product.countDocuments(filter),
      ]);

      return res.json({ data: docs, total: totalAgg, page: pageNum, limit: limitNum });
    }

    // Otherwise: simple find(), then (optionally) attach ratings in one aggregate
    const [docs, total] = await Promise.all([
      Product.find(filter).sort(String(sort)).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(filter),
    ]);

    if (wantRatings && docs.length) {
      const ids = docs.map((p) => String(p.productId));
      const summaries = await Rating.aggregate([
        { $match: { productId: { $in: ids } } },
        { $group: { _id: "$productId", avgRating: { $avg: "$value" }, ratingCount: { $sum: 1 } } },
        { $project: { _id: 0, productId: "$_id", avgRating: { $round: ["$avgRating", 2] }, ratingCount: 1 } },
      ]);
      const map = Object.fromEntries(summaries.map((s) => [s.productId, s]));
      for (const p of docs) {
        p.avgRating = map[p.productId]?.avgRating || 0;
        p.ratingCount = map[p.productId]?.ratingCount || 0;
      }
    }

    res.json({ data: docs, total, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error("listProducts error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

/**
 * Helper: resolve by productId first, then _id fallback
 */
async function findByParamId(id) {
  let doc = await Product.findOne({ productId: id }).lean();
  if (doc) return doc;
  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      doc = await Product.findById(id).lean();
    }
  } catch (_) {}
  return doc;
}

/**
 * GET /api/products/:id
 * Supports ?includeRatings=1 to append { avgRating, ratingCount }
 */
async function getProductById(req, res) {
  try {
    const wantRatings = String(req.query.includeRatings || "") === "1";
    const doc = await findByParamId(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    if (wantRatings) {
      const [summary] = await Rating.aggregate([
        { $match: { productId: String(doc.productId) } },
        { $group: { _id: "$productId", avgRating: { $avg: "$value" }, ratingCount: { $sum: 1 } } },
        { $project: { _id: 0, avgRating: { $round: ["$avgRating", 2] }, ratingCount: 1 } },
      ]);
      doc.avgRating = summary?.avgRating || 0;
      doc.ratingCount = summary?.ratingCount || 0;
    }

    res.json(doc);
  } catch (err) {
    console.error("getProductById error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

/**
 * GET /api/products/top-rated?limit=4
 * Returns top N products by avgRating (desc), ratingCount (desc).
 * If none have ratings, returns latest arrivals instead.
 */
async function getTopRatedProducts(req, res) {
  try {
    const limit = Math.max(1, Math.min(12, Number(req.query.limit) || 4));

    // Compute top-rated from ratings, join products
    const topRated = await Rating.aggregate([
      { $group: { _id: "$productId", avgRating: { $avg: "$value" }, ratingCount: { $sum: 1 } } },
      { $project: { _id: 0, productId: "$_id", avgRating: { $round: ["$avgRating", 2] }, ratingCount: 1 } },
      { $sort: { avgRating: -1, ratingCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "products", // name of Product collection; confirm via Product.collection.name if needed
          localField: "productId",
          foreignField: "productId",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          productId: 1,
          avgRating: 1,
          ratingCount: 1,
          productName: "$product.productName",
          price: "$product.price",
          photoUrl: "$product.photoUrl",
          category: "$product.category",
          sizes: "$product.sizes",
        },
      },
    ]);

    if (topRated.length > 0) return res.json({ data: topRated });

    // Fallback: newest arrivals
    const newest = await Product.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("productId productName price photoUrl category sizes")
      .lean();

    res.json({ data: newest.map((p) => ({ ...p, avgRating: 0, ratingCount: 0 })) });
  } catch (err) {
    console.error("getTopRatedProducts error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  listProducts,
  getProductById,
  getTopRatedProducts,
};
