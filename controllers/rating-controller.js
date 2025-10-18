// controllers/rating-controller.js
const Rating = require("../models/rating-model");
const Product = require("../models/allproduct-model");

/** POST /api/ratings  body: { productId, value: 1..5 } */
exports.upsertRating = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { productId, value } = req.body || {};
    const v = Number(value);
    if (!productId || !Number.isFinite(v) || v < 1 || v > 5) {
      return res.status(400).json({ message: "productId and 1-5 value required" });
    }

    // Ensure product exists
    const product = await Product.findOne({ productId: String(productId) }).lean();
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Upsert rating
    const doc = await Rating.findOneAndUpdate(
      { userId, productId: String(productId) },
      { $set: { value: v } },
      { new: true, upsert: true }
    );

    // Aggregate new summary
    const [summary] = await Rating.aggregate([
      { $match: { productId: String(productId) } },
      { $group: { _id: "$productId", avgRating: { $avg: "$value" }, ratingCount: { $sum: 1 } } },
      { $project: { _id: 0, productId: "$_id", avgRating: { $round: ["$avgRating", 2] }, ratingCount: 1 } },
    ]);

    // Update denormalized fields on Product for fast reads
    await Product.updateOne(
      { productId: String(productId) },
      {
        $set: {
          avgRating: summary?.avgRating ?? 0,
          ratingCount: summary?.ratingCount ?? 0,
        },
      }
    );

    res.json({ rating: doc, summary: summary || { productId, avgRating: 0, ratingCount: 0 } });
  } catch (err) {
    console.error("upsertRating error:", err);
    if (err?.code === 11000) return res.status(409).json({ message: "Duplicate rating" });
    res.status(500).json({ message: "Failed to save rating" });
  }
};

/** GET /api/ratings/:productId/summary */
exports.getProductRatingSummary = async (req, res) => {
  try {
    const { productId } = req.params;
    const [summary] = await Rating.aggregate([
      { $match: { productId: String(productId) } },
      { $group: { _id: "$productId", avgRating: { $avg: "$value" }, ratingCount: { $sum: 1 } } },
      { $project: { _id: 0, productId: "$_id", avgRating: { $round: ["$avgRating", 2] }, ratingCount: 1 } },
    ]);
    res.json(summary || { productId, avgRating: 0, ratingCount: 0 });
  } catch (err) {
    console.error("getProductRatingSummary error:", err);
    res.status(500).json({ message: "Failed to load rating summary" });
  }
};

/** (Optional) GET /api/products/top-rated?limit=4 */
exports.getTopRatedProducts = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(12, Number(req.query.limit) || 4));

    // prefer denormalized fields on Product for speed
    const docs = await Product.find({})
      .sort({ avgRating: -1, ratingCount: -1 })
      .limit(limit)
      .select("productId productName price photoUrl category sizes avgRating ratingCount")
      .lean();

    if (docs.length) return res.json({ data: docs });

    // fallback to newest
    const newest = await Product.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("productId productName price photoUrl category sizes avgRating ratingCount")
      .lean();

    res.json({ data: newest });
  } catch (err) {
    console.error("getTopRatedProducts error:", err);
    res.status(500).json({ message: "Failed to load top rated products" });
  }
};
