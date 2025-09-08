const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const userRoutes = require("./routes/user-route");

dotenv.config(); // must be before using process.env

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Connect MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// Routes
app.use("/api/auth", userRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);
});
