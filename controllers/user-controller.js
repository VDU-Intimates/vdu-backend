import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true },
    email: { type: String },
    name: { type: String },
    provider: { type: String },
    emailVerified: { type: Boolean, default: false },
    photoURL: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
