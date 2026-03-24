import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
  {
    type: { type: String, default: "" },
    direction: { type: String, enum: ["credit", "debit"], default: "credit" },
    amount: { type: Number, default: 0 },
    delta: { type: Number, default: 0 },
    note: { type: String, default: "" },
    gigId: { type: String, default: "" },
    balanceAfter: { type: Number, default: 0 },
    createdAt: { type: String, default: "" }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    googleId: { type: String, default: "", index: true },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    role: { type: String, enum: ["student", "hirer"], default: "student" },
    bio: { type: String, default: "" },
    walletAddress: { type: String, default: "" },
    fakeWalletId: { type: String, default: "" },
    walletBalance: { type: Number, default: 0 },
    walletTransactions: { type: [walletTransactionSchema], default: [] },
    resumeUrl: { type: String, default: "" },
    portfolioUrl: { type: String, default: "" },
    projects: [{ type: String }],
    skills: [{ type: String }]
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
