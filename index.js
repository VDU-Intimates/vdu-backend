const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require('http');
const { Server } = require("socket.io");

// Import all your route files
const orderRoutes = require("./routes/order-routes");
const userRoutes = require("./routes/user-route");
const productRouter = require("./routes/allproduct-router");
const BulkOrderRouter = require("./routes/bulk-order-route");
const DesignRouter = require("./routes/design-route");
const inventoryRouter = require("./routes/inventory-route");
const cartRoutes = require("./routes/cart-route");
const deliveryRoutes = require("./routes/delivery-routes");
const contactRoutes = require("./routes/contact-routes");
const paymentRoutes = require("./routes/stripe-payment-route");
const ratingRoutes = require("./routes/rating-route");
const reportRoutes = require("./routes/report-routes");

const app = express();
const server = http.createServer(app); // Create an HTTP server from the Express app

// Configure CORS for Express
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true
}));

// Configure middleware
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Initialize socket.io and attach it to the server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Allow your frontend to connect
    methods: ["GET", "POST"]
  }
});

// Handle WebSocket connections
io.on('connection', (socket) => {
  console.log('✅ Admin client connected via WebSocket');
  socket.on('disconnect', () => {
    console.log('❌ Admin client disconnected');
  });
});

// Make the `io` instance available to your controllers
app.set('socketio', io);

// Mount all your API routes
app.use("/api/admin/products", inventoryRouter);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", userRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/products", productRouter);
app.use("/api/selections", BulkOrderRouter);
app.use("/api/designs", DesignRouter);
app.use("/api/cart", cartRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/reports", reportRoutes);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// Start the server
const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`Server and WebSocket listening at http://localhost:${port}`);
});