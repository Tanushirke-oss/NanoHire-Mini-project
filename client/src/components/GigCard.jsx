import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function statusMeta(status) {
  if (status === "open") return { label: "Open", stage: "Open for applications" };
  if (status === "in_progress") return { label: "Allotted", stage: "Task is allotted and in progress" };
  if (status === "submitted") return { label: "Submitted", stage: "Submitted and waiting for review" };
  if (status === "completed") return { label: "Completed", stage: "Completed and paid" };
  if (status === "cancelled") return { label: "Cancelled", stage: "Cancelled" };
  return { label: status, stage: status };
}

export default function GigCard({
  gig,
  hirerName = "Unknown Hirer",
  hirerRole = "hirer",
  selectedForCurrentStudent = false,
  onDeleteTask = null
}) {
  const { currentUser } = useAuth();
  const meta = statusMeta(gig.status);
  const canDelete = typeof onDeleteTask === "function" && currentUser?.id === gig.hirerId;
  const showReleasedBadge =
    currentUser?.id === gig.hirerId && gig.payment?.status === "released_to_student_wallet";
  const feeLabel = Number.isFinite(gig.feeMin) && Number.isFinite(gig.feeMax)
    ? `Rs. ${gig.feeMin} - Rs. ${gig.feeMax}`
    : `Rs. ${gig.fee}`;

  const isCompleted = gig.status === "completed";
  const isInProgress = gig.status === "in_progress";

  const cardStyle = {};
  if (isCompleted) cardStyle.backgroundColor = "#dcf5df"; // Stronger pale green
  else if (isInProgress) cardStyle.backgroundColor = "#fff5b8"; // Stronger pale yellow

  const amountReceived = gig.payment?.amount || gig.fee;

  return (
    <article className="gig-card" style={cardStyle}>
      {selectedForCurrentStudent ? <span className="selected-task-pill">Selected For You</span> : null}
      <div className="gig-card-publisher">
        <img 
          src={"https://ui-avatars.com/api/?name=" + hirerName + "&background=random"} 
          alt={hirerName}
          className="publisher-avatar"
        />
        <div className="publisher-info">
          <Link to={`/profile/${gig.hirerId}`} className="publisher-name">{hirerName}</Link>
          <div className="publisher-role">{hirerRole === "hirer" ? "🏢 Hirer" : "👤 Student"}</div>
        </div>
      </div>
      
{isCompleted && (currentUser?.id === gig.hirerId || currentUser?.id === gig.selectedStudentId) ? (
        <div style={{ backgroundColor: "#d4edda", color: "#155724", padding: "10px", borderRadius: "6px", marginBottom: "12px", border: "1px solid #c3e6cb", fontWeight: "bold" }}>
          {currentUser?.id === gig.hirerId 
            ? "Payment was successful"
            : `You received a payment of Rs ${amountReceived}`}
        </div>
      ) : null}

      <div className="gig-card-head">
        <h3>{gig.title}</h3>
        <span className={`status status-${gig.status}`}>{meta.label}</span>
      </div>
      {showReleasedBadge ? <span className="payment-release-pill">Payment Released</span> : null}
      <p className="status-description">{meta.stage}</p>
      <p>{gig.description}</p>
      <div className="chip-list">
        {gig.tags?.map((tag) => (
          <span key={tag} className="chip">
            {tag}
          </span>
        ))}
      </div>
      <div className="gig-meta">
        <strong>💰 Budget: {feeLabel}</strong>
        <span>📅 Deadline: {new Date(gig.deadline).toLocaleString()}</span>
      </div>
      <Link to={`/marketplace/${gig.id}`} className="btn-link">
        View Internship
      </Link>
      {canDelete ? (
        <button
          type="button"
          className="danger-btn task-delete-btn"
          onClick={() => onDeleteTask(gig.id)}
        >
          Delete Task
        </button>
      ) : null}
    </article>
  );
}
