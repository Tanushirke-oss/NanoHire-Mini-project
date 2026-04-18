import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getDeveloperStats } from "../api";

export default function DeveloperConsole() {
  const { currentUser, users } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const developerUsers = (Array.isArray(users) ? users : []).slice().sort((a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || ""))
  );

  async function fetchStats() {
    if (!currentUser?.id || currentUser?.email !== "tanu.shirke06@gmail.com") return;

    try {
      setLoading(true);
      setError("");
      const data = await getDeveloperStats();
      setStats(data);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load developer stats");
      if (err?.response?.status === 401) {
        // Stop polling if unauthorized
        setIsOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (currentUser?.email !== "tanu.shirke06@gmail.com" || !isOpen) return undefined;

    fetchStats();
    const interval = setInterval(fetchStats, 5000);

    return () => clearInterval(interval);
  }, [currentUser?.email, currentUser?.id, isOpen]);

  if (currentUser?.email !== "tanu.shirke06@gmail.com") {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="developer-console-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? "Close Dev Console" : "Open Dev Console"}
      </button>

      {isOpen ? (
        <div className="developer-console">
          <div className="dev-header">
            <h2>Developer Console</h2>
            <button type="button" onClick={fetchStats} disabled={loading} className="refresh-btn">
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {error ? <div className="dev-error">{error}</div> : null}

          {stats ? (
            <div className="dev-stats">
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Users Online</div>
                  <div className="stat-value">{stats.totalUsers}</div>
                  <div className="stat-detail">H: {stats.totalHirers} | S: {stats.totalStudents}</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Total Tasks</div>
                  <div className="stat-value">{stats.totalTasks}</div>
                  <div className="stat-detail">Created platform-wide</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Open Tasks</div>
                  <div className="stat-value">{stats.totalOpenTasks}</div>
                  <div className="stat-detail">Awaiting applications</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Allotted Tasks</div>
                  <div className="stat-value">{stats.totalAllottedTasks}</div>
                  <div className="stat-detail">In progress</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Pending Review</div>
                  <div className="stat-value">{stats.totalSubmittedTasks}</div>
                  <div className="stat-detail">Submitted by student</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Completed Tasks</div>
                  <div className="stat-value">{stats.totalCompletedTasks}</div>
                  <div className="stat-detail">Paid out</div>
                </div>

                <div className="stat-card highlight">
                  <div className="stat-label">Total Transactions</div>
                  <div className="stat-value">₹{stats.totalTransactionAmount}</div>
                  <div className="stat-detail">Completed payments</div>
                </div>
              </div>

              <div className="console-info">
                <p>Last update: {new Date(stats.timestamp).toLocaleString()}</p>
                <p>Auto-refresh runs every 5 seconds while this panel is open.</p>
              </div>

              <div className="dev-users-panel">
                <h3>All Users ({developerUsers.length})</h3>
                <div className="dev-users-list">
                  {developerUsers.length === 0 ? (
                    <p>No users found.</p>
                  ) : (
                    developerUsers.map((user) => (
                      <div key={user.id} className="dev-user-row">
                        <strong>{user.name || "Unnamed user"}</strong>
                        <span>{user.role || "unknown"}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="console-info">
              <p>Click Refresh to load developer stats.</p>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
