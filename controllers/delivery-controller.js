const Delivery = require('../models/delivery-model');

const generateDeliveryId = () => {
  return 'DLV-' + Date.now();
};

const createDelivery = async (req, res) => {
    try {
    const { orderId, deliverFee, customerName, address, phone, email } = req.body;

    if (!orderId || !deliverFee || !customerName || !address || !phone) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const delivery = new Delivery({
      deliveryId: generateDeliveryId(),
      orderId,
      deliverFee,
      customerName,
      address,
      phone,
      email
    });

    await delivery.save();

    res.status(201).json({ message: 'Delivery created', delivery });
  } catch (error) {
    console.error('Error creating delivery:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

module.exports = { 
    createDelivery,
}