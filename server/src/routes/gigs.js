import express from "express";
import Gig from "../models/Gig.js";
import upload from "../middleware/upload.js";
import { uploadFileAndGetUrl } from "../utils/uploadProvider.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  const gigs = await Gig.find().sort({ createdAt: -1 });
  res.json(gigs.map((g) => g.toJSON()));
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

  if (!title || !description || !fee || !deadline) {
    return res.status(400).json({ message: "title, description, fee, deadline are required" });
  }

  const gig = await Gig.create({
    title,
    description,
    fee: Number(fee),
    deadline,
    hirerId: req.user.id,
    tags: tags ?? []
  });
  return res.status(201).json(gig.toJSON());
});

router.post("/:id/apply", upload.single("resume"), async (req, res) => {
  const gig = await Gig.findById(req.params.id);
  if (!gig) return res.status(404).json({ message: "Gig not found" });
  if (gig.status !== "open") return res.status(400).json({ message: "Gig is not open for applications" });

  const { note, resumeUrl } = req.body;
  const studentId = req.user.id;

  const existing = gig.applications.find((a) => a.studentId === studentId);
  if (existing) {
    return res.status(400).json({ message: "Student already applied" });
  }

  let finalResumeUrl = String(resumeUrl || "").trim();
  if (req.file) {
    const host = `${req.protocol}://${req.get("host")}`;
    const localUrl = `${host}/uploads/${req.file.filename}`;
    finalResumeUrl = await uploadFileAndGetUrl(req.file, localUrl);
  }

  gig.applications.push({
    studentId,
    note: note ?? "",
    resumeUrl: finalResumeUrl
  });

  await gig.save();
  return res.status(201).json(gig.toJSON());
});

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

  const { onchainGigId, createTxHash, escrowContractAddress } = req.body;
  if (!onchainGigId) return res.status(400).json({ message: "onchainGigId is required" });

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

export default router;
