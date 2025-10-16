// routes/rating-route.js
const express = require("express");
const router = express.Router();
const { upsertRating, getProductRatingSummary } = require("../controllers/rating-controller");

// IMPORTANT: use the SAME auth middleware you already use for /api/cart, /api/orders, etc.
const requireAuth = require("../middleware/validate-token-handler"); // <-- adjust path to your project

router.post("/", requireAuth, upsertRating);
router.get("/:productId/summary", getProductRatingSummary);

module.exports = router;
