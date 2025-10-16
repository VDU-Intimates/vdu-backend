const nodemailer = require('nodemailer');

// Set up the email transporter using credentials from your .env file
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Sends a pre-formatted email to a user about their order status update.
 * @param {string} userEmail - The recipient's email address.
 * @param {string} userName - The recipient's first name.
 * @param {string} orderId - The ID of the order being updated.
 * @param {string} status - The new status of the order ('Accepted', 'Shipped', 'Delivered', 'Cancelled').
 */
const sendOrderStatusUpdateEmail = async (userEmail, userName, orderId, status) => {
  let subject = '';
  let htmlBody = '';

  // A switch statement creates a unique email for each status update
  switch (status) {
    case 'Accepted':
      subject = `✅ Your Order #${orderId} has been Accepted!`;
      htmlBody = `<p>Hi ${userName},</p><p>Great news! Your order <strong>#${orderId}</strong> has been accepted and is now being prepared.</p><p>We will notify you again once it has been shipped.</p>`;
      break;
    case 'Shipped':
      subject = `🚚 Your Order #${orderId} has been Shipped!`;
      htmlBody = `<p>Hi ${userName},</p><p>Your order <strong>#${orderId}</strong> is on its way! You can expect it to arrive soon.</p>`;
      break;
    case 'Delivered':
      subject = `📦 Your Order #${orderId} has been Delivered!`;
      htmlBody = `<p>Hi ${userName},</p><p>Your order <strong>#${orderId}</strong> has been successfully delivered. We hope you enjoy your products!</p>`;
      break;
    case 'Cancelled':
      subject = `❌ Your Order #${orderId} has been Cancelled.`;
      htmlBody = `<p>Hi ${userName},</p><p>Your order <strong>#${orderId}</strong> has been cancelled. If you paid online, a refund has been issued and should appear in your account within 5-10 business days.</p>`;
      break;
    default:
      return; // Do not send an email for unknown statuses
  }

  try {
    await transporter.sendMail({
      from: `"VDU Intimates" <${process.env.EMAIL_USER}>`, // Replace with your company name
      to: userEmail,
      subject: subject,
      html: htmlBody,
    });
    console.log(`Order status email sent to ${userEmail} for order ${orderId}`);
  } catch (error) {
    console.error(`Failed to send email for order ${orderId}:`, error);
  }
};

module.exports = { sendOrderStatusUpdateEmail };