import dotenv from "dotenv";
import { connectDB, closeDB } from "./config/db.js";
import { seedIfEmpty } from "./utils/seed.js";
import app from "./app.js";

dotenv.config();

const DEFAULT_PORT = 4000;
const MAX_FALLBACK_PORT = 4010;
const CONFIGURED_PORT = Number(process.env.PORT || DEFAULT_PORT);

function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.once("error", (error) => reject(error));
  });
}

async function startServerWithPortFallback() {
  let port = CONFIGURED_PORT;

  // If PORT is explicitly configured, respect it and fail fast on conflicts.
  const allowPortFallback = !process.env.PORT;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const server = await listenOnPort(port);
      return { server, port };
    } catch (error) {
      const isPortBusy = error?.code === "EADDRINUSE";
      if (!isPortBusy || !allowPortFallback || port >= MAX_FALLBACK_PORT) {
        throw error;
      }
      port += 1;
    }
  }
}

async function bootstrap() {
  await connectDB();
  await seedIfEmpty();

  const { server, port } = await startServerWithPortFallback();
  console.log(`Server running on port ${port}`);

  let shuttingDown = false;

  const cleanup = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\nShutting down nicely...");
    await closeDB();
    server.close();
    process.exit(0);
  };

  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);
}

bootstrap().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
