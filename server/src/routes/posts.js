import express from "express";
import Post from "../models/Post.js";
import upload from "../middleware/upload.js";
import { uploadFileAndGetUrl } from "../utils/uploadProvider.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts.map((p) => p.toJSON()));
});

router.post("/", upload.single("media"), async (req, res) => {
  const { content, title, body } = req.body;
  const normalizedTitle = String(title || "").trim();
  const normalizedContent = String(content || "").trim();
  const normalizedBody = String(body || "").trim();

  if (!normalizedTitle) {
    return res.status(400).json({ message: "title is required" });
  }

  const host = `${req.protocol}://${req.get("host")}`;
  let mediaUrl = "";
  let mediaType = "none";

  if (req.file) {
    const localUrl = `${host}/uploads/${req.file.filename}`;
    mediaUrl = await uploadFileAndGetUrl(req.file, localUrl);
    mediaType = req.file.mimetype.startsWith("video/") ? "video" : "image";
  }

  const post = await Post.create({
    authorId: req.user.id,
    title: normalizedTitle,
    body: normalizedBody,
    content: normalizedContent,
    mediaUrl,
    mediaType,
    likes: [],
    comments: [],
    sharesCount: 0
  });

  return res.status(201).json(post.toJSON());
});

router.post("/:id/like", async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  const userId = req.user.id;
  const alreadyLiked = (post.likes || []).includes(userId);

  if (alreadyLiked) {
    post.likes = (post.likes || []).filter((id) => id !== userId);
  } else {
    post.likes.push(userId);
  }

  await post.save();
  return res.json(post.toJSON());
});

router.post("/:id/comment", async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  const content = String(req.body?.content || "").trim();
  if (!content) {
    return res.status(400).json({ message: "Comment content is required" });
  }

  post.comments.push({
    userId: req.user.id,
    content,
    createdAt: new Date()
  });

  await post.save();
  return res.status(201).json(post.toJSON());
});

router.post("/:id/share", async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  post.sharesCount = Number(post.sharesCount || 0) + 1;
  await post.save();
  return res.json(post.toJSON());
});

router.delete("/:id", async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (post.authorId !== req.user.id) {
    return res.status(403).json({ message: "You can only delete your own posts" });
  }

  await Post.deleteOne({ _id: post._id });
  return res.json({ message: "Post deleted successfully" });
});

export default router;
