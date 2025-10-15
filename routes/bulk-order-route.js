const express = require("express");
const { getSelections, addSelections, removeSelection, clearSelections,moveSelectionsToCart,markOrdered,markInCart } = require("../controllers/bulk-order-controller");
const validateToken = require("../middleware/validate-token-handler");

const router = express.Router();

router.get("/", validateToken, getSelections);
router.post("/add", validateToken, addSelections);
router.post("/remove", validateToken, removeSelection);
router.delete("/clear", validateToken, clearSelections);

router.post("/to-cart", validateToken, moveSelectionsToCart);
router.post("/mark-ordered", validateToken, markOrdered);
router.post("/mark-in-cart", validateToken, markInCart);

module.exports = router;
