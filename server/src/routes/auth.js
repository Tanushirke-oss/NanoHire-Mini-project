import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { authenticate } from "../middleware/auth.js";
import { ensureFakeWalletAssigned, getStudentInitialBalance, serializeWallet } from "../utils/fakeWallet.js";

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || undefined);

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio,
    ...serializeWallet(user),
    resumeUrl: user.resumeUrl,
    portfolioUrl: user.portfolioUrl,
    projects: user.projects || [],
    skills: user.skills || []
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    process.env.JWT_SECRET || "nanohire-dev-secret",
    { expiresIn: "7d" }
  );
}

async function ensureUniqueName(baseName) {
  const initial = String(baseName || "User").trim() || "User";
  let candidate = initial;
  let counter = 1;

  // Keep app names unique while preserving original human-readable base when possible.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.findOne({
      name: { $regex: `^${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
    });
    if (!exists) return candidate;
    counter += 1;
    candidate = `${initial}${counter}`;
  }
}

router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;
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
    walletAddress: "",
    fakeWalletId: "",
    walletBalance: role === "hirer" ? 2000 : getStudentInitialBalance(),
    walletTransactions: [],
    bio: "",
    projects: [],
    skills: []
  });

  await ensureFakeWalletAssigned(user);

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

  await ensureFakeWalletAssigned(user);

  const ok = await bcrypt.compare(password, user.passwordHash || "");
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = signToken(user);
  return res.json({ token, user: serializeUser(user) });
});

router.post("/google", async (req, res) => {
  const { idToken, role } = req.body || {};

  if (!idToken) {
    return res.status(400).json({ message: "idToken is required" });
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ message: "Google login is not configured on server." });
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();
  const email = String(payload?.email || "").toLowerCase().trim();
  const googleId = String(payload?.sub || "");
  const displayName = String(payload?.name || "").trim() || "Google User";

  if (!email || !googleId) {
    return res.status(400).json({ message: "Google account information is incomplete." });
  }

  if (payload?.email_verified === false) {
    return res.status(401).json({ message: "Google email is not verified." });
  }

  let user = await User.findOne({ email });

  if (!user) {
    const userRole = role === "hirer" ? "hirer" : "student";
    const uniqueName = await ensureUniqueName(displayName);
    const randomPassword = `${googleId}-${Date.now()}`;
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    user = await User.create({
      name: uniqueName,
      email,
      passwordHash,
      googleId,
      authProvider: "google",
      role: userRole,
      walletAddress: "",
      fakeWalletId: "",
      walletBalance: userRole === "hirer" ? 2000 : getStudentInitialBalance(),
      walletTransactions: [],
      bio: "",
      projects: [],
      skills: []
    });
  } else {
    user.googleId = user.googleId || googleId;
    user.authProvider = user.authProvider || "google";
    await user.save();
  }

  await ensureFakeWalletAssigned(user);
  const token = signToken(user);
  return res.json({ token, user: serializeUser(user) });
});

router.get("/me", authenticate, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  await ensureFakeWalletAssigned(user);

  return res.json({ user: serializeUser(user) });
});

export default router;
