import dotenv from "dotenv";
import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";
import { seedIfEmpty } from "../src/utils/seed.js";

dotenv.config();

let initPromise;

async function ensureReady() {
  if (!initPromise) {
    initPromise = (async () => {
      await connectDB();
      await seedIfEmpty();
    })();
  }

  return initPromise;
}

export default async function handler(req, res) {
  await ensureReady();
  return app(req, res);
}