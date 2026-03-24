import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GigCard from "../components/GigCard";
import { deleteGig, getGigs, getUser } from "../api";
import { useAuth } from "../context/AuthContext";

const HISTORY_STATUSES = new Set(["submitted", "completed", "cancelled"]);

function sortByRecent(items) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || a.deadline).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || b.deadline).getTime();
    return bTime - aTime;
  });
}

export default function HistoryPage() {
  const { currentUser } = useAuth();
  const [gigs, setGigs] = useState([]);
  const [usersMap, setUsersMap] = useState({});

  useEffect(() => {
    async function loadHistory() {
      const data = await getGigs();
      setGigs(sortByRecent(data));

      const nextUsers = {};
      await Promise.all(
        data.map(async (gig) => {
          if (nextUsers[gig.hirerId]) return;
          try {
            nextUsers[gig.hirerId] = await getUser(gig.hirerId);
          } catch (_error) {
            nextUsers[gig.hirerId] = null;
          }
        })
      );

      setUsersMap(nextUsers);
    }

    loadHistory();
  }, []);

  async function handleDeleteTask(gigId) {
    const confirmed = window.confirm("Delete this task permanently?");
    if (!confirmed) return;

    try {
      await deleteGig(gigId);
      const data = await getGigs();
      setGigs(sortByRecent(data));
    } catch (error) {
      console.error("Delete task failed:", error);
    }
  }

  const studentWorkedHistory = useMemo(() => {
    if (!currentUser?.id) return [];
    return gigs.filter(
      (gig) => gig.selectedStudentId === currentUser.id && HISTORY_STATUSES.has(gig.status)
    );
  }, [gigs, currentUser?.id]);

  const hirerPostedHistory = useMemo(() => {
    if (!currentUser?.id) return [];
    return gigs.filter((gig) => gig.hirerId === currentUser.id && HISTORY_STATUSES.has(gig.status));
  }, [gigs, currentUser?.id]);

  const isStudent = currentUser?.role === "student";

  return (
    <section className="page history-page">
      <div className="history-hero panel">
        <div>
          <h1>{isStudent ? "Work History" : "Posted Task History"}</h1>
          <p>
            {isStudent
              ? "Past tasks where you were selected and completed or submitted work."
              : "Past tasks you posted and their final progress states."}
          </p>
        </div>
        <Link to="/tasks" className="tasks-cta-link">Go To Tasks</Link>
      </div>

      {isStudent ? (
        <div className="panel">
          <h2>Tasks You Worked On</h2>
          {studentWorkedHistory.length === 0 ? (
            <p className="search-meta">No past worked tasks yet.</p>
          ) : (
            <div className="gig-list">
              {studentWorkedHistory.map((gig) => {
                const hirerInfo = usersMap[gig.hirerId] || {};
                return (
                  <GigCard
                    key={gig.id}
                    gig={gig}
                    hirerName={hirerInfo.name || "Unknown"}
                    hirerRole={hirerInfo.role || "hirer"}
                    selectedForCurrentStudent
                    onDeleteTask={handleDeleteTask}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="panel">
          <h2>Tasks You Posted In The Past</h2>
          {hirerPostedHistory.length === 0 ? (
            <p className="search-meta">No posted task history yet.</p>
          ) : (
            <div className="gig-list">
              {hirerPostedHistory.map((gig) => {
                const hirerInfo = usersMap[gig.hirerId] || {};
                return (
                  <GigCard
                    key={gig.id}
                    gig={gig}
                    hirerName={hirerInfo.name || "Unknown"}
                    hirerRole={hirerInfo.role || "hirer"}
                    onDeleteTask={handleDeleteTask}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
