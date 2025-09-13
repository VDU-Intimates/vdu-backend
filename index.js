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

dotenv.config(); // must be before using process.env

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));
const port = 5000;
app.use(express.json({ limit: "20mb" }));          // <-- IMPORTANT for data URLs
app.use(express.urlencoded({ extended: true, limit: "20mb" }));


app.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});

app.use("/api/products/admin",inventoryRouter)
app.use("/api/auth", userRoutes);
app.use("/api/products", productRouter);
app.use("/api/selections", BulkOrderRouter);
app.use("/api/designs",DesignRouter );
app.use("/api/cart", cartRoutes);

mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log("MongoDB connected"))
        .catch((err) => console.error("MongoDB error:", err));


