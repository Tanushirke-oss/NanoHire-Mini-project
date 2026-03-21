import { Link } from "react-router-dom";

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
  selectedForCurrentStudent = false
}) {
  const meta = statusMeta(gig.status);

  return (
    <article className="gig-card">
      {selectedForCurrentStudent ? <span className="selected-task-pill">Selected For You</span> : null}
      <div className="gig-card-publisher">
        <img 
          src={"https://ui-avatars.com/api/?name=" + hirerName + "&background=random"} 
          alt={hirerName}
          className="publisher-avatar"
        />
        <div className="publisher-info">
          <div className="publisher-name">{hirerName}</div>
          <div className="publisher-role">{hirerRole === "hirer" ? "🏢 Hirer" : "👤 Student"}</div>
        </div>
      </div>
      <div className="gig-card-head">
        <h3>{gig.title}</h3>
        <span className={`status status-${gig.status}`}>{meta.label}</span>
      </div>
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
        <strong>💰 Fee: Rs. {gig.fee}</strong>
        <span>📅 Deadline: {new Date(gig.deadline).toLocaleString()}</span>
      </div>
      <Link to={`/marketplace/${gig.id}`} className="btn-link">
        View Internship
      </Link>
    </article>
  );
}
