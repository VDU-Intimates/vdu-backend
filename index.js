const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");

dotenv.config(); // must be before using process.env

const app = express();
const port = 5000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server listening at port ${port}`);
});

mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log("MongoDB connected"))
        .catch((err) => console.error("MongoDB error:", err));
