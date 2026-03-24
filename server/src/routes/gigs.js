import express from "express";
import Gig from "../models/Gig.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import upload from "../middleware/upload.js";
import { uploadFileAndGetUrl } from "../utils/uploadProvider.js";
import { applyWalletDelta, ensureFakeWalletAssigned } from "../utils/fakeWallet.js";

const router = express.Router();

function parseBudgetInput(rawFee) {
  const value = String(rawFee || "").trim();
  if (!value) {
    throw new Error("Budget is required.");
  }

  const rangeMatch = value.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const feeMin = Number(rangeMatch[1]);
    const feeMax = Number(rangeMatch[2]);

    if (!Number.isFinite(feeMin) || !Number.isFinite(feeMax) || feeMin <= 0 || feeMax <= 0) {
      throw new Error("Budget range must contain positive numbers.");
    }

    if (feeMin > feeMax) {
      throw new Error("Budget range is invalid. Min cannot be greater than max.");
    }

    return { fee: feeMax, feeMin, feeMax };
  }

  const numericFee = Number(value);
  if (!Number.isFinite(numericFee) || numericFee <= 0) {
    throw new Error("Budget must be a positive number, or a range like 500-1200.");
  }

  return { fee: numericFee, feeMin: null, feeMax: null };
}

router.get("/", async (_req, res) => {
  const gigs = await Gig.find().sort({ createdAt: -1 });
  res.json(gigs.map((g) => g.toJSON()));
});

