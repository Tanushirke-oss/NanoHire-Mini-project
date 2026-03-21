import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "hirer"], default: "student" },
    bio: { type: String, default: "" },
    walletAddress: { type: String, default: "" },
    resumeUrl: { type: String, default: "" },
    portfolioUrl: { type: String, default: "" },
    projects: [{ type: String }]
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
