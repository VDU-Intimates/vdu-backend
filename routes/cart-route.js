// routes/cart-routes.js
const express = require("express");
const router = express.Router();
const cartCtrl = require("../controllers/cart-controller");

const validateToken = require("../middleware/validate-token-handler");



router.get("/",validateToken, cartCtrl.getCart);
router.post("/",validateToken, cartCtrl.addToCart);
router.patch("/:itemId",validateToken, cartCtrl.updateCartItem);
router.delete("/:itemId",validateToken, cartCtrl.removeCartItem);
router.delete("/",validateToken, cartCtrl.clearCart);

module.exports = router;
