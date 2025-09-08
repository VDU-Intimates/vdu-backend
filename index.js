const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const orderRoutes = require("./routes/order-routes");
const userRoutes = require("./routes/user-route");

dotenv.config(); // must be before using process.env

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use("/api/orders", orderRoutes);
app.use("/api/auth", userRoutes);

// Connect MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// Routes

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);
});
