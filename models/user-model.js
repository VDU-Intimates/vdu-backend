const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    
    userId:{type: String, required: true, unique:true, index: true,default:generateUserId },
    fName: String,
    lName: String,
    email: String,
    password: String,
    address: String,
    contact: String,
    photoURL: {type : String, default: null},
    role: {type: String,enum: ["Customer", "Admin"],default: "Customer"} 
  },
  { timestamps: true }
);
function generateUserId() {
    const randomDigits = Math.floor(100000 + Math.random() * 900000); 
    const today = new Date();
    const year = today.getFullYear();
    const monthStr = String(today.getMonth() + 1).padStart(2, "0"); 
    const day = String(today.getDate()).padStart(2, "0");
    const datePart = `${year}${monthStr}${day}`;
    return `USR-${datePart}-${randomDigits}`;
  }
  
module.exports = mongoose.model("User", userSchema);
