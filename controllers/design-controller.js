// controllers/design-controller.js
const Design = require("../models/design-model");
const Product = require("../models/allproduct-model"); // optional if you link product

// GET /api/designs?page=&limit=   -> current user's designs
async function listDesigns(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const [data, total] = await Promise.all([
      Design.find({ userId: req.user.id })
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Design.countDocuments({ userId: req.user.id }),
    ]);

    res.json({ data, total, page, limit });
  } catch (err) {
    console.error("listDesigns error:", err);
    res.status(500).json({ error: "Server error" });
  }
}



// POST /api/designs
// body: { designUrl: string, imageUrls: string[], texts: [{content, fontFamily?, fontSize?, color?, left?, top?, angle?}], productId?, productName? }
async function createDesign(req, res) {
  try {
    const { designUrl, imageUrls = [], texts = [], productId, productName } = req.body || {};
    if (!designUrl) return res.status(400).json({ error: "designUrl is required" });

    // (Optional) If productId is business id you can resolve to _id here
    let mongoProductId = undefined;
    if (productId) {
      // Try to accept both _id or business productId string
      const byBusiness = await Product.findOne({ productId: productId }).select("_id").lean().catch(() => null);
      if (byBusiness?._id) mongoProductId = byBusiness._id;
      else mongoProductId = productId; // assume it's already a Mongo _id
    }

    const doc = await Design.create({
      userId: req.user.id, // ALWAYS mongo _id from token
      productId: mongoProductId,
      productName,
      designUrl,
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      texts: Array.isArray(texts) ? texts : [],
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("createDesign error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// DELETE /api/designs/:id
async function deleteDesign(req, res) {
  try {
    const d = await Design.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!d) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteDesign error:", err);
    res.status(500).json({ error: "Server error" });
  }
}



module.exports = {
  listDesigns,
  createDesign,
  deleteDesign,
};
