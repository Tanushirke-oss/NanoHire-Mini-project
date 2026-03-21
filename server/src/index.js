import dotenv from "dotenv";
import "express-async-errors";
import cors from "cors";
import express from "express";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import gigsRouter from "./routes/gigs.js";
import postsRouter from "./routes/posts.js";
import usersRouter from "./routes/users.js";
import authRouter from "./routes/auth.js";
import messagesRouter from "./routes/messages.js";
import { connectDB } from "./config/db.js";
import { seedIfEmpty } from "./utils/seed.js";
import { authenticate } from "./middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        tester.close(() => resolve(true));
      })
      .listen(port);
  });
}

async function resolveListenPort(startPort, maxTries = 15) {
  let candidate = Number(startPort);

  for (let i = 0; i < maxTries; i += 1) {
    // Prefer the configured port but fall back to next available ports.
    // This avoids crashing watch mode with EADDRINUSE.
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(candidate);
    if (available) return candidate;
    candidate += 1;
  }

  throw new Error(`No available port found in range ${startPort}-${candidate}`);
}

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

async function bootstrap() {
  await connectDB();
  await seedIfEmpty();
  const listenPort = await resolveListenPort(PORT);

  if (Number(listenPort) !== Number(PORT)) {
    console.warn(`Port ${PORT} is in use. Falling back to ${listenPort}.`);
  }

  app.listen(listenPort, () => {
    console.log(`NanoHire API running on http://localhost:${listenPort}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
