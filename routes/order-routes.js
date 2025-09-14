const express = require("express");
const router = express.Router();

const orderController = require("../controllers/order-controller");
const validateToken = require("../middleware/validate-token-handler");

router.post("/place-order", validateToken, orderController.placeOrder);
router.get("/get-order-invoice", orderController.getOrderInvoice);

module.exports = router;