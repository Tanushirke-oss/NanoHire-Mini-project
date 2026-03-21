import Gig from "../models/Gig.js";
import Post from "../models/Post.js";
import User from "../models/User.js";

export async function seedIfEmpty() {
  const userCount = await User.countDocuments();
  if (userCount > 0) return;

  // Keep first-run database clean so users onboard through real registration.
  await Gig.deleteMany({});
  await Post.deleteMany({});
}
