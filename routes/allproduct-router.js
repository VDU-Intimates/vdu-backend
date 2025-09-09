// routes/product-route.js
const express = require("express");
const {
  listProducts,
  getProductById,
  createProduct,
  updateProductById,
  deleteProductById,
} = require("../controllers/allproduct-controller");

// JWT middlewares (no Firebase)
const validateToken = require("../middleware/validate-token-handler");

// Simple role check helper
function requireRole(role) {
  return (req, res, next) => {
    // req.user should be set by validateToken: { id, email, role?, ... }
    const userRole = req.user?.role || "Customer";
    if (userRole !== role) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
}

const router = express.Router();

// Public
router.get("/", listProducts);
router.get("/:id", getProductById);

// // Admin-only
// router.post("/", validateToken, requireRole("Admin"), createProduct);
// router.patch("/:id", validateToken, requireRole("Admin"), updateProductById);
// router.delete("/:id", validateToken, requireRole("Admin"), deleteProductById);

module.exports = router;