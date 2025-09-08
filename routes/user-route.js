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

// Auth
router.post("/register", registerUser);
router.post("/login", loginUser);

// Me (protected)
router.get("/me", validateToken, getUser);
router.patch("/me", validateToken, updateUser);

<<<<<<< HEAD
module.exports = router;
=======
module.exports = router;
>>>>>>> 9b898d9171e8598082526c03b0cb798a21af9fe4
