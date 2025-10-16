// controllers/order-controller.js
const mongoose = require('mongoose');
const Order = require('../models/order-model');

// ⚠️ Make sure this path matches your actual filename.
// If your model file is "models/order-item.js", use that path.
const OrderItem = require('../models/order-item-model'); 
const Delivery = require('../models/delivery-model'); // unchanged

function bad(msg, code = 400) {
  const err = new Error(msg || 'Bad Request');
  err.status = code;
  return err;
}

// --- Place Order (used by BOTH COD and ONLINE) ---
const placeOrder = async (req, res) => {
  const userId = req.user?.id; // assume your auth middleware sets this
  if (!userId) return res.status(401).json({ message: 'User is not authorized' });

  const {
    subTotal,
    deliverFee,
    discount = 0,
    totalAmount,
    date,
    items,
    paymentType, // 'COD' | 'ONLINE'
  } = req.body || {};

  // 1) Validate
  try {
    if (!paymentType || !['COD', 'ONLINE'].includes(paymentType)) {
      throw bad('Invalid or missing paymentType');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw bad('Items array is required and must not be empty');
    }

    for (const it of items) {
      if (!it.productId) throw bad('Each item requires productId');
      if (!it.size) throw bad('Each item requires size');
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) throw bad('Invalid item.quantity');
      if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) throw bad('Invalid item.unitPrice');
    }
  } catch (e) {
    return res.status(e.status || 400).json({ message: e.message || 'Invalid request' });
  }

  // 2) Transaction: create Order + OrderItems atomically
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const quantity = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
    const orderDoc = await Order.create([{
      userId,                          // keep as-is (string or ObjectId according to your model)
      paymentType,
      subTotal,
      deliverFee,
      discount,
      totalAmount,
      date: date ? new Date(date) : new Date(),
      quantity,
      isBulk: quantity > 500,
      orderStatus: 'Pending',
    }], { session });

    const savedOrder = orderDoc[0];

    // 3) Insert order items (flatten customization snapshot)
    const orderItems = items.map((it) => ({
      orderId: savedOrder.orderId,
      name: it.name || 'Item',
      productId: it.productId,
      size: it.size, // IMPORTANT for fulfilment and invoice
      customisedProductId: it.customisedProductId || null,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      isCustomized: !!it.isCustomized,
      customPreviewUrl: it.customPreviewUrl || '',
      customImageUrls: Array.isArray(it.customImageUrls) ? it.customImageUrls : [],
      customTexts: Array.isArray(it.customTexts) ? it.customTexts : [],
    }));

    await OrderItem.insertMany(orderItems, { session });

    await session.commitTransaction();

    // 4) Return order + items so Invoice page can render lines immediately
    return res.status(201).json({
      orderId: savedOrder.orderId,
      order: {
        ...savedOrder.toObject(),
        items: orderItems,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Error placing order:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    session.endSession();
  }
};

// --- Invoice getter: returns { order, items, deliveryDetails } ---
const getOrderInvoiceById = async (req, res) => {
  try {
    const { id: orderId } = req.params;

    const order = await Order.findOne({ orderId }).lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const [items, delivery] = await Promise.all([
      OrderItem.find({ orderId }).lean(),
      Delivery.findOne({ orderId }).lean(),
    ]);

    return res.json({
      orderId: order.orderId,
      userId: order.userId,
      date: order.date,
      paymentType: order.paymentType,
      subTotal: order.subTotal,
      discount: order.discount,
      totalAmount: order.totalAmount,
      deliveryFee: order.deliverFee,
      items: items.map((it) => ({
        _id: it._id,
        name: it.name,
        productId: it.productId,
        size: it.size,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        isCustomized: !!it.isCustomized,
        customPreviewUrl: it.customPreviewUrl || '',
        customImageUrls: it.customImageUrls || [],
        customTexts: it.customTexts || [],
      })),
      deliveryDetails: {
        fullName: delivery?.customerName || 'N/A',
        address: delivery?.address || 'N/A',
        phoneNumber: delivery?.phone || 'N/A',
        email: delivery?.email || 'N/A',
      },
    });
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  placeOrder,
  getOrderInvoiceById,
};
