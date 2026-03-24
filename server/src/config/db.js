import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

let memoryServer;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackDbPath = path.resolve(__dirname, "../../.data/mongodb");

function ensureFallbackDbDir() {
  if (!fs.existsSync(fallbackDbPath)) {
    fs.mkdirSync(fallbackDbPath, { recursive: true });
  }
}

function isDbPathLockError(error) {
  const message = String(error?.message || "");
  return message.includes("DBPathInUse") || message.includes("mongod.lock");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectDB() {
  let mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nanohire";

  try {
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB at ${mongoUri}`);
    return;
  } catch (error) {
    if (process.env.MONGO_URI) {
      throw error;
    }

    ensureFallbackDbDir();

    let lastError;
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      try {
        memoryServer = await MongoMemoryServer.create({
          instance: {
            dbPath: fallbackDbPath,
            storageEngine: "wiredTiger"
          }
        });
        lastError = null;
        break;
      } catch (fallbackError) {
        lastError = fallbackError;
        if (!isDbPathLockError(fallbackError)) {
          throw fallbackError;
        }

        // During restart/watch mode the lock can be transient.
        // Retry fixed path instead of switching to a fresh DB location.
        // eslint-disable-next-line no-await-in-loop
        await sleep(500);
      }
    }

    if (!memoryServer) {
      throw new Error(
        `Fallback MongoDB path is locked at ${fallbackDbPath}. Stop the previous server process and restart. ${String(
          lastError?.message || ""
        )}`
      );
    }

    mongoUri = memoryServer.getUri();
    await mongoose.connect(mongoUri);
    console.log(`Using local fallback MongoDB storage at ${fallbackDbPath}.`);
    return;
  }
}

export async function closeDB() {
  await mongoose.connection.close();
  if (memoryServer) {
    await memoryServer.stop();
  }
}
