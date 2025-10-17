// controllers/user-controller.js
const asyncHandler = require("express-async-handler");
const PDFDocument = require("pdfkit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); // <- import crypto
const User = require("../models/user-model");
const nodemailer = require('nodemailer');
const Order = require("../models/order-model");          // <-- change if different
const Design = require("../models/design-model");        // <-- change if different
const BulkOrder = require("../models/bulk-order-model"); 
require('dotenv').config();

const otpStore = new Map();
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// helper: sign JWT (2 hours)
function signAccessToken(user) {
  return jwt.sign(
    { user: { id: user._id.toString(), userId: user.userId, email: user.email, role: user.role } },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "2h" }
  );
}

// generate 6-digit OTP t
function generateOtp() {
    // randomInt(min, maxExclusive)
    return crypto.randomInt(100000, 1000000).toString(); // 100000..999999
}

//OTP through Email
async function sendOtpToUser({ email, name, code, expiresInMinutes = 2 }) {

  const plainText = `
                    Hello ${name},

                    Your one-time password (OTP) for signing in to VDU Intimates is: ${code}

                    This code will expire in ${expiresInMinutes} minutes.

                    If you did not request this code, please ignore this email.

                    Thanks,
                    VDU Intimates
                      `.trim();

  try {
    if (!code || !email || !name) {
      throw new Error('Name, email and OTP code are required');
    }

    const mailOptions = {
      from: process.env.EMAIL_USER, // sender
      to: email, 
      subject: `Your One-Time Password (OTP)`,
      text:plainText,
      html: `
        <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color: #222;">
          <h2 style="margin:0 0 8px 0; color:#2f432a;">Your VDU Intimates One-Time Password</h2>
          <p style="margin:0 0 12px 0;">Hello ${name},</p>

          <p style="margin:0 0 12px 0;">Use the following code to complete your sign-in:</p>

          <div style="display:inline-block; padding:12px 18px; font-size:20px; font-weight:700; letter-spacing:4px; color:#2f432a; background:#f7f4ef; border-radius:8px; margin:8px 0;">
            ${code}
          </div>

          <p style="margin:12px 0 0 0; color:#666;">
            This code will expire in <strong>${expiresInMinutes} minutes</strong>.
            <br/>
            Do not share this code with anyone.
          </p>

          <hr style="margin:18px 0; border:none; border-top:1px solid #eee;" />

          <p style="margin:0; font-size:13px; color:#888;">
            If you did not request this code, please ignore this email or contact us at
            
          </p>

          <p style="margin-top:12px; font-size:13px; color:#888;">— VDU Intimates</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    console.log(`[OTP] sent to ${email}: ${code}`);
  } catch (error) {
    console.error('API error:', error);
    throw new Error(error);
  }
}

const reSendOtp = asyncHandler(async(req,res) => {
  const {email} = req.body;
  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (otpStore.has(user.email)) {
    otpStore.delete(user.email);
  }
  const otp = generateOtp();
    otpStore.set(user.email, {
      code: otp,
      expiresAt: Date.now() + 2 * 60 * 1000, // 2 min validity
      attempts: 0,
    });

    
  try {
    await sendOtpToUser({ email: user.email, name: `${user.fName || ""} ${user.lName || ""}`.trim(), code: otp });
  } catch (error) {
    console.error("Failed to send OTP:", error);
      // optionally clear the OTP if send fails
      otpStore.delete(user.email);
  }
})

// POST /register
const registerUser = asyncHandler(async (req, res) => {
  const { fName, lName, email, password, address, contact, photoURL, role } = req.body;

  if (!fName || !lName || !email || !password) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  const exists = await User.findOne({ email: email.toLowerCase().trim() });
  if (exists) return res.status(409).json({ message: "Email already in use." });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await User.create({
    fName: fName.trim(),
    lName: lName.trim(),
    email: email.toLowerCase().trim(),
    password: passwordHash,
    address: address ? String(address).trim() : undefined,
    contact: contact ? String(contact).trim() : undefined,
    photoURL: photoURL ? photoURL : null,
    role: role ? role.trim() : "Customer",
  });

  const token = signAccessToken(user);

  const safeUser = {
    userId: user.userId,
    fName: user.fName,
    lName: user.lName,
    email: user.email,
    password: user.passwordHash,
    address: user.address || null,
    contact: user.contact || null,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return res.status(201).json({ token, user: safeUser });
});

// POST /login
// body: { email, password }
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) return res.status(401).json({ message: "Invalid credentials." });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: "Invalid credentials." });

  if (user.role === "Admin") {
    // Admin → require OTP (issue OTP on login)
    const otp = generateOtp();
    otpStore.set(user.email, {
      code: otp,
      expiresAt: Date.now() + 2 * 60 * 1000, // 2 min validity
      attempts: 0,
    });
    // send the OTP to admin (email)
    try {
      await sendOtpToUser({ email: user.email, name: `${user.fName || ""} ${user.lName || ""}`.trim(), code: otp });
    } catch (err) {
      console.error("Failed to send OTP:", err);
      // optionally clear the OTP if send fails
      otpStore.delete(user.email);
      // return res.status(500).json({ message: "Failed to send OTP." });
    }
  }

  const token = signAccessToken(user);

  const safeUser = {
    userId: user.userId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    password: user.password,
    address: user.address || null,
    contact: user.contact || null,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return res.json({ token, user: safeUser });
});

// POST /auth/request-otp  (resend OTP) -> body { email }
const requestOtp = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: "Email required." });

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) return res.status(404).json({ message: "User not found." });
  if (user.role !== "Admin") return res.status(403).json({ message: "OTP allowed only for admins." });

  // create new OTP and store it (overwrites previous)
  const otp = generateOtp();
  otpStore.set(user.email, {
    code: otp,
    expiresAt: Date.now() + 2 * 60 * 1000, // 2 min validity
    attempts: 0,
  });

  try {
    await sendOtpToUser({ email: user.email, contact: user.contact, code: otp });
  } catch (err) {
    console.error("Failed to resend OTP:", err);
    return res.status(500).json({ message: "Failed to send OTP." });
  }

  return res.json({ message: "OTP resent." });
});

// POST /verify-otp
const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) return res.status(400).json({ message: "Email and OTP required" });

  const entry = otpStore.get(email);
  if (!entry) return res.status(400).json({ message: "No OTP issued or expired." });

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ message: "OTP expired." });
  }

  if (entry.attempts >= 3) {
    otpStore.delete(email);
    return res.status(403).json({ message: "Too many failed attempts. Request new OTP." });
  }

  if (otp !== entry.code) {
    entry.attempts++;
    return res.status(401).json({ message: "Invalid OTP." });
  }

  // Success
  otpStore.delete(email);
  const user = await User.findOne({ email });
  const token = signAccessToken(user);

  return res.json({ token, user });
});

// GET /me  (protected)
const getUser = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized." });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: "User not found." });

  const safeUser = {
    userId: user.userId,
    fName: user.fName,
    lName: user.lName,
    email: user.email,
    password: user.password,
    address: user.address || null,
    contact: user.contact || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return res.json({ user: safeUser });
});

const getUserById = asyncHandler(async (req, res) => {
  // Uses ID from URL parameter: req.params.id (Mongoose _id)
  const idFromUrl = req.params.id;
  
  if (!idFromUrl) return res.status(400).json({ message: "User ID is required." });

  // Optional: Check if the requesting user (req.user?.id) is authorized to view this user's data
  // For invoice viewing, we assume a token holder can view the linked user's data.

  const user = await User.findById(idFromUrl);
  if (!user) return res.status(404).json({ message: "User not found." });

  // Return only the necessary/safe fields for the invoice
  const safeUser = {
    userId: user.userId,
    fName: user.fName,
    lName:  user.lName,
    email:     user.email,
    // Note: Do NOT return the password hash
    address:   user.address || null,
    contact:   user.contact || null,
    role:      user.role, // Added role for context
  };

  return res.json({ user: safeUser });
});

// PATCH /me  (protected) — optional profile update
const updateUser = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized." });

  const { fName, lName, contact, address } = req.body || {};
  const update = {};
  if (fName != null) update.fName = String(fName).trim();
  if (lName != null) update.lName = String(lName).trim();
  if (contact != null) update.contact = String(contact).trim();
  if (address != null) update.address = String(address).trim();

  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ message: "User not found." });

  const safeUser = {
    userId: user.userId,
    fName: user.fName,
    lName: user.lName,
    email: user.email,
    password: user.password,
    address: user.address || null,
    contact: user.contact || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  res.json({ user: safeUser });
});
const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.user?.id; // set by validateToken middleware
  if (!userId) return res.status(401).json({ message: "Unauthorized." });

  // (Optional) clean up child data owned by this user
  await Promise.all([
    Order.deleteMany({ userId }),
    Design.deleteMany({ userId }),
    BulkOrder.deleteMany({ userId })
  ]);

  const result = await User.findByIdAndDelete(userId);
  if (!result) return res.status(404).json({ message: "User not found." });

  // JWTs are stateless; just tell client to remove its token
  return res.json({ message: "Account deleted successfully." });
});


//Report Generation Function
// GET /api/reports/account-stats
// Returns basic profile + 3 counts
const getAccountStats = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const user = await User.findById(userId).lean();
  if (!user) return res.status(404).json({ message: "User not found" });

  const [orders, customizations, bulkOrders] = await Promise.all([
    Order.countDocuments({ userId }),
    Design.countDocuments({ userId }),
    BulkOrder.countDocuments({ userId }),
  ]);

  // Minimal safe profile fields
  const profile = {
    fName: user.fName,
    lName: user.lName,
    email: user.email,
    contact: user.contact || null,
    address: user.address || null,
    role: user.role || "Customer",
    createdAt: user.createdAt,
  };

  res.json({
    profile,
    counts: {
      orders,
      customizations,
      bulkOrders,
    },
  });
});

// GET /api/reports/account-summary
// Streams a PDF with the same info
const downloadAccountSummaryPdf = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const user = await User.findById(userId).lean();
  if (!user) return res.status(404).json({ message: "User not found" });

  const [orders, customizations, bulkOrders] = await Promise.all([
    Order.countDocuments({ userId }),
    Design.countDocuments({ userId }),
    BulkOrder.countDocuments({ userId }),
  ]);

  const doc = new PDFDocument({ size: "A4", margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="VDU_Account_Summary_${user.fName || "User"}.pdf"`
  );

  doc.pipe(res);

  // --- Background color block (header area) ---
  doc.rect(0, 0, doc.page.width, 90).fill("#2f432a");
  doc.fillColor("#eadfcd");

  // --- Title ---
  doc.image("public/icons/logo.jpg", 40, 15, { width: 60, height: 60 })
  doc
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("VDU Intimates", 0, 25, { align: "center" });
  doc
    .fontSize(14)
    .font("Helvetica")
    .text("Account Summary Report",0,70, { align: "center" });
    
    
  // --- reset colors for body ---
  doc.moveDown(2);
  doc.fillColor("black");

  // --- Section: Profile Details ---
  doc.image("public/icons/profile-icon.png", 60, doc.y - 4, { width: 18, height: 18 });
  doc.fontSize(16).fillColor("#2f432a").text("Profile Details", 82, doc.y - 2, { continued: false });
  doc.moveDown(0.8);

  const profileY = doc.y;
  doc
    .fontSize(13)
    .fillColor("#000")
    .text(`Name       : ${user.fName || ""} ${user.lName || ""}`).moveDown(1)
    .text(`Email      : ${user.email}`).moveDown(1)
    .text(`Contact    : ${user.contact || "-"}`).moveDown(1)
    .text(`Address    : ${user.address || "-"}`).moveDown(1)
    .text(`Role       : ${user.role || "Customer"}`).moveDown(1)
    .text(`Joined On  : ${new Date(user.createdAt).toLocaleString()}`).moveDown(1)
    .moveDown(1.5);

  // --- Divider line ---
  doc
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .strokeColor("#F3C86A")
    .stroke()
    .moveDown(1);

  // --- Section: Activity Summary ---
  doc.moveDown(1)
  doc.image("public/icons/bar-chart-icon.png", 60, doc.y - 7, { width: 18, height: 18 });
  doc.fontSize(16).fillColor("#2f432a").text("Activity Summary", 82, doc.y - 2, { continued: false });
  doc.moveDown(1)

  doc
    .fontSize(13)
    .fillColor("#000")
    .text(`Orders Placed     : ${orders}`).moveDown(1)
    .text(`Customizations    : ${customizations}`).moveDown(1)
    .text(`Bulk Orders       : ${bulkOrders}`).moveDown(1)
    .moveDown(1.5);

  // --- Divider line ---
  doc
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .strokeColor("#ddd")
    .stroke()
    .moveDown(1);

  // --- Footer ---
  doc
    .fontSize(10)
    .fillColor("#555")
    .text("Generated by VDU Intimates", 50, doc.page.height - 75, {
      align: "left",
    })
    .text(
      `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      { align: "right" }
    );

  doc.end();
});

const getUserProfile = asyncHandler(async (req, res) => {
  // The `validateToken` middleware puts the user's ID on `req.user`
  const userId = req.user.userId;
  if (!userId) {
    return res.status(401).json({ message: "User not authenticated" });
  }

  // Find the user in the database but select only the necessary fields
  const user = await User.findOne({ userId: userId }).select('fName lName email photoURL');

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Return the user's profile data
  res.status(200).json(user);
});

const getAllUsers = asyncHandler(async (req, res) => {
  // 1. Security Check: Ensure the requester is an admin
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: "Forbidden: You do not have permission to access this resource." });
  }

  // 2. Fetch all users from the database
  //    - .select('-password') is a crucial security measure to exclude password hashes.
  //    - .sort({ createdAt: -1 }) shows the newest users first.
  const users = await User.find({}).select('-password').sort({ createdAt: -1 });

  // 3. Return the array of users
  res.status(200).json(users);
});

// --- ADD THIS NEW FUNCTION ---
const deleteUserById = asyncHandler(async (req, res) => {
  // 1. Security Check: Ensure the requester is an admin
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: "Forbidden: You do not have permission." });
  }

  // 2. Get the ID of the user to delete from the URL parameter
  const userIdToDelete = req.params.id;

  // Optional Safety Check: Prevent an admin from deleting their own account via this endpoint
  if (req.user.userId === userIdToDelete) {
    return res.status(400).json({ message: "Admin cannot delete their own account from this panel." });
  }

  // 3. Find and delete the user by their business ID (e.g., USR-...)
  const user = await User.findOneAndDelete({ userId: userIdToDelete });

  // 4. If no user was found with that ID, return an error
  if (!user) {
    return res.status(404).json({ message: `User with ID ${userIdToDelete} not found.` });
  }

  // 5. Send a success confirmation
  res.status(200).json({ message: `User "${user.fName} ${user.lName}" deleted successfully.` });
});


module.exports = {
  registerUser,
  loginUser,
  requestOtp, 
  getUser,
  deleteUser,
  updateUser,
  verifyOtp,
  reSendOtp,
  getAccountStats,
  downloadAccountSummaryPdf,
  getUserById,
  getUserProfile,
  getAllUsers,
  deleteUserById
};
