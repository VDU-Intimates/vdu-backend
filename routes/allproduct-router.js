// routes/product-route.js
const express = require("express");
const {
  listProducts,
  getProductById,
  createProduct,
  updateProductById,
  deleteProductById,
} = require("../controllers/allproduct-controller");



const router = express.Router();

// Public
router.get("/", listProducts);
router.get("/:id", getProductById);



module.exports = router;
