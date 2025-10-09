const express = require("express");
const { getSelections, addSelections, removeSelection, clearSelections } = require("../controllers/bulk-order-controller");
const validateToken = require("../middleware/validate-token-handler");

const router = express.Router();

router.get("/", validateToken, getSelections);
router.post("/add", validateToken, addSelections);
router.post("/remove", validateToken, removeSelection);
router.delete("/clear", validateToken, clearSelections);

module.exports = router;
