const express = require("express");
const router = express.Router();

const orderController = require("../controllers/order-controller");
const validateToken = require("../middleware/validate-token-handler");

router.post("/place-order", validateToken, orderController.placeOrder);
router.get('/', validateToken, orderController.getAllOrders);
router.get("/get-order-invoice/:id", orderController.getOrderInvoiceById);
router.get('/:orderId/items', validateToken, orderController.getOrderItemsByOrderId);
router.get("/:orderId", validateToken, orderController.getOrderDetailsById);
router.patch('/:orderId/status', validateToken, orderController.updateOrderStatus);

module.exports = router;