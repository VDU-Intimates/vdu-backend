// routes/user-route.js
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
  getUserProfile
} = require("../controllers/user-controller");

// Your JWT middleware (what you called validate-token-handler.js)
const validateToken = require("../middleware/validate-token-handler");

const router = express.Router();

// Auth
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verify-otp", verifyOtp);
router.post("/request-otp", reSendOtp);

// Me (protected)
router.get("/me", validateToken, getUser);
router.patch("/me", validateToken, updateUser);
router.delete("/me", validateToken, deleteUser); 

//Report
// JSON stats (profile + counts)
router.get("/account-stats", validateToken, getAccountStats);

// PDF download (profile + counts)
router.get("/account-summary", validateToken, downloadAccountSummaryPdf);

// Admin profile
router.get('/profile', validateToken, getUserProfile);

module.exports = router;
