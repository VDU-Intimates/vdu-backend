// routes/user-route.js
const express = require("express");
const {
  registerUser,
  loginUser,
  getUser,
  updateUser,
  getUserById
} = require("../controllers/user-controller");

// Your JWT middleware (what you called validate-token-handler.js)
const validateToken = require("../middleware/validate-token-handler");

const router = express.Router();

// Auth
router.post("/register", registerUser);
router.post("/login", loginUser);

// Me (protected)
router.get("/me", validateToken, getUser);
router.patch("/me", validateToken, updateUser);

router.get("/:id", validateToken, getUserById); 

module.exports = router;
