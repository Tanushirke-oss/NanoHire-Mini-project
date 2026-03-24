import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import { seedIfEmpty } from "./utils/seed.js";
import app from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  await connectDB();
  await seedIfEmpty();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
