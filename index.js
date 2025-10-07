const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");

const cors = require("cors")

const orderRoutes = require("./routes/order-routes");
const userRoutes = require("./routes/user-route");
const productRouter = require("./routes/allproduct-router");
const BulkOrderRouter = require("./routes/bulk-order-route");
const DesignRouter = require("./routes/design-route");
const inventoryRouter = require("./routes/inventory-route");
const cartRoutes = require("./routes/cart-route");
const deliveryRoutes = require("./routes/delivery-routes");
const contactRoutes = require("./routes/contact-routes");
dotenv.config(); // must be before using process.env

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));
const port = 5000;
app.use(express.json({ limit: "20mb" }));          // <-- IMPORTANT for data URLs
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Add CORS middleware BEFORE other middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"], // Add your frontend URLs
  credentials: true
}));

app.use(express.json());


app.use("/api/admin/products",inventoryRouter)
app.use("/api/orders", orderRoutes);
app.use("/api/auth", userRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/products", productRouter);
app.use("/api/selections", BulkOrderRouter);
app.use("/api/designs",DesignRouter );
app.use("/api/cart", cartRoutes);
app.use("/api/reports", userRoutes);

// Connect MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// Start server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});


