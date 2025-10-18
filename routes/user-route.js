const express = require("express");
const {
  registerUser,
  loginUser,
  getUser,
  deleteUser,
  updateUser,
  verifyOtp,
  reSendOtp,
  getAccountStats,
  downloadAccountSummaryPdf,
  getUserProfile,
  getAllUsers,
  deleteUserById,
  getUserOrderSummary
} = require("../controllers/user-controller");

const validateToken = require("../middleware/validate-token-handler");

const router = express.Router();

// --- Auth Routes ---
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verify-otp", verifyOtp);
router.post("/request-otp", reSendOtp);

// --- Current User ("Me") Routes (Protected) ---
router.get("/me", validateToken, getUser);
router.patch("/me", validateToken, updateUser);
router.delete("/me", validateToken, deleteUser); 

// --- Admin Profile Route (Protected) ---
router.get('/profile', validateToken, getUserProfile);

// --- Admin User Management Routes (Protected) ---
// MODIFIED: This now correctly handles GET requests to /api/auth/users
router.get("/users", validateToken, getAllUsers);

// MODIFIED: This now correctly handles DELETE requests to /api/auth/users/:id
router.delete("/users/:id", validateToken, deleteUserById);

// --- Report Routes ---
router.get("/account-stats", validateToken, getAccountStats);
router.get("/account-summary", validateToken, downloadAccountSummaryPdf);
router.get('/users/:id/order-summary', validateToken, getUserOrderSummary);

module.exports = router;