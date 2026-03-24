import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteGig, getGigs, getUser } from "../api";
import GigCard from "../components/GigCard";
import TaskTimer from "../components/TaskTimer";
import MotivationalMessage from "../components/MotivationalMessage";
import { useAuth } from "../context/AuthContext";

const SEARCH_TEXT_KEY = "nanohire_tasks_search_text";
const SEARCH_STATUS_KEY = "nanohire_tasks_status_filter";
const RECENT_SEARCHES_KEY = "nanohire_tasks_recent_searches";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "Allotted" },
  { value: "submitted", label: "Submitted" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" }
];

function sortByRecent(items) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.createdAt || a.updatedAt || a.deadline).getTime();
    const bTime = new Date(b.createdAt || b.updatedAt || b.deadline).getTime();
    return bTime - aTime;
  });
}

export default function TasksPage() {
  const { currentUser } = useAuth();
  const [gigs, setGigs] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [searchText, setSearchText] = useState(() => localStorage.getItem(SEARCH_TEXT_KEY) || "");
  const [statusFilter, setStatusFilter] = useState(() => localStorage.getItem(SEARCH_STATUS_KEY) || "all");
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  });

  async function loadGigs() {
    const data = await getGigs();
    setGigs(sortByRecent(data));
    
    // Load user details for each hirer
    const users = {};
    for (const gig of data) {
      if (!users[gig.hirerId]) {
        try {
          const user = await getUser(gig.hirerId);
          users[gig.hirerId] = user;
        } catch (err) {
          console.error("Failed to load user:", err);
        }
      }
    }
    setUsersMap(users);
  }

  useEffect(() => {
    loadGigs();
  }, []);

  async function handleDeleteTask(gigId) {
    const confirmed = window.confirm("Delete this task permanently?");
    if (!confirmed) return;

    try {
      await deleteGig(gigId);
      await loadGigs();
    } catch (error) {
      console.error("Delete task failed:", error);
    }
  }

  useEffect(() => {
    localStorage.setItem(SEARCH_TEXT_KEY, searchText);
  }, [searchText]);

  useEffect(() => {
    localStorage.setItem(SEARCH_STATUS_KEY, statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
  }, [recentSearches]);

  function commitSearch(term) {
    const normalized = term.trim().toLowerCase();
    if (!normalized) {
      setHasSearched(false);
      return;
    }

    setHasSearched(true);

    setRecentSearches((prev) => {
      const withoutDupes = prev.filter((entry) => entry !== normalized);
      return [normalized, ...withoutDupes].slice(0, 8);
    });
  }

  const filteredTasks = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return gigs.filter((gig) => {
      const statusMatch = statusFilter === "all" || gig.status === statusFilter;
      if (!statusMatch) return false;

      if (!query) return true;

      const haystack = [gig.title, gig.description, ...(gig.tags || [])]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [gigs, searchText, statusFilter]);

  const selectedForStudent = useMemo(() => {
    if (currentUser?.role !== "student") return [];
    return gigs.filter(
      (gig) => gig.selectedStudentId === currentUser.id && ["in_progress", "submitted"].includes(gig.status)
    );
  }, [gigs, currentUser?.id, currentUser?.role]);

  const appliedButNotSelected = useMemo(() => {
    if (currentUser?.role !== "student") return [];

    return gigs.filter((gig) => {
      const hasApplied = (gig.applications || []).some((a) => a.studentId === currentUser.id);
      return hasApplied && !!gig.selectedStudentId && gig.selectedStudentId !== currentUser.id;
    });
  }, [gigs, currentUser?.id, currentUser?.role]);

  return (
    <section className="page tasks-page">
      <div className="tasks-hero">
        <div>
          <h1>Task Explorer</h1>
          <p>
            Browse every internship in one place. Newest tasks appear first, and you can search by skills,
            titles, or keywords like "ppt making".
          </p>
        </div>
        <Link to="/marketplace" className="tasks-cta-link">
          Post Or Manage Tasks
        </Link>
      </div>

      <div className="panel task-search-panel">
        <h2>Search Tasks</h2>
        <div className="search-input-row">
          <input
            value={searchText}
            onChange={(e) => {
              const value = e.target.value;
              setSearchText(value);
              if (!value.trim()) {
                setHasSearched(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitSearch(searchText);
              }
            }}
            placeholder="Search tasks... (example: ppt making, debugging, design)"
          />
          <button type="button" className="secondary-btn" onClick={() => commitSearch(searchText)}>
            Remember
          </button>
        </div>
        {recentSearches.length > 0 ? (
          <div className="recent-searches">
            {recentSearches.map((term) => (
              <button
                type="button"
                className="search-pill"
                key={term}
                onClick={() => setSearchText(term)}
              >
                {term}
              </button>
            ))}
          </div>
        ) : null}
        <div className="status-filter-row">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={statusFilter === option.value ? "status-filter active" : "status-filter"}
              onClick={() => setStatusFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="search-meta">Showing {filteredTasks.length} task(s)</p>
      </div>

      {currentUser?.role === "student" ? (
        <div className="panel">
          <h2>⭐ Tasks You Got Selected For</h2>
          {selectedForStudent.length === 0 ? (
            <p className="search-meta">You are not selected for any task yet. Keep applying!</p>
          ) : (
            <>
              <MotivationalMessage isSelected={true} />
              <div className="gig-list animated-list">
                {selectedForStudent.map((gig) => {
                  const hirerInfo = usersMap[gig.hirerId] || {};
                  return (
                    <div key={gig.id} className="gig-card-with-timer">
                      <TaskTimer deadline={gig.deadline} />
                      <GigCard
                        gig={gig}
                        hirerName={hirerInfo.name || "Unknown"}
                        hirerRole={hirerInfo.role || "hirer"}
                        selectedForCurrentStudent
                        onDeleteTask={handleDeleteTask}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : null}

      {currentUser?.role === "student" && appliedButNotSelected.length > 0 ? (
        <div className="panel">
          <h2>🌱 Keep Going: Applied But Not Selected Yet</h2>
          <MotivationalMessage isSelected={false} />
          <div className="gig-list animated-list">
            {appliedButNotSelected.map((gig) => {
              const hirerInfo = usersMap[gig.hirerId] || {};
              return (
                <GigCard
                  key={gig.id}
                  gig={gig}
                  hirerName={hirerInfo.name || "Unknown"}
                  hirerRole={hirerInfo.role || "hirer"}
                  selectedForCurrentStudent={false}
                  onDeleteTask={handleDeleteTask}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {hasSearched ? (
        <div className="panel">
          <h2>All Matching Tasks</h2>
          {filteredTasks.length === 0 ? (
            <p className="search-meta">No tasks found for this search.</p>
          ) : (
            <div className="gig-list animated-list">
              {filteredTasks.map((gig) => {
                const hirerInfo = usersMap[gig.hirerId] || {};
                return (
                  <GigCard 
                    key={gig.id} 
                    gig={gig}
                    hirerName={hirerInfo.name || "Unknown"}
                    hirerRole={hirerInfo.role || "hirer"}
                    selectedForCurrentStudent={gig.selectedStudentId === currentUser?.id}
                    onDeleteTask={handleDeleteTask}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
