import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  acceptGig,
  applyGig,
  getGig,
  getUser,
  postFeedback,
  postUpdate,
  raiseDispute,
  resolveDispute,
  setGigOnchain,
  selectApplicant,
  submitGig
} from "../api";
import { useAuth } from "../context/AuthContext";
import {
  acceptAndReleaseOnchain,
  createOnchainGigTransaction,
  raiseDisputeOnchain,
  resolveDisputeOnchain,
  selectStudentOnchain,
  submitWorkOnchain
} from "../contracts/escrow";

export default function GigDetailPage() {
  const { gigId } = useParams();
  const { currentUser, users } = useAuth();
  const [gig, setGig] = useState(null);
  const [applyNote, setApplyNote] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [workSampleFile, setWorkSampleFile] = useState(null);
  const [updateText, setUpdateText] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [deliverableFile, setDeliverableFile] = useState(null);
  const [submissionNote, setSubmissionNote] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [chainMessage, setChainMessage] = useState("");
  const [chainBusy, setChainBusy] = useState(false);
  const [applicantMap, setApplicantMap] = useState({});
  const [hirerInfo, setHirerInfo] = useState(null);

  async function loadGig() {
    const data = await getGig(gigId);
    setGig(data);
    
    // Load hirer details
    try {
      const hirer = await getUser(data.hirerId);
      setHirerInfo(hirer);
    } catch (err) {
      console.error("Failed to load hirer:", err);
    }
    
    // Load applicant details
    const applicants = {};
    for (const app of (data.applications || [])) {
      if (!applicants[app.studentId]) {
        try {
          const student = await getUser(app.studentId);
          applicants[app.studentId] = student;
        } catch (err) {
          console.error("Failed to load applicant:", err);
        }
      }
    }
    setApplicantMap(applicants);
  }

  useEffect(() => {
    loadGig();
  }, [gigId]);

  const isHirer = useMemo(() => gig && currentUser?.id === gig.hirerId, [gig, currentUser]);
  const isSelectedStudent = useMemo(
    () => gig && currentUser?.id === gig.selectedStudentId,
    [gig, currentUser]
  );
  const hasApplied = useMemo(
    () => gig?.applications?.some((a) => a.studentId === currentUser?.id),
    [gig, currentUser]
  );

  if (!gig) return <section className="page">Loading internship...</section>;

  const feeLabel = Number.isFinite(gig.feeMin) && Number.isFinite(gig.feeMax)
    ? `Rs. ${gig.feeMin} - Rs. ${gig.feeMax}`
    : `Rs. ${gig.fee}`;

  async function handleApply() {
    if (!currentUser) return;
    await applyGig(gig.id, {
      note: applyNote,
      resumeUrl: currentUser.resumeUrl || "",
      resumeFile,
      workSampleFile
    });
    setApplyNote("");
    setResumeFile(null);
    setWorkSampleFile(null);
    await loadGig();
  }

  async function handleSelect(studentId) {
    try {
      let onchainTxHash = "";

      if (gig.payment?.onchainGigId) {
        setChainBusy(true);
        setChainMessage("Sending select-student transaction...");
        const tx = await selectStudentOnchain({
          onchainGigId: gig.payment.onchainGigId,
          studentWalletAddress: ""
        });
        onchainTxHash = tx.txHash;
        setChainMessage(`Select transaction mined: ${tx.txHash}`);
      }

      await selectApplicant(gig.id, { studentId, onchainTxHash });
      loadGig();
    } catch (error) {
      setChainMessage(error.message || "Failed to select student.");
    } finally {
      setChainBusy(false);
    }
  }

  async function handleUpdate() {
    if (!currentUser) return;
    await postUpdate(gig.id, { studentId: currentUser.id, message: updateText });
    setUpdateText("");
    loadGig();
  }

  async function handleFeedback() {
    if (!currentUser) return;
    await postFeedback(gig.id, { hirerId: currentUser.id, message: feedbackText });
    setFeedbackText("");
    loadGig();
  }

  async function handleSubmitWork() {
    if (!currentUser) return;
    if (!deliverableUrl.trim() && !deliverableFile) {
      setChainMessage("Add a deliverable URL or upload a PDF file before submitting.");
      return;
    }

    try {
      let onchainTxHash = "";
      if (gig.payment?.onchainGigId) {
        setChainBusy(true);
        setChainMessage("Submitting work on-chain...");
        const tx = await submitWorkOnchain({ onchainGigId: gig.payment.onchainGigId });
        onchainTxHash = tx.txHash;
        setChainMessage(`Submit transaction mined: ${tx.txHash}`);
      }

      await submitGig(gig.id, {
        studentId: currentUser.id,
        deliverableUrl,
        deliverableFile,
        note: submissionNote,
        onchainTxHash
      });
      setDeliverableUrl("");
      setDeliverableFile(null);
      setSubmissionNote("");
      loadGig();
    } catch (error) {
      setChainMessage(error.message || "Failed to submit work.");
    } finally {
      setChainBusy(false);
    }
  }

  async function handleCreateEscrow() {
    try {
      setChainBusy(true);
      setChainMessage("Creating escrow transaction on-chain...");
      const txResult = await createOnchainGigTransaction({
        fee: gig.fee,
        deadline: gig.deadline
      });

      await setGigOnchain(gig.id, txResult);
      setChainMessage(`Escrow created on-chain. Gig ID: ${txResult.onchainGigId}`);
      await loadGig();
    } catch (error) {
      setChainMessage(error.message || "Escrow transaction failed.");
    } finally {
      setChainBusy(false);
    }
  }

  async function handleAccept() {
    if (!currentUser) return;

    try {
      let releaseTxHash = "";
      if (gig.payment?.onchainGigId) {
        setChainBusy(true);
        setChainMessage("Accepting and releasing payment on-chain...");
        const tx = await acceptAndReleaseOnchain({ onchainGigId: gig.payment.onchainGigId });
        releaseTxHash = tx.txHash;
        setChainMessage(`Release transaction mined: ${tx.txHash}`);
      }

      await acceptGig(gig.id, { hirerId: currentUser.id, releaseTxHash });
      loadGig();
    } catch (error) {
      setChainMessage(error.message || "Failed to release payment.");
    } finally {
      setChainBusy(false);
    }
  }

  async function handleRaiseDispute() {
    if (!disputeReason.trim()) {
      setChainMessage("Please add a dispute reason.");
      return;
    }

    try {
      let onchainTxHash = "";
      if (gig.payment?.onchainGigId) {
        setChainBusy(true);
        setChainMessage("Raising dispute on-chain...");
        const tx = await raiseDisputeOnchain({ onchainGigId: gig.payment.onchainGigId });
        onchainTxHash = tx.txHash;
      }

      await raiseDispute(gig.id, { reason: disputeReason, onchainTxHash });
      setDisputeReason("");
      setChainMessage("Dispute raised.");
      await loadGig();
    } catch (error) {
      setChainMessage(error.message || "Failed to raise dispute.");
    } finally {
      setChainBusy(false);
    }
  }

  async function handleResolveDispute(decision) {
    try {
      let resolveTxHash = "";
      if (gig.payment?.onchainGigId) {
        setChainBusy(true);
        setChainMessage("Resolving dispute on-chain...");
        const tx = await resolveDisputeOnchain({
          onchainGigId: gig.payment.onchainGigId,
          releaseToStudent: decision === "release_to_student"
        });
        resolveTxHash = tx.txHash;
      }

      await resolveDispute(gig.id, { decision, resolveTxHash });
      await loadGig();
      setChainMessage("Dispute resolved.");
    } catch (error) {
      setChainMessage(error.message || "Failed to resolve dispute.");
    } finally {
      setChainBusy(false);
    }
  }

  return (
    <section className="page gig-detail">
      <div className="panel gig-header-panel">
        <div className="gig-header-info">
          <h1>{gig.title}</h1>
          {hirerInfo && (
            <div className="hirer-card">
              <img 
                src={"https://ui-avatars.com/api/?name=" + hirerInfo.name + "&background=random"} 
                alt={hirerInfo.name}
              />
              <div>
                <Link to={`/profile/${gig.hirerId}`} className="hirer-name">{hirerInfo.name}</Link>
                <div className="hirer-role">🏢 Hirer</div>
              </div>
            </div>
          )}
        </div>
        <p>{gig.description}</p>
        <div className="gig-meta">
          <strong>💰 Budget: {feeLabel}</strong>
          <span>📅 Deadline: {new Date(gig.deadline).toLocaleString()}</span>
          <span>📊 Status: {gig.status}</span>
          {gig.payment?.onchainGigId ? <span>⛓️ On-chain ID: {gig.payment.onchainGigId}</span> : null}
        </div>
        {isHirer && gig.status === "open" && !gig.payment?.onchainGigId ? (
          <button onClick={handleCreateEscrow} disabled={chainBusy} className="primary-btn">
            🔒 Lock Escrow On Chain
          </button>
        ) : null}
        {chainMessage ? <p className="chain-status">{chainMessage}</p> : null}
      </div>

      <div className="split-grid">
        <div className="panel applications-panel">
          <h2>👥 Applications ({gig.applications.length})</h2>
          {gig.applications.length === 0 ? <p>No applications yet.</p> : null}
          {gig.applications.map((application) => {
            const student = applicantMap[application.studentId];
            const isSelected = gig.selectedStudentId === application.studentId;
            return (
              <div key={application.id} className={`application-card ${isSelected ? 'selected' : ''}`}>
                <div className="student-header">
                  <img
                    src={"https://ui-avatars.com/api/?name=" + (student?.name || "Student") + "&background=random"}
                    alt={student?.name || "Student"}
                  />
                  <div className="student-info">
                    <Link to={`/profile/${application.studentId}`} className="student-name-link">
                      {student?.name || "View Student Profile"}
                    </Link>
                    {student?.email ? <div className="student-email">{student.email}</div> : null}
                    {student?.resumeUrl ? (
                      <a href={student.resumeUrl} target="_blank" rel="noreferrer" className="resume-link">
                        📄 View Resume
                      </a>
                    ) : null}
                    {application.resumeUrl ? (
                      <a href={application.resumeUrl} target="_blank" rel="noreferrer" className="resume-link">
                        📎 Resume from application
                      </a>
                    ) : null}
                    {application.workSampleUrl ? (
                      <a href={application.workSampleUrl} target="_blank" rel="noreferrer" className="resume-link">
                        🧩 Work sample attachment
                      </a>
                    ) : null}
                  </div>
                </div>
                {isSelected && (
                  <div className="selection-badge">✅ Selected</div>
                )}
                <p className="application-note">{application.note || "No note provided"}</p>
                <time>{new Date(application.createdAt).toLocaleString()}</time>
                {isHirer ? (
                  <div className="application-actions">
                    {gig.status === "open" ? (
                      <button
                        onClick={() => handleSelect(application.studentId)}
                        disabled={chainBusy}
                        className="select-btn"
                      >
                        {isSelected ? "✓ Selected" : "Select Student"}
                      </button>
                    ) : null}
                    <Link to={`/messages/${gig.id}/${application.studentId}`} className="message-link-btn">
                      Chat with Student
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })}

          {!isHirer && gig.status === "open" && !hasApplied ? (
            <div className="action-box apply-box">
              <h3>Apply for this internship</h3>
              <textarea
                placeholder="Why should you be selected?"
                value={applyNote}
                onChange={(e) => setApplyNote(e.target.value)}
              />
              <div className="file-input-group">
                <label htmlFor="resume-upload">📄 Upload Resume (Optional)</label>
                <input
                  id="resume-upload"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                />
                {resumeFile && <span className="file-name">{resumeFile.name}</span>}
              </div>
              <div className="file-input-group">
                <label htmlFor="work-sample-upload">🧩 Attach Work Sample (Optional)</label>
                <input
                  id="work-sample-upload"
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setWorkSampleFile(e.target.files?.[0] || null)}
                />
                {workSampleFile ? <span className="file-name">{workSampleFile.name}</span> : null}
              </div>
              <button onClick={handleApply} className="primary-btn">✨ Apply For Internship</button>
            </div>
          ) : hasApplied && !isSelectedStudent ? (
            <div className="applied-chip">✓ You have applied</div>
          ) : isSelectedStudent ? (
            <div className="selection-banner">
              🎉 <strong>Congratulations! You have been selected for this internship!</strong>
            </div>
          ) : null}
        </div>

        <div className="panel">
          <h2>📈 Progress Thread</h2>
          {gig.updates.map((u) => {
            const student = applicantMap[u.studentId];
            return (
              <div key={u.id} className="timeline-item">
                {student && (
                  <div className="message-author">
                    <img 
                      src={"https://ui-avatars.com/api/?name=" + student.name + "&background=random"} 
                      alt={student.name}
                    />
                    <Link to={`/profile/${student.id}`} className="student-name-link">{student.name}</Link>
                  </div>
                )}
                <p>{u.message}</p>
                <time>{new Date(u.createdAt).toLocaleString()}</time>
              </div>
            );
          })}
          {gig.feedback.map((f) => (
            <div key={f.id} className="timeline-item feedback">
              <div className="message-author">
                <strong>🏢 Hirer Feedback</strong>
              </div>
              <p>{f.message}</p>
              <time>{new Date(f.createdAt).toLocaleString()}</time>
            </div>
          ))}

          {isSelectedStudent && gig.status === "in_progress" ? (
            <div className="action-box">
              <textarea
                placeholder="Post progress update"
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
              />
              <button onClick={handleUpdate} className="primary-btn">Send Update</button>
            </div>
          ) : null}

          {isHirer && gig.status === "in_progress" ? (
            <div className="action-box">
              <textarea
                placeholder="Share feedback or requested changes"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
              />
              <button onClick={handleFeedback} className="primary-btn">Send Feedback</button>
            </div>
          ) : null}
        </div>
        {!isHirer ? (
          <Link to={`/messages/${gig.id}/${gig.hirerId}`} className="message-link-btn">
            Message Hirer
          </Link>
        ) : null}
      </div>

      <div className="panel submission-panel">
        <h2>📤 Submission And Acceptance</h2>
        {gig.submissions.map((s) => {
          const student = applicantMap[s.studentId];
          return (
            <div key={s.id} className="submission-item">
              {student && (
                <div className="submission-student">
                  <img 
                    src={"https://ui-avatars.com/api/?name=" + student.name + "&background=random"} 
                    alt={student.name}
                  />
                  <Link to={`/profile/${student.id}`} className="student-name-link">{student.name}</Link>
                </div>
              )}
              <p>
                <strong>Submitted:</strong> <a href={s.deliverableUrl} target="_blank" rel="noreferrer">{s.deliverableUrl}</a>
              </p>
              <p>{s.note}</p>
            </div>
          );
        })}

        {isSelectedStudent && gig.status === "in_progress" ? (
          <div className="action-box">
            <input
              placeholder="Deliverable URL (Drive/GitHub/Figma)"
              value={deliverableUrl}
              onChange={(e) => setDeliverableUrl(e.target.value)}
            />
            <div className="file-input-group">
              <label htmlFor="task-deliverable-file">Upload PDF Deliverable (Optional)</label>
              <input
                id="task-deliverable-file"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setDeliverableFile(e.target.files?.[0] || null)}
              />
              {deliverableFile ? <span className="file-name">{deliverableFile.name}</span> : null}
            </div>
            <textarea
              placeholder="Submission note"
              value={submissionNote}
              onChange={(e) => setSubmissionNote(e.target.value)}
            />
            <button onClick={handleSubmitWork} disabled={chainBusy} className="primary-btn">
              ✅ Submit Completed Work
            </button>
          </div>
        ) : null}

        {isHirer && gig.status === "submitted" ? (
          <button onClick={handleAccept} disabled={chainBusy} className="primary-btn success-btn">
            ✓ Accept Work And Release Payment
          </button>
        ) : null}

        {(isHirer || isSelectedStudent) && ["in_progress", "submitted"].includes(gig.status) ? (
          <div className="action-box">
            <textarea
              placeholder="Raise dispute reason"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
            />
            <button onClick={handleRaiseDispute} disabled={chainBusy} className="danger-btn">
              ⚠️ Raise Dispute
            </button>
          </div>
        ) : null}

        {isHirer && gig.payment?.status === "disputed" ? (
          <div className="dispute-actions">
            <button onClick={() => handleResolveDispute("release_to_student")} disabled={chainBusy} className="primary-btn">
              Release To Student
            </button>
            <button onClick={() => handleResolveDispute("refund_to_hirer")} disabled={chainBusy} className="secondary-btn">
              Refund To Hirer
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
