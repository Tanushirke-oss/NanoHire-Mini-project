import dotenv from "dotenv";
import net from "net";
import { connectDB } from "./config/db.js";
import { seedIfEmpty } from "./utils/seed.js";
import app from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 4000;

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
