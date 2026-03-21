import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true },
    content: { type: String, required: true },
    mediaUrl: { type: String, default: "" },
    mediaType: { type: String, enum: ["image", "video", "none"], default: "none" },
    likes: [{ type: String }],
    comments: [
      {
        userId: { type: String, required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    sharesCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

postSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    ret.likeCount = (ret.likes || []).length;
    ret.commentCount = (ret.comments || []).length;
    return ret;
  }
});

export default mongoose.model("Post", postSchema);
