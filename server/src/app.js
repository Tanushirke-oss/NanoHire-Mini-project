import "express-async-errors";
import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import gigsRouter from "./routes/gigs.js";
import postsRouter from "./routes/posts.js";
import usersRouter from "./routes/users.js";
import authRouter from "./routes/auth.js";
import messagesRouter from "./routes/messages.js";
import { authenticate } from "./middleware/auth.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "nanohire-api" });
});

app.use("/auth", authRouter);
app.use("/users", authenticate, usersRouter);
app.use("/posts", authenticate, postsRouter);
app.use("/gigs", authenticate, gigsRouter);
app.use("/messages", authenticate, messagesRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  return res.status(500).json({ message: err.message || "Internal server error" });
});

export default app;