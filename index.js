const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");

const orderRoutes = require("./routes/order-routes");
const cors = require("cors");

const userRoutes = require("./routes/user-route");
const productRouter = require("./routes/allproduct-router");

dotenv.config(); // must be before using process.env

const app = express();

app.use(cors({
  origin: [
    "http://localhost:3000",              // Next.js dev
    "http://172.20.10.5:3000",            // your LAN dev URL if you use it
    // "https://your-frontend-domain.com", // add prod domain if needed
  ],
  credentials: true
}));

app.use(express.json());
const port = 5000;

app.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});

app.use("/api/auth", userRoutes);

app.use("/api/products", productRouter);

mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log("MongoDB connected"))
        .catch((err) => console.error("MongoDB error:", err));

app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});




