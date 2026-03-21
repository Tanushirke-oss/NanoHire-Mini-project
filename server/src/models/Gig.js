import mongoose from "mongoose";

const timelineSchema = new mongoose.Schema(
  {
    actorId: { type: String, required: true },
    message: { type: String, required: true }
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const applicationSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true },
    note: { type: String, default: "" },
    resumeUrl: { type: String, default: "" }
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const submissionSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true },
    deliverableUrl: { type: String, required: true },
    note: { type: String, default: "" },
    onchainTxHash: { type: String, default: "" }
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const gigSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    fee: { type: Number, required: true },
    deadline: { type: String, required: true },
    tags: [{ type: String }],
    hirerId: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "in_progress", "submitted", "completed", "cancelled"],
      default: "open"
    },
    selectedStudentId: { type: String, default: null },
    applications: [applicationSchema],
    updates: [timelineSchema],
    feedback: [timelineSchema],
    submissions: [submissionSchema],
    payment: {
      mode: { type: String, default: "smart-contract-escrow" },
      status: { type: String, default: "pending" },
      escrowContractAddress: { type: String, default: "" },
      onchainGigId: { type: String, default: "" },
      createTxHash: { type: String, default: "" },
      selectTxHash: { type: String, default: "" },
      releaseTxHash: { type: String, default: "" },
      releasedAt: { type: String, default: "" },
      dispute: {
        raisedBy: { type: String, default: "" },
        reason: { type: String, default: "" },
        raisedAt: { type: String, default: "" },
        onchainTxHash: { type: String, default: "" },
        resolution: { type: String, default: "" },
        resolvedAt: { type: String, default: "" },
        resolvedBy: { type: String, default: "" }
      }
    }
  },
  { timestamps: true }
);

gigSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;

    ret.applications = (ret.applications || []).map((a) => ({
      id: a._id.toString(),
      studentId: a.studentId,
      note: a.note,
      resumeUrl: a.resumeUrl || "",
      createdAt: a.createdAt
    }));

    ret.updates = (ret.updates || []).map((u) => ({
      id: u._id.toString(),
      studentId: u.actorId,
      message: u.message,
      createdAt: u.createdAt
    }));

    ret.feedback = (ret.feedback || []).map((f) => ({
      id: f._id.toString(),
      hirerId: f.actorId,
      message: f.message,
      createdAt: f.createdAt
    }));

    ret.submissions = (ret.submissions || []).map((s) => ({
      id: s._id.toString(),
      studentId: s.studentId,
      deliverableUrl: s.deliverableUrl,
      note: s.note,
      onchainTxHash: s.onchainTxHash,
      createdAt: s.createdAt
    }));

    return ret;
  }
});

export default mongoose.model("Gig", gigSchema);
