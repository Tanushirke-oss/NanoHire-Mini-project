import express from "express";
import User from "../models/User.js";
import upload from "../middleware/upload.js";
import { uploadFileAndGetUrl } from "../utils/uploadProvider.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(
    users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      role: u.role,
      bio: u.bio,
      walletAddress: u.walletAddress,
      resumeUrl: u.resumeUrl,
      portfolioUrl: u.portfolioUrl,
      projects: u.projects || []
    }))
  );
});

router.get("/me", async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  return res.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio,
    walletAddress: user.walletAddress,
    resumeUrl: user.resumeUrl,
    portfolioUrl: user.portfolioUrl,
    projects: user.projects || []
  });
});

router.get("/:id", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio,
    walletAddress: user.walletAddress,
    resumeUrl: user.resumeUrl,
    portfolioUrl: user.portfolioUrl,
    projects: user.projects || []
  });
});

router.put("/:id", async (req, res) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({ message: "You can only update your own profile" });
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const { bio, resumeUrl, portfolioUrl, projects, role, name } = req.body;

  if (typeof bio === "string") user.bio = bio;
  if (typeof resumeUrl === "string") user.resumeUrl = resumeUrl;
  if (typeof portfolioUrl === "string") user.portfolioUrl = portfolioUrl;
  if (Array.isArray(projects)) user.projects = projects;
  if (typeof role === "string") user.role = role;
  if (typeof name === "string") {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return res.status(400).json({ message: "name cannot be empty" });
    }

    const duplicate = await User.findOne({
      _id: { $ne: user._id },
      name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
    });

    if (duplicate) {
      return res.status(400).json({ message: "Name already exists. Please choose a different name." });
    }

    user.name = normalizedName;
  }

  await user.save();

  return res.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio,
    walletAddress: user.walletAddress,
    resumeUrl: user.resumeUrl,
    portfolioUrl: user.portfolioUrl,
    projects: user.projects || []
  });
});

router.post(
  "/:id/upload",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "portfolio", maxCount: 1 }
  ]),
  async (req, res) => {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ message: "You can only upload to your own profile" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const files = req.files || {};
    const host = `${req.protocol}://${req.get("host")}`;

    if (files.resume?.[0]) {
      const localUrl = `${host}/uploads/${files.resume[0].filename}`;
      user.resumeUrl = await uploadFileAndGetUrl(files.resume[0], localUrl);
    }

    if (files.portfolio?.[0]) {
      const localUrl = `${host}/uploads/${files.portfolio[0].filename}`;
      user.portfolioUrl = await uploadFileAndGetUrl(files.portfolio[0], localUrl);
    }

    await user.save();

    return res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      bio: user.bio,
      walletAddress: user.walletAddress,
      resumeUrl: user.resumeUrl,
      portfolioUrl: user.portfolioUrl,
      projects: user.projects || []
    });
  }
);

export default router;
