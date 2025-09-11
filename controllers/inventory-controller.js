// POST /api/products   (admin only)
// body must include required fields from schema
async function createProduct(req, res) {
  try {
    const {
      productId,          // optional (autogenerate if missing)
      productName,
      description,
      price,
      photoUrl,
      color,
      size,
      category,
    } = req.body || {};

    // validate required fields
    if (
      !productName ||
      !description ||
      price == null ||
      !photoUrl ||
      !color ||
      !size ||
      !category
    ) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const payload = {
      productId: productId?.trim(),
      productName: String(productName).trim(),
      description: String(description).trim(),
      price: Number(price),
      photoUrl: String(photoUrl).trim(),
      color: String(color).trim(),
      size: String(size).trim(),
      category: String(category).trim(),
    };

    const doc = await Product.create(payload);
    res.status(201).json(doc);
  } catch (err) {
    console.error("createProduct error:", err);
    if (err && err.code === 11000) {
      // duplicate key (likely productId)
      return res.status(409).json({ error: "productId must be unique" });
    }
    res.status(500).json({ error: "Server error" });
  }
}

// PATCH /api/products/:id   (admin only)
// id can be productId or Mongo _id
async function updateProductById(req, res) {
  try {
    const id = req.params.id;

    // Only allow these fields to be patched; productId is immutable by default
    const allowed = [
      "productName",
      "description",
      "price",
      "photoUrl",
      "color",
      "size",
      "category",
    ];
    const patch = {};

    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }

    // normalize
    if (patch.productName != null) patch.productName = String(patch.productName).trim();
    if (patch.description != null) patch.description = String(patch.description).trim();
    if (patch.price != null) patch.price = Number(patch.price);
    if (patch.photoUrl != null) patch.photoUrl = String(patch.photoUrl).trim();
    if (patch.color != null) patch.color = String(patch.color).trim();
    if (patch.size != null) patch.size = String(patch.size).trim();
    if (patch.category != null) patch.category = String(patch.category).trim();

    // find target
    const byProductId = await Product.findOneAndUpdate(
      { productId: id },
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();

    if (byProductId) return res.json(byProductId);

    // fallback _id
    let byMongoId = null;
    try {
      byMongoId = await Product.findByIdAndUpdate(
        id,
        { $set: patch },
        { new: true, runValidators: true }
      ).lean();
    } catch (_) {}

    if (!byMongoId) return res.status(404).json({ error: "Not found" });
    res.json(byMongoId);
  } catch (err) {
    console.error("updateProductById error:", err);
    if (err && err.code === 11000) {
      return res.status(409).json({ error: "Duplicate key" });
    }
    res.status(500).json({ error: "Server error" });
  }
}

// DELETE /api/products/:id   (admin only)
// id can be productId or Mongo _id
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
  createProduct,
  updateProductById,
  deleteProductById,
};
