const express = require("express");
const {
  listProducts,
  getProductById,
  createProduct,
  updateProductById,
  deleteProductById,
} = require("../controllers/product-controllers");
const { validateFirebaseIdToken, requireRole } = require("../middleware/validate-token-handler");

const router = express.Router();

router.get("/", listProducts);
router.get("/:id", getProductById);

router.post("/", validateFirebaseIdToken, requireRole("admin"), createProduct);
router.patch("/:id", validateFirebaseIdToken, requireRole("admin"), updateProductById);
router.delete("/:id", validateFirebaseIdToken, requireRole("admin"), deleteProductById);

module.exports = router;
