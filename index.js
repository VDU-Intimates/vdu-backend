const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const userRoutes = require("./routes/user-route");

dotenv.config(); // load .env first

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Mount routes
app.use("/api/auth", userRoutes);

// Connect DB, then start server
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log(" MongoDB connected");
    app.listen(PORT, () => {
      console.log(`Server listening at port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(" MongoDB error:", err);
    process.exit(1);
  });
