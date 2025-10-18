// routes/cart-routes.js
const express = require("express");
const router = express.Router();
const cartCtrl = require("../controllers/cart-controller");

const validateToken = require("../middleware/validate-token-handler");



router.get("/",validateToken, cartCtrl.getCart);
router.post("/",validateToken, cartCtrl.addToCart);
router.delete("/deleteAll",validateToken, cartCtrl.clearCart);
router.patch("/:itemId",validateToken, cartCtrl.updateCartItem);
router.delete("/:itemId",validateToken, cartCtrl.removeCartItem);

module.exports = router;
