import express from "express";
import Message from "../models/Message.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Get all messages for the current user
router.get("/", authenticate, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ senderId: req.user.id }, { receiverId: req.user.id }]
    }).sort({ createdAt: -1 });
    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// Get conversation between two users for a specific gig
router.get("/:gigId/:otherUserId", authenticate, async (req, res) => {
  try {
    const { gigId, otherUserId } = req.params;
    const messages = await Message.find({
      gigId,
      $or: [
        { senderId: req.user.id, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: req.user.id }
      ]
    }).sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      {
        gigId,
        senderId: otherUserId,
        receiverId: req.user.id,
        isRead: false
      },
      { isRead: true }
    );

    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch conversation" });
  }
});

// Send a message
router.post("/", authenticate, async (req, res) => {
  try {
    const { gigId, receiverId, content } = req.body;

    if (!gigId || !receiverId || !content) {
      return res.status(400).json({ message: "gigId, receiverId, and content are required" });
    }

    const message = await Message.create({
      gigId,
      senderId: req.user.id,
      receiverId,
      content,
      isRead: false
    });

    return res.status(201).json(message);
  } catch (error) {
    return res.status(500).json({ message: "Failed to send message" });
  }
});

export default router;