// Developer stats endpoint (protected)
router.get("/dev/stats", async (req, res) => {
  // Only allow tanu.shirke06@gmail.com
  const user = await User.findById(req.user?.id);
  if (user?.email !== "tanu.shirke06@gmail.com") {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const allGigs = await Gig.find();
    const allUsers = await User.find();

    const stats = {
      timestamp: new Date().toISOString(),
      totalUsers: allUsers.length,
      totalHirers: allUsers.filter(u => u.role === "hirer").length,
      totalStudents: allUsers.filter(u => u.role === "student").length,
      totalOpenTasks: allGigs.filter(g => g.status === "open").length,
      totalAllottedTasks: allGigs.filter(g => g.status === "in_progress").length,
      totalSubmittedTasks: allGigs.filter(g => g.status === "submitted").length,
      totalCompletedTasks: allGigs.filter(g => g.status === "completed").length,
      totalTransactionAmount: allGigs
        .filter(g => g.status === "completed")
        .reduce((sum, g) => sum + (Number(g.fee) || 0), 0),
      allTasks: allGigs.map(g => ({
        id: g.id,
        title: g.title,
        status: g.status,
        fee: g.fee,
        hirerId: g.hirerId,
        selectedStudentId: g.selectedStudentId
      }))
    };

    res.json(stats);
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

router.get("/:id", async (req, res) => {
  const gig = await Gig.findById(req.params.id);
  if (!gig) {
    return res.status(404).json({ message: "Gig not found" });
  }
  return res.json(gig.toJSON());
});

router.post("/", async (req, res) => {
  const { title, description, fee, deadline, tags } = req.body;
  let parsedBudget;

  if (!title || !description || !fee || !deadline) {
    return res.status(400).json({ message: "title, description, fee, deadline are required" });
  }

  try {
    parsedBudget = parseBudgetInput(fee);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const poster = await User.findById(req.user.id);
  if (!poster) {
    return res.status(404).json({ message: "User not found" });
  }

  await ensureFakeWalletAssigned(poster);
  const walletBalance = Number(poster.walletBalance || 0);
  if (parsedBudget.fee > walletBalance) {
    return res.status(400).json({
      message: `Budget cannot exceed your wallet balance of Rs. ${walletBalance}.`
    });
  }

  const gig = await Gig.create({
    title,
    description,
    fee: parsedBudget.fee,
    feeMin: parsedBudget.feeMin,
    feeMax: parsedBudget.feeMax,
    deadline,
    hirerId: req.user.id,
    tags: tags ?? []
  });
  return res.status(201).json(gig.toJSON());
});

router.post(
  "/:id/apply",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "workSample", maxCount: 1 }
  ]),
  async (req, res) => {
  const gig = await Gig.findById(req.params.id);
  if (!gig) return res.status(404).json({ message: "Gig not found" });
  if (gig.status !== "open") return res.status(400).json({ message: "Gig is not open for applications" });

  const { note, resumeUrl } = req.body;
  const studentId = req.user.id;

  const existing = gig.applications.find((a) => a.studentId === studentId);
  if (existing) {
    return res.status(400).json({ message: "Student already applied" });
  }

  const files = req.files || {};
  let finalResumeUrl = String(resumeUrl || "").trim();
  let finalWorkSampleUrl = "";
  if (files.resume?.[0]) {
    const host = `${req.protocol}://${req.get("host")}`;
    const localUrl = `${host}/uploads/${files.resume[0].filename}`;
    finalResumeUrl = await uploadFileAndGetUrl(files.resume[0], localUrl);
  }

  if (files.workSample?.[0]) {
    const host = `${req.protocol}://${req.get("host")}`;
    const localUrl = `${host}/uploads/${files.workSample[0].filename}`;
    finalWorkSampleUrl = await uploadFileAndGetUrl(files.workSample[0], localUrl);
  }

  gig.applications.push({
    studentId,
    note: note ?? "",
    resumeUrl: finalResumeUrl,
    workSampleUrl: finalWorkSampleUrl
  });

  await gig.save();
  return res.status(201).json(gig.toJSON());
}
);

router.post("/:id/select", async (req, res) => {
  const gig = await Gig.findById(req.params.id);
  if (!gig) return res.status(404).json({ message: "Gig not found" });
  if (gig.hirerId !== req.user.id) return res.status(403).json({ message: "Only gig hirer can select" });

  const { studentId, onchainTxHash } = req.body;
  if (!studentId) return res.status(400).json({ message: "studentId is required" });

  const exists = gig.applications.some((a) => a.studentId === studentId);
  if (!exists) return res.status(400).json({ message: "Selected student has not applied" });

  gig.selectedStudentId = studentId;
  gig.status = "in_progress";
  gig.payment.status = "escrow_locked";
  if (typeof onchainTxHash === "string") gig.payment.selectTxHash = onchainTxHash;

  await gig.save();
  return res.json(gig.toJSON());
});

router.post("/:id/onchain", async (req, res) => {
  const gig = await Gig.findById(req.params.id);
  if (!gig) return res.status(404).json({ message: "Gig not found" });
  if (gig.hirerId !== req.user.id) {
    return res.status(403).json({ message: "Only gig hirer can lock escrow" });
  }

  const { onchainGigId, createTxHash, escrowContractAddress } = req.body;
  if (!onchainGigId) return res.status(400).json({ message: "onchainGigId is required" });

  if (gig.payment.status === "pending") {
    gig.payment.status = "escrow_locked";
  }

  gig.payment.onchainGigId = String(onchainGigId);
  if (typeof createTxHash === "string") gig.payment.createTxHash = createTxHash;
  if (typeof escrowContractAddress === "string") {
    gig.payment.escrowContractAddress = escrowContractAddress;
  }

  await gig.save();
  return res.json(gig.toJSON());
});

router.post("/:id/updates", async (req, res) => {
  const gig = await Gig.findById(req.params.id);
  if (!gig) return res.status(404).json({ message: "Gig not found" });

  const { message } = req.body;
  const studentId = req.user.id;
  if (!message) return res.status(400).json({ message: "message is required" });

  if (gig.selectedStudentId !== studentId) {
    return res.status(403).json({ message: "Only selected student can post updates" });
  }

  gig.updates.push({ actorId: studentId, message });

  await gig.save();
  return res.status(201).json(gig.toJSON());
});

router.post("/:id/feedback", async (req, res) => {
  const gig = await Gig.findById(req.params.id);
  if (!gig) return res.status(404).json({ message: "Gig not found" });

  const { message } = req.body;
  const hirerId = req.user.id;
  if (!message) return res.status(400).json({ message: "message is required" });
  if (gig.hirerId !== hirerId) return res.status(403).json({ message: "Only gig hirer can provide feedback" });

  gig.feedback.push({ actorId: hirerId, message });

  await gig.save();
  return res.status(201).json(gig.toJSON());
});

router.post("/:id/submit", upload.single("deliverable"), async (req, res) => {
  const gig = await Gig.findById(req.params.id);
  if (!gig) return res.status(404).json({ message: "Gig not found" });

  const { deliverableUrl, note, onchainTxHash } = req.body;
  const studentId = req.user.id;
  let finalDeliverableUrl = String(deliverableUrl || "").trim();
  if (req.file) {
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ message: "Only PDF files are allowed for direct submission" });
    }
    const host = `${req.protocol}://${req.get("host")}`;
    const localUrl = `${host}/uploads/${req.file.filename}`;
    finalDeliverableUrl = await uploadFileAndGetUrl(req.file, localUrl);
  }

  if (!finalDeliverableUrl) {
    return res.status(400).json({ message: "deliverableUrl or deliverable file is required" });
  }
  if (gig.selectedStudentId !== studentId) {
    return res.status(403).json({ message: "Only selected student can submit" });
  }

  gig.submissions.push({
    studentId,
    deliverableUrl: finalDeliverableUrl,
    note: note ?? "",
    onchainTxHash: onchainTxHash ?? ""
  });
  gig.status = "submitted";

  await gig.save();
  return res.status(201).json(gig.toJSON());
});

