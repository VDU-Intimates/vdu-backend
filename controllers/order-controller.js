const Order = require('../models/order-model');
const OrderItem = require('../models/order-item-model');
const Delivery = require('../models/delivery-model');

const placeOrder = async (req, res) => {
    // Get userId from JWT token (set by auth middleware)
    const userId = req.user?.id;
    if (!userId) {
        console.log("req.user:", req.user); // Debug log
        return res.status(401).json({ message: "User is not authorized" });
    }
    
    console.log("Authenticated user ID:", userId); // Success log
    
    const { subTotal, deliverFee, discount, totalAmount,
             date, quantity, isBulk, items } = req.body;

    try {
        const newOrder = new Order({
            userId,
            subTotal,
            deliverFee,
            discount,
            totalAmount,
            date,
            orderStatus: 'Pending',
            isBulk: isBulk || (quantity > 500)
        });
        const savedOrder = await newOrder.save();

        if (Array.isArray(items) && items.length > 0) {
            const orderItems = items.map(item => ({
                orderId: savedOrder.orderId,
                name: item.name,
                productId: item.productId,
                customisedProductId: item.customisedProductId || null,
                quantity: item.quantity,
                unitPrice: item.unitPrice
            }));

            await OrderItem.insertMany(orderItems);
        }

        res.status(201).json(savedOrder);
    } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).json({ message: "Server error" });
    }
}

const getOrderInvoiceById = async (req, res) => {
  try {
    const { id } = req.params; 

    // 1. Find the main Order document
    const order = await Order.findOne({ orderId: id });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // 2. Fetch the linked Delivery document (CRITICAL STEP)
    // We use the custom orderId field to link the documents
    const delivery = await Delivery.findOne({ orderId: id }); 
    
    // 3. Fetch Order Items
    const orderItems = await OrderItem.find({ orderId: order.orderId });

    // 4. Construct the final response object
    const orderWithItems = {
      orderId: order.orderId,
      userId: order.userId,
      date: order.date,
      subTotal: order.subTotal,
      discount: order.discount,
      totalAmount: order.totalAmount,
      deliveryFee: order.deliverFee,
      items: orderItems.map((item) => ({
        // ... item properties
        _id: item._id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      
      // 💡 EXPOSE DELIVERY INFO (Prioritize data from the Delivery document)
      deliveryDetails: {
        fullName: delivery ? delivery.customerName : 'N/A',
        address: delivery ? delivery.address : 'N/A',
        phoneNumber: delivery ? delivery.phone : 'N/A',
        email: delivery ? delivery.email : 'N/A',
      },
    };

    res.json(orderWithItems);
  } catch (error) {
    console.error("Error fetching order by ID:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
    placeOrder,
    getOrderInvoiceById
};
