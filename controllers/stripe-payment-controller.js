// controllers/payments-controller.js
const Stripe = require('stripe');
const CartItem = require('../models/cart-model');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// ---------- helpers ----------
const isShortHttpUrl = (u) => {
  try {
    if (!u || typeof u !== 'string') return false;
    if (u.length > 1900) return false;
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

function buildLineItems(items, currency) {
  return items.map((it, idx) => {
    const name = it.name || `Item ${idx + 1}`;
    const priceNum = typeof it.price === 'number' ? it.price : Number(it.price);
    const unit_amount = Math.round((Number.isFinite(priceNum) ? priceNum : 0) * 100);
    if (!Number.isInteger(unit_amount) || unit_amount <= 0) {
      throw new Error(`Invalid unit_amount for "${name}". raw=${it.price}`);
    }
    const quantity = Number.isInteger(it.quantity) && it.quantity > 0 ? it.quantity : 1;

    const product_data = { name, metadata: { productId: String(it.productId || '') } };
    if (isShortHttpUrl(it.image)) product_data.images = [it.image];

    return {
      quantity,
      price_data: {
        currency,
        unit_amount,
        product_data,
      },
    };
  });
}

// ---------- create checkout session ----------
/**
 * POST /api/payments/create-checkout-session
 * body: {
 *   items: [{ productId, name, price, quantity, image }],
 *   deliveryInfo: {...},
 *   totals?: { subTotal, discountAmount, deliveryFee, total }
 * }
 */
async function createCheckoutSession(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { items = [], deliveryInfo = {}, totals } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    // Choose a currency you’ve enabled in Stripe (use 'usd' for test if LKR isn’t enabled)
    const currency = (process.env.CHECKOUT_CURRENCY || 'usd').toLowerCase();

    // Compute totals (fallback if FE didn’t send)
    let subTotal = 0;
    for (const it of items) {
      const p = typeof it.price === 'number' ? it.price : Number(it.price);
      const q = Number.isFinite(it.quantity) ? Number(it.quantity) : 1;
      subTotal += (Number.isFinite(p) ? p : 0) * q;
    }
    const discountPercent = 20;       // keep in sync with FE
    const discountAmount = Math.round((subTotal * discountPercent) / 100);
    const deliveryFee = 300;
    const total = subTotal - discountAmount + deliveryFee;

    const agg = totals || { subTotal, discountAmount, deliveryFee, total };

    // Stripe needs discounts as coupons (cannot add negative items).
    // Create a one-time percentage coupon (duration: once).
    const coupon = await stripe.coupons.create({
      percent_off: discountPercent,
      duration: 'once',
      name: 'Cart Discount',
    });

    // Create a shipping rate on-the-fly for the fixed delivery fee.
    const shippingRate = await stripe.shippingRates.create({
      display_name: 'Delivery',
      fixed_amount: { amount: Math.round(agg.deliveryFee * 100), currency },
      type: 'fixed_amount',
    });

    // Build line items for products
    const line_items = buildLineItems(items, currency);

    // Metadata (strings only)
    const metadata = {
      userId: String(userId),
      fullName: String(deliveryInfo.fullName || ''),
      address: String(deliveryInfo.address || ''),
      phoneNumber: String(deliveryInfo.phoneNumber || ''),
      email: String(deliveryInfo.email || ''),
      subTotal: String(agg.subTotal),
      discountAmount: String(agg.discountAmount),
      deliveryFee: String(agg.deliveryFee),
      totalAmount: String(agg.total),
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      client_reference_id: String(userId),
      line_items,
      // This makes Stripe show the delivery fee and apply the 20% discount:
      discounts: [{ coupon: coupon.id }],
      shipping_options: [{ shipping_rate: shippingRate.id }],
      // Redirect back to your cart page to finish order creation in FE:
      success_url: `${process.env.FRONTEND_URL}/cart?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cart?payment=cancelled`,
      metadata,
    });

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('createCheckoutSession error:', err);
    res.status(400).json({ error: err.message || 'Failed to create checkout session' });
  }
}

// ---------- confirm (verify payment) ----------
/**
 * POST /api/payments/confirm
 * body: { sessionId }
 * Returns { paid, items, totals } so the FE can call your existing place-order API.
 */
// confirmCheckoutAndCreateOrder.js (controller)

async function confirmCheckoutAndCreateOrder(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer_details']
    });

    if (String(session.client_reference_id) !== String(userId)) {
      return res.status(403).json({ error: 'Session does not belong to this user' });
    }
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // 1) Snapshot the cart (already in rupees/major units)
    const cart = await CartItem.find({ userId }).lean();
    const items = cart.map(it => ({
      name: it.productName,
      productId: it.productId,
      size: it.size,
      customisedProductId: it.custom?.designId || null,
      quantity: it.quantity,
      unitPrice: Number(it.price),           // keep as-is (major units)

      // customization snapshot for admin
      isCustomized: !!it.custom?.isCustomized,
      customPreviewUrl: it.custom?.previewUrl || '',
      customImageUrls: Array.isArray(it.custom?.imageUrls) ? it.custom.imageUrls : [],
      customTexts: Array.isArray(it.custom?.texts) ? it.custom.texts : [],
    }));

    // 2) Totals from Stripe session (always in MINOR units → divide by 100)
    const totals = {
      subTotal: (session.amount_subtotal || 0) / 100,
      discountAmount: (session.total_details?.amount_discount || 0) / 100,
      deliveryFee: (session.total_details?.amount_shipping || 0) / 100,
      totalAmount: (session.amount_total || 0) / 100,
    };

    // 3) Delivery info (prefer session fields, fallback to metadata)
    const md = session.metadata || {};
    const cd = session.customer_details || {};
    const deliveryInfo = {
      fullName: md.fullName || cd.name || '',
      address: md.address || '',
      phoneNumber: md.phoneNumber || cd.phone || '',
      email: md.email || cd.email || '',
    };

    // FE will call /orders/place-order next with { items, totals, deliveryInfo }
    return res.json({ items, totals, deliveryInfo });
  } catch (err) {
    console.error('confirmCheckout error:', err);
    return res.status(500).json({ error: 'Failed to confirm checkout' });
  }
}


module.exports = {
  createCheckoutSession,
  confirmCheckoutAndCreateOrder,
};
