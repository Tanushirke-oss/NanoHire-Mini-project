import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio,
    walletAddress: user.walletAddress,
    resumeUrl: user.resumeUrl,
    portfolioUrl: user.portfolioUrl,
    projects: user.projects || []
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    process.env.JWT_SECRET || "nanohire-dev-secret",
    { expiresIn: "7d" }
  );
}

router.post("/register", async (req, res) => {
  const { name, email, password, role, walletAddress } = req.body;
  const normalizedName = String(name || "").trim();

  if (!normalizedName || !email || !password) {
    return res.status(400).json({ message: "name, email, and password are required" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(400).json({ message: "Email already exists" });
  }

  const existingName = await User.findOne({
    name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
  });
  if (existingName) {
    return res.status(400).json({ message: "Name already exists. Please choose a different name." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    name: normalizedName,
    email: email.toLowerCase(),
    passwordHash,
    role: role || "student",
    walletAddress: walletAddress || "",
    bio: "",
    projects: []
  });

  const token = signToken(user);
  return res.status(201).json({ token, user: serializeUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash || "");
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = signToken(user);
  return res.json({ token, user: serializeUser(user) });
});

router.get("/me", authenticate, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({ user: serializeUser(user) });
});

export default router;
