const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report-controller");
const validateToken = require("../middleware/validate-token-handler");

// This line must match the function name exported from the controller
router.get('/monthly-orders', validateToken, reportController.generateMonthlyReportCSV);

module.exports = router;