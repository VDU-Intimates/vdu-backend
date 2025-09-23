
// controllers/user-controller.js
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user-model");

// helper: sign JWT (1 hour)
function signAccessToken(user) {
  return jwt.sign(
    { user: { id: user._id.toString(),userId:user.userId, email: user.email, role: user.role } },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "2h" }
  );
}

// POST /register
// body: { firstName, lastName, email, phone?, address?, password }
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
    fName:     fName.trim(),
    lName:     lName.trim(),
    email:     email.toLowerCase().trim(),
    password:  passwordHash,
    address:   address ? String(address).trim() : undefined,
    contact:   contact ? String(contact).trim() : undefined,
    photoURL:  photoURL ? photoURL : null,
    role:      role ? role.trim() : "Customer",
  });

  const token = signAccessToken(user);

  const safeUser = {
    userId: user.userId,
    fName:     user.fName,
    lName:     user.lName,
    email:     user.email,
    password:  user.passwordHash,
    address:   user.address || null,
    contact:   user.contact || null,
    role:      user.role,
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

  const token = signAccessToken(user);

  const safeUser = {
    userId: user.userId,
    firstName: user.firstName,
    lastName:  user.lastName,
    email:     user.email,
    password:  user.password,
    address:   user.address || null,
    contact:   user.contact || null,
    role:      user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return res.json({ token, user: safeUser });
});

// GET /me  (protected)
const getUser = asyncHandler(async (req, res) => {
  // set by JWT middleware: req.user = { id, email, iat, exp }
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized." });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: "User not found." });

  const safeUser = {
    userId: user.userId,
    fName: user.fName,
    lName:  user.lName,
    email:     user.email,
    password:  user.password,
    address:   user.address || null,
    contact:     user.contact || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return res.json({ user: safeUser });
});

// PATCH /me  (protected) — optional profile update
// body: { firstName?, lastName?, phone?, address? }
const updateUser = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized." });

  const { fName, lName, contact, address } = req.body || {};
  const update = {};
  if (fName != null) update.fName = String(fName).trim();
  if (lName  != null) update.lName  = String(lName).trim();
  if (contact     != null) update.contact  = String(contact).trim();
  if (address   != null) update.address   = String(address).trim();

  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ message: "User not found." });

  const safeUser = {
    userId: user.userId,
    fName: user.fName,
    lName:  user.lName,
    email:     user.email,
    password:  user.password,
    address:   user.address || null,
    contact:   user.contact || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  res.json({ user: safeUser });
});

module.exports = {
  registerUser,
  loginUser,
  getUser,
  updateUser,
};
