import { connectDB, closeDB } from "../config/db.js";
import Gig from "../models/Gig.js";
import Message from "../models/Message.js";
import Post from "../models/Post.js";
import User from "../models/User.js";

async function resetAllData() {
  await connectDB();

  const [users, gigs, posts, messages] = await Promise.all([
    User.deleteMany({}),
    Gig.deleteMany({}),
    Post.deleteMany({}),
    Message.deleteMany({})
  ]);

  console.log(
    JSON.stringify(
      {
        usersDeleted: users.deletedCount,
        gigsDeleted: gigs.deletedCount,
        postsDeleted: posts.deletedCount,
        messagesDeleted: messages.deletedCount
      },
      null,
      2
    )
  );

  await closeDB();
}

resetAllData().catch(async (error) => {
  console.error("Failed to reset data", error);
  try {
    await closeDB();
  } catch (_err) {
    // Ignore close errors during failure handling.
  }
  process.exit(1);
});