router.post("/:id/accept", async (req, res) => {
  const gig = await Gig.findById(req.params.id);
  if (!gig) return res.status(404).json({ message: "Gig not found" });

  const { releaseTxHash } = req.body;
  const hirerId = req.user.id;
  if (gig.hirerId !== hirerId) return res.status(403).json({ message: "Only hirer can accept submission" });
  if (gig.status !== "submitted") return res.status(400).json({ message: "Gig must be submitted first" });

  gig.status = "completed";
  gig.payment.status = "released_to_student_wallet";
  gig.payment.releasedAt = new Date().toISOString();
  if (typeof releaseTxHash === "string") gig.payment.releaseTxHash = releaseTxHash;

  const student = await User.findById(gig.selectedStudentId);
  if (!student) {
    return res.status(404).json({ message: "Selected student account not found" });
  }

  await applyWalletDelta(student, {
    delta: Number(gig.fee || 0),
    type: "gig_payout",
    note: `Task payment received: ${gig.title}`,
    gigId: gig.id
  });

  await gig.save();
  return res.json(gig.toJSON());
});

router.post("/:id/dispute", async (req, res) => {
  const gig = await Gig.findById(req.params.id);
  if (!gig) return res.status(404).json({ message: "Gig not found" });

  const actorId = req.user.id;
  const { reason, onchainTxHash } = req.body;
  if (!reason) return res.status(400).json({ message: "reason is required" });

  if (gig.hirerId !== actorId && gig.selectedStudentId !== actorId) {
    return res.status(403).json({ message: "Only hirer or selected student can dispute" });
  }

  gig.status = "in_progress";
  gig.payment.status = "disputed";
  gig.payment.dispute = {
    raisedBy: actorId,
    reason,
    raisedAt: new Date().toISOString(),
    onchainTxHash: onchainTxHash || "",
    resolution: "pending"
  };

  await gig.save();
  return res.json(gig.toJSON());
});

router.post("/:id/dispute/resolve", async (req, res) => {
  const gig = await Gig.findById(req.params.id);
  if (!gig) return res.status(404).json({ message: "Gig not found" });
  if (gig.hirerId !== req.user.id) {
    return res.status(403).json({ message: "Only hirer can resolve in this MVP" });
  }

  const { decision, resolveTxHash } = req.body;
  if (!["release_to_student", "refund_to_hirer"].includes(decision)) {
    return res.status(400).json({ message: "decision must be release_to_student or refund_to_hirer" });
  }

  if (decision === "release_to_student") {
    gig.status = "completed";
    gig.payment.status = "released_to_student_wallet";

    const student = await User.findById(gig.selectedStudentId);
    if (!student) {
      return res.status(404).json({ message: "Selected student account not found" });
    }

    await applyWalletDelta(student, {
      delta: Number(gig.fee || 0),
      type: "dispute_release",
      note: `Dispute resolved in student favor: ${gig.title}`,
      gigId: gig.id
    });
  } else {
    gig.status = "cancelled";
    gig.payment.status = "refunded_to_hirer_wallet";
  }

  gig.payment.releasedAt = new Date().toISOString();
  gig.payment.releaseTxHash = resolveTxHash || gig.payment.releaseTxHash;
  gig.payment.dispute = {
    ...(gig.payment.dispute || {}),
    resolution: decision,
    resolvedAt: new Date().toISOString(),
    resolvedBy: req.user.id
  };

  await gig.save();
  return res.json(gig.toJSON());
});

router.delete("/:id", async (req, res) => {
  const gig = await Gig.findById(req.params.id);
  if (!gig) {
    return res.status(404).json({ message: "Gig not found" });
  }

  if (gig.hirerId !== req.user.id) {
    return res.status(403).json({ message: "You can only delete your own tasks" });
  }

  await Message.deleteMany({ gigId: gig.id });
  await Gig.deleteOne({ _id: gig._id });

  return res.json({ message: "Task deleted successfully" });
});

export default router;
