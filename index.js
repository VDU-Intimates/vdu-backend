const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors"); // Add this line

const orderRoutes = require("./routes/order-routes");
const userRoutes = require("./routes/user-route");
const contactRoutes = require("./routes/contact-routes");
const deliveryRoutes = require("./routes/delivery-routes");

dotenv.config(); // must be before using process.env

const app = express();

// Add CORS middleware BEFORE other middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"], // Add your frontend URLs
  credentials: true
}));

app.use(express.json());

const PORT = process.env.PORT || 5000;

// Connect MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

app.use("/api/orders", orderRoutes);
app.use("/api/auth", userRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/deliveries", deliveryRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);
});