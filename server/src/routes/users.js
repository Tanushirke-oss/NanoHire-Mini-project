import express from "express";
import User from "../models/User.js";
import Gig from "../models/Gig.js";
import Post from "../models/Post.js";
import Message from "../models/Message.js";
import upload from "../middleware/upload.js";
import { uploadFileAndGetUrl } from "../utils/uploadProvider.js";
import {
  applyWalletDelta,
  ensureFakeWalletAssigned,
  serializeWallet,
} from "../utils/fakeWallet.js";

const router = express.Router();
const DEVELOPER_EMAIL = "tanu.shirke06@gmail.com";

function serializePublicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio,
    resumeUrl: user.resumeUrl,
    portfolioUrl: user.portfolioUrl,
    projects: user.projects || [],
    skills: user.skills || []
  };
}

function serializeUserForViewer(user, viewerId) {
  const base = serializePublicUser(user);
  const isOwner = Boolean(viewerId && user._id.toString() === viewerId);
  const isDeveloperViewer = user.__viewerEmail === DEVELOPER_EMAIL;

  if (isOwner || isDeveloperViewer) {
    return { ...base, ...serializeWallet(user) };
  }
  return base;
}

router.get("/", async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  await Promise.all(users.map((u) => ensureFakeWalletAssigned(u)));
  res.json(
    users.map((u) =>
      serializeUserForViewer({ ...u.toObject(), __viewerEmail: req.user?.email }, req.user?.id)
    )
  );
});

router.get("/me", async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  await ensureFakeWalletAssigned(user);

  return res.json({
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
  });
});

router.get("/:id", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  await ensureFakeWalletAssigned(user);
  return res.json(
    serializeUserForViewer({ ...user.toObject(), __viewerEmail: req.user?.email }, req.user?.id)
  );
});

router.patch("/:id/wallet", async (req, res) => {
  if (req.user?.email !== DEVELOPER_EMAIL) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  const parsedBalance = Number(req.body?.walletBalance);
  if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
    return res.status(400).json({ message: "walletBalance must be a non-negative number" });
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  await ensureFakeWalletAssigned(user);
  const current = Number(user.walletBalance || 0);
  const delta = parsedBalance - current;

  if (delta !== 0) {
    await applyWalletDelta(user, {
      delta,
      type: "developer-adjustment",
      note: "Developer wallet adjustment"
    });
  }

  const refreshed = await User.findById(req.params.id);
  await ensureFakeWalletAssigned(refreshed);

  return res.json(
    serializeUserForViewer({ ...refreshed.toObject(), __viewerEmail: req.user?.email }, req.user?.id)
  );
});

router.put("/:id", async (req, res) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({ message: "You can only update your own profile" });
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const { bio, resumeUrl, portfolioUrl, projects, skills, role, name } = req.body;

  if (typeof bio === "string") user.bio = bio;
  if (typeof resumeUrl === "string") user.resumeUrl = resumeUrl;
  if (typeof portfolioUrl === "string") user.portfolioUrl = portfolioUrl;
  if (Array.isArray(projects)) user.projects = projects;
  if (Array.isArray(skills)) user.skills = skills;
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
  await ensureFakeWalletAssigned(user);

  return res.json({
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
  });
});

router.delete("/:id", async (req, res) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({ message: "You can only delete your own account" });
  }

  const userId = req.params.id;
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  await Post.deleteMany({ authorId: userId });
  await Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] });
  await Gig.deleteMany({ hirerId: userId });

  const impactedGigs = await Gig.find({
    $or: [
      { selectedStudentId: userId },
      { "applications.studentId": userId },
      { "submissions.studentId": userId },
      { "updates.actorId": userId },
      { "feedback.actorId": userId },
      { "payment.dispute.raisedBy": userId },
      { "payment.dispute.resolvedBy": userId }
    ]
  });

  for (const gig of impactedGigs) {
    gig.applications = (gig.applications || []).filter((item) => item.studentId !== userId);
    gig.submissions = (gig.submissions || []).filter((item) => item.studentId !== userId);
    gig.updates = (gig.updates || []).filter((item) => item.actorId !== userId);
    gig.feedback = (gig.feedback || []).filter((item) => item.actorId !== userId);

    if (gig.selectedStudentId === userId) {
      gig.selectedStudentId = null;
      if (gig.status === "in_progress" || gig.status === "submitted") {
        gig.status = "open";
      }
    }

    if (gig.payment?.dispute?.raisedBy === userId) {
      gig.payment.dispute.raisedBy = "";
    }
    if (gig.payment?.dispute?.resolvedBy === userId) {
      gig.payment.dispute.resolvedBy = "";
    }

    await gig.save();
  }

  await User.deleteOne({ _id: userId });

  return res.json({ message: "Account deleted successfully" });
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
    await ensureFakeWalletAssigned(user);

    return res.json({
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
    });
  }
);

export default router;
