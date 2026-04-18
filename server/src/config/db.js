import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

let memoryServer;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackDbPath = path.resolve(__dirname, "../../.data/mongodb");
const fallbackRootPath = path.resolve(__dirname, "../../.data");

function ensureFallbackDbDir() {
  if (!fs.existsSync(fallbackDbPath)) {
    fs.mkdirSync(fallbackDbPath, { recursive: true });
  }
}

function ensureFallbackRootDir() {
  if (!fs.existsSync(fallbackRootPath)) {
    fs.mkdirSync(fallbackRootPath, { recursive: true });
  }
}

function buildUniqueFallbackDbPath() {
  return path.resolve(fallbackRootPath, `mongodb-${process.pid}-${Date.now()}`);
}

function fallbackLockFilePath() {
  return path.resolve(fallbackDbPath, "mongod.lock");
}

function pickFallbackDbPath() {
  ensureFallbackDbDir();

  const lockPath = fallbackLockFilePath();
  if (fs.existsSync(lockPath)) {
    try {
      // Attempt to clean up stale lock files from ungraceful shutdowns (e.g. nodemon restarts).
      fs.unlinkSync(lockPath);
      const wtLock = path.resolve(fallbackDbPath, "WiredTiger.lock");
      if (fs.existsSync(wtLock)) fs.unlinkSync(wtLock);
      console.log(`Deleted stale MongoDB lock files to reuse existing database.`);
    } catch (err) {
      console.warn(`Could not delete stale lock file. Will create isolated storage. Error: ${err.message}`);
      ensureFallbackRootDir();
      const isolatedPath = buildUniqueFallbackDbPath();
      fs.mkdirSync(isolatedPath, { recursive: true });
      return isolatedPath;
    }
  }

  return fallbackDbPath;
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

    const chosenFallbackDbPath = pickFallbackDbPath();

    if (chosenFallbackDbPath !== fallbackDbPath) {
      console.warn(
        `Fallback MongoDB path is locked at ${fallbackDbPath}. Starting isolated local storage at ${chosenFallbackDbPath}.`
      );
    }

    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbPath: chosenFallbackDbPath,
        storageEngine: "wiredTiger"
      }
    });

    mongoUri = memoryServer.getUri();
    await mongoose.connect(mongoUri);
    console.log(`Using local fallback MongoDB storage at ${chosenFallbackDbPath}.`);
    return;
  }
}

export async function closeDB() {
  await mongoose.connection.close();
  if (memoryServer) {
    await memoryServer.stop();
  }
}
