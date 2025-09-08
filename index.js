const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const userRoutes = require("./routes/user-route");
const productRouter = require("./routers/product-routers");

dotenv.config(); // must be before using process.env

const app = express();
app.use(express.json());
const port = 5000;

app.listen(port, () => {
  console.log(`Server listening at http: //localhost:${port}`);
});

mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log("✅ MongoDB connected"))
        .catch((err) => console.error("❌ MongoDB error:", err));

        
app.use("/api/auth", userRoutes);

app.use("/api/products", productRouter);