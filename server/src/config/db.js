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
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbPath: fallbackDbPath,
        storageEngine: "wiredTiger"
      }
    });
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
