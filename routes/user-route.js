// routes/user-route.js
const express = require("express");
const {
  registerUser,
  loginUser,
  getUser,
  updateUser,
} = require("../controllers/user-controller");

// Your JWT middleware (what you called validate-token-handler.js)
const validateToken = require("../middleware/validate-token-handler");

const router = express.Router();

//CREATE:
// Auth
router.post("/register", registerUser);
router.post("/login", loginUser);

//READ + UPDATE:
// Me (protected)
router.get("/me", validateToken, getUser);
router.patch("/me", validateToken, updateUser);

module.exports = router;