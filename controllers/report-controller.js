const { Parser } = require('json2csv');
const axios = require('axios');
const Delivery = require('../models/delivery-model');
const Order = require('../models/order-model');
const User = require('../models/user-model');

const generateUserReportCSV = async (req, res) => {
  try {
    // Security check: Only admins can generate this report
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: "Forbidden: You do not have permission." });
    }

    // Fetch all users, excluding their passwords for security
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });

    if (users.length === 0) {
      return res.status(404).json({ message: "No users found to generate a report." });
    }

    // Prepare the data for the CSV, formatting as needed
    const reportData = users.map(user => ({
      userId: user.userId,
      fullName: `${user.fName || ''} ${user.lName || ''}`.trim(),
      email: user.email,
      contact: user.contact || 'N/A',
      address: user.address || 'N/A',
      role: user.role,
      joinedOn: new Date(user.createdAt).toLocaleDateString('en-CA'), // YYYY-MM-DD format
    }));

    const fields = [
      { label: 'User ID', value: 'userId' },
      { label: 'Full Name', value: 'fullName' },
      { label: 'Email', value: 'email' },
      { label: 'Contact', value: 'contact' },
      { label: 'Address', value: 'address' },
      { label: 'Role', value: 'role' },
      { label: 'Joined On', value: 'joinedOn' },
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(reportData);

    const today = new Date().toLocaleDateString('en-CA');
    const filename = `User-Report-${today}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.status(200).send(csv);

  } catch (error) {
    console.error("Error generating user CSV report:", error);
    res.status(500).json({ message: "Server error while generating report." });
  }
};

const generateMonthlyReportCSV = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ message: "Year and month are required." });
    }

    const numericYear = parseInt(year);
    const numericMonth = parseInt(month);

    // Fetch data for the current and previous months
    const selectedMonthStartDate = new Date(Date.UTC(numericYear, numericMonth - 1, 1));
    const selectedMonthEndDate = new Date(Date.UTC(numericYear, numericMonth, 1));
    const prevMonthStartDate = new Date(Date.UTC(numericYear, numericMonth - 2, 1));
    const prevMonthEndDate = new Date(Date.UTC(numericYear, numericMonth - 1, 1));

    const [currentMonthOrders, previousMonthOrders] = await Promise.all([
      Order.find({ date: { $gte: selectedMonthStartDate, $lt: selectedMonthEndDate } }).sort({ date: 'asc' }),
      Order.find({ date: { $gte: prevMonthStartDate, $lt: prevMonthEndDate } })
    ]);

    const monthName = selectedMonthStartDate.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
    if (currentMonthOrders.length === 0) {
      return res.status(404).json({ message: `No orders were found for ${monthName} ${numericYear}.` });
    }

    // Calculate summary metrics
    const currentMonthRevenue = currentMonthOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const previousMonthRevenue = previousMonthOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    let percentageChange = previousMonthRevenue > 0 ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 : (currentMonthRevenue > 0 ? 100 : 0);
    const changeIndicator = percentageChange >= 0 ? '↑' : '↓';

    const statusCounts = currentMonthOrders.reduce((acc, order) => {
      acc[order.orderStatus] = (acc[order.orderStatus] || 0) + 1;
      return acc;
    }, {});

    // Manually construct the CSV string with a summary section
    let csvString = "";
    csvString += `Monthly Report Summary - ${monthName} ${numericYear}\n\n`;
    csvString += `Metric,Value\n`;
    csvString += `Total Income (Rs.),"${currentMonthRevenue.toLocaleString()}"\n`;
    csvString += `Previous Month Income (Rs.),"${previousMonthRevenue.toLocaleString()}"\n`;
    csvString += `Month-over-Month Change,"${percentageChange.toFixed(2)}% ${changeIndicator}"\n`;
    csvString += `Total Orders,"${currentMonthOrders.length}"\n\n`;

    csvString += `Status Breakdown,Count\n`;
    const allStatuses = ['Pending', 'Accepted', 'Shipped', 'Delivered', 'Cancelled'];
    allStatuses.forEach(status => {
      csvString += `"${status} Orders","${statusCounts[status] || 0}"\n`;
    });
    csvString += `\n`;

    // --- THIS IS THE CORRECTED PART ---
    // The logic inside the .map() function is now complete.
    csvString += `Detailed Orders for ${monthName} ${numericYear}\n`;
    const reportData = currentMonthOrders.map(order => ({
      orderId: order.orderId,
      date: new Date(order.date).toLocaleDateString('en-CA'), // YYYY-MM-DD
      status: order.orderStatus,
      totalAmount: order.totalAmount,
      discount: order.discount,
      paymentType: order.paymentType || 'N/A'
    }));

    const fields = [
      { label: 'Order ID', value: 'orderId' },
      { label: 'Date', value: 'date' },
      { label: 'Status', value: 'status' },
      { label: 'Payment Type', value: 'paymentType' },
      { label: 'Discount (Rs.)', value: 'discount' },
      { label: 'Total Amount (Rs.)', value: 'totalAmount' }
    ];
    // --- END OF CORRECTION ---

    const json2csvParser = new Parser({ fields });
    const detailedCsv = json2csvParser.parse(reportData);
    csvString += detailedCsv;

    const filename = `Order-Report-${monthName}-${numericYear}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvString);

  } catch (error) {
    console.error("Error generating CSV report:", error);
    res.status(500).json({ message: "Server error while generating CSV report." });
  }
};

const getOrderLocations = async (req, res) => {
  try {
    // 1. Fetch recent orders to keep the map from getting too cluttered
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrders = await Order.find({ date: { $gte: thirtyDaysAgo } }).select('orderId');
    const orderIds = recentOrders.map(o => o.orderId);

    // 2. Find the delivery details for these orders
    const deliveries = await Delivery.find({ orderId: { $in: orderIds } });

    const locations = [];

    for (const delivery of deliveries) {
      // 3. If we already have coordinates, use them
      if (delivery.coordinates && delivery.coordinates.coordinates.length === 2) {
        // Leaflet expects [latitude, longitude]
        locations.push([delivery.coordinates.coordinates[1], delivery.coordinates.coordinates[0]]);
        continue;
      }

      // 4. If not, geocode the address using Nominatim (free OpenStreetMap service)
      const addressQuery = encodeURIComponent(`${delivery.address}, Sri Lanka`);
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${addressQuery}`;
      
      try {
        const geoResponse = await axios.get(geocodeUrl, {
            headers: { 'User-Agent': 'VDU-Intimates-Admin-Panel/1.0' } // Good practice
        });

        if (geoResponse.data && geoResponse.data.length > 0) {
          const { lat, lon } = geoResponse.data[0];
          const latitude = parseFloat(lat);
          const longitude = parseFloat(lon);
          
          locations.push([latitude, longitude]);

          // 5. Save the coordinates back to the database for future use
          delivery.coordinates.coordinates = [longitude, latitude];
          await delivery.save();
        }
      } catch (geoError) {
        console.warn(`Could not geocode address for order ${delivery.orderId}:`, delivery.address);
      }
    }
    
    res.status(200).json(locations);

  } catch (error) {
    console.error("Error fetching order locations:", error);
    res.status(500).json({ message: "Server error while fetching locations." });
  }
};

module.exports = { 
    generateMonthlyReportCSV,
    generateUserReportCSV,
    getOrderLocations
};