const express = require('express');
const router = express.Router();
const { createDelivery } = require('../controllers/delivery-controller');

router.post('/create-delivery', createDelivery);

module.exports = router;