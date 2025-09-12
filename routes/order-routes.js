const express = require("express");
const router = express.Router();

const orderController = require("../controllers/order-controller");

router.post("/place-order", orderController.placeOrder);
router.get("/get-order-invoice", orderController.getOrderInvoice);

module.exports = router;