// controllers/user-controller.js
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); // <- import crypto
const User = require("../models/user-model");
const nodemailer = require('nodemailer');
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

// placeholder: replace with your email/SMS sending logic
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
      return res.status(400).json({ message: 'Name, Email, and OTP code are required' });
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
    res.status(500).json({ message: 'Server Error', error: error.message });
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
    console.error("Failed to send OTP:", err);
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

module.exports = {
  registerUser,
  loginUser,
  requestOtp,     // <- exported for routing
  getUser,
  updateUser,
  verifyOtp,
  reSendOtp
};
