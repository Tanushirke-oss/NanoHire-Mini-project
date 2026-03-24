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

function isDbPathLockError(error) {
  const message = String(error?.message || "");
  return message.includes("DBPathInUse") || message.includes("mongod.lock");
}

export async function connectDB() {
  let mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nanohire";
  let selectedFallbackPath = fallbackDbPath;

  try {
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB at ${mongoUri}`);
    return;
  } catch (error) {
    if (process.env.MONGO_URI) {
      throw error;
    }

    ensureFallbackDbDir();

    try {
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbPath: fallbackDbPath,
          storageEngine: "wiredTiger"
        }
      });
    } catch (fallbackError) {
      if (!isDbPathLockError(fallbackError)) {
        throw fallbackError;
      }

      ensureFallbackRootDir();
      const uniqueFallbackDbPath = buildUniqueFallbackDbPath();
      fs.mkdirSync(uniqueFallbackDbPath, { recursive: true });
      selectedFallbackPath = uniqueFallbackDbPath;
      console.warn(
        `Default fallback DB path is locked. Using isolated fallback storage at ${uniqueFallbackDbPath}.`
      );

      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbPath: uniqueFallbackDbPath,
          storageEngine: "wiredTiger"
        }
      });
    }

    mongoUri = memoryServer.getUri();
    await mongoose.connect(mongoUri);
    console.log(`Using local fallback MongoDB storage at ${selectedFallbackPath}.`);
    return;
  }
}

export async function closeDB() {
  await mongoose.connection.close();
  if (memoryServer) {
    await memoryServer.stop();
  }
}
