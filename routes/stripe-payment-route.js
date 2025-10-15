// routes/payment-routes.js
const express = require('express');
const router = express.Router();
const validateToken = require('../middleware/validate-token-handler');
const {
  createCheckoutSession,
  stripeWebhook,
  rawBody,
  confirmCheckoutAndCreateOrder
} = require('../controllers/stripe-payment-controller');

// Create a Checkout Session (user must be logged in)
router.post('/create-checkout-session', validateToken, createCheckoutSession);
router.post('/confirm', validateToken, confirmCheckoutAndCreateOrder);
// Stripe webhook (MUST be before JSON parser) — use raw body
// router.post('/webhook', rawBody, stripeWebhook);

module.exports = router;
