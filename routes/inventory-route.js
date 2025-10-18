// routes/product-route.js
const express = require("express");
const {
  listProducts,
  createProduct,
  updateProductById,
  deleteProductById,
  exportProductsCsv
} = require("../controllers/inventory-controller");

const validateToken = require("../middleware/validate-token-handler");

// simple role guard
function requireRole(role) {
  return (req, _res, next) => {
    const userRole = req.user?.role || "Customer";
    if (userRole !== role) return next({ status: 403, message: "Forbidden: insufficient role" });
    next();
  };
}

const router = express.Router();

// Public list
router.get("/", listProducts);

// (Optional) get one by :id (works with Mongo _id or productId)
// router.get("/:id", getProductById);

// Admin-only mutations
router.post("/", validateToken, requireRole("Admin"), createProduct);
router.patch("/:id", validateToken, requireRole("Admin"), updateProductById);
router.delete("/:id", validateToken, requireRole("Admin"), deleteProductById);

// --- New: CSV report ---
router.get("/report", exportProductsCsv); // you can protect with validateToken if needed

module.exports = router;

