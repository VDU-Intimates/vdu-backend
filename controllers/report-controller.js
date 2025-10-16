const { Parser } = require('json2csv');
const Order = require('../models/order-model');

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

module.exports = { 
    generateMonthlyReportCSV 
};