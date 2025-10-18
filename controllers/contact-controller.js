const Contact = require('../models/contact-model');
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendEmail = async (req, res) => {
  try {
    const { name, phone, email, comment } = req.body;

    // Basic validation
    if (!name || !phone || !email) {
      return res.status(400).json({ message: 'Name, phone, and email are required' });
    }

    // Save form data to MongoDB
    const newContact = new Contact({ name, phone, email, comment });
    await newContact.save();

    // Send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER, // Use your email as sender
      to: process.env.EMAIL_USER, // Send to yourself
      replyTo: email, // Allow replies to go to the user
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Comment:</strong></p>
        <p>${comment || 'No comment provided'}</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Success: Message sent and saved!' });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = {
  sendEmail
};