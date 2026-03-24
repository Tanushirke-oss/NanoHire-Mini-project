import { useEffect, useState } from "react";
import { createGig, deleteGig, getGigs, getUser } from "../api";
import GigCard from "../components/GigCard";
import { useAuth } from "../context/AuthContext";

function getDraftKey(userId) {
  return `nanohire_marketplace_draft_${userId || "guest"}`;
}

function getModeKey(userId) {
  return `nanohire_student_hirer_mode_${userId || "guest"}`;
}

function parseBudgetInput(rawFee) {
  const value = String(rawFee || "").trim();
  if (!value) {
    return { valid: false, error: "Budget is required." };
  }

  const rangeMatch = value.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
      return { valid: false, error: "Budget range must contain positive numbers." };
    }
    if (min > max) {
      return { valid: false, error: "Budget range is invalid. Min cannot be greater than max." };
    }
    return { valid: true, capValue: max };
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { valid: false, error: "Budget must be a positive number, or a range like 500-1200." };
  }
  return { valid: true, capValue: numeric };
}

export default function MarketplacePage() {
  const { currentUser } = useAuth();
  const [gigs, setGigs] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [studentHirerMode, setStudentHirerMode] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    fee: "",
    deadline: "",
    tags: ""
  });
  const [formError, setFormError] = useState("");

  async function handleDeleteTask(gigId) {
    const confirmed = window.confirm("Delete this task permanently?");
    if (!confirmed) return;

    try {
      await deleteGig(gigId);
      await loadGigs();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Could not delete task right now.");
    }
  }

  async function loadGigs() {
    const data = await getGigs();
    setGigs(data);
    
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

  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) return;

    try {
      const savedDraft = localStorage.getItem(getDraftKey(userId));
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        setForm((prev) => ({ ...prev, ...parsed }));
      }

      const savedMode = localStorage.getItem(getModeKey(userId));
      if (savedMode === "true") {
        setStudentHirerMode(true);
      }
    } catch (_error) {
      // Ignore invalid persisted values and continue with defaults.
    }
  }, [currentUser?.id]);

  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) return;
    localStorage.setItem(getDraftKey(userId), JSON.stringify(form));
  }, [form, currentUser?.id]);

  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) return;
    localStorage.setItem(getModeKey(userId), String(studentHirerMode));
  }, [studentHirerMode, currentUser?.id]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!currentUser) return;

    const parsedBudget = parseBudgetInput(form.fee);
    const walletBalance = Number(currentUser.walletBalance || 0);

    if (!parsedBudget.valid) {
      setFormError(parsedBudget.error);
      return;
    }

    if (parsedBudget.capValue > walletBalance) {
      setFormError(`Budget cannot exceed your wallet balance of Rs. ${walletBalance}.`);
      return;
    }

    try {
      setFormError("");
      await createGig({
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean)
      });

      setForm({ title: "", description: "", fee: "", deadline: "", tags: "" });
      localStorage.removeItem(getDraftKey(currentUser?.id));
      loadGigs();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Could not post task right now.");
    }
  }

  const isHirer = currentUser?.role === "hirer";
  const canPostTask = isHirer || studentHirerMode;
  const myPostedGigs = gigs.filter((gig) => gig.hirerId === currentUser?.id);
  const openForStudent = gigs.filter((gig) => gig.hirerId !== currentUser?.id && gig.status === "open");
  const selectedForStudent = gigs.filter(
    (gig) => gig.selectedStudentId === currentUser?.id && ["in_progress", "submitted"].includes(gig.status)
  );
  const posterWalletBalance = Number(currentUser?.walletBalance || 0);

  return (
    <section className="page">
      <div className="page-head">
        <h1>{isHirer ? "Hirer Workspace" : "Student Marketplace"}</h1>
        <p>
          {isHirer
            ? "Post internships, evaluate applicants, and run delivery workflows."
            : "Apply to internships, and switch on student hirer mode whenever you want to post your own task."}
        </p>
      </div>

      {!isHirer ? (
        <div className="panel student-hirer-toggle">
          <h2>Student Hirer Option</h2>
          <p>
            If you want to hire someone for your own assignment, enable this and post a paid micro task.
          </p>
          <label className="switch-line">
            <input
              type="checkbox"
              checked={studentHirerMode}
              onChange={(e) => setStudentHirerMode(e.target.checked)}
            />
            <span>I want to post a task and act as hirer for this internship</span>
          </label>
        </div>
      ) : null}

      {canPostTask ? (
        <form className="panel" onSubmit={handleCreate}>
          <h2>{isHirer ? "Post A New Internship" : "Post A Student-Owned Task"}</h2>
          <p className="search-meta">Draft is auto-saved in your browser storage.</p>
          <p className="search-meta">Wallet Balance: Rs. {posterWalletBalance}</p>
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Task title"
            required
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Task description"
            required
          />
          <div className="row">
            <input
              value={form.fee}
              onChange={(e) => setForm((prev) => ({ ...prev, fee: e.target.value }))}
              placeholder="Budget in INR (Rs.) - use 1200 or 500-1200"
              required
            />
            <input
              type="datetime-local"
              value={form.deadline}
              onChange={(e) => setForm((prev) => ({ ...prev, deadline: e.target.value }))}
              required
            />
          </div>
          <input
            value={form.tags}
            onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder="Comma-separated tags (poster, debugging, ppt, software)"
          />
          {formError ? <p className="error-text">{formError}</p> : null}
          <button type="submit">Post Internship</button>
        </form>
      ) : null}

      {!isHirer ? (
        <div className="panel">
          <h2>💡 Suggested Open Tasks (Ready for You)</h2>
          <p className="search-meta">These students and hirers have tasks waiting for talented people like you!</p>
          {openForStudent.length === 0 ? (
            <p className="search-meta">No open tasks available right now. Check back later!</p>
          ) : (
            <div className="gig-list">
              {openForStudent.map((gig) => {
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
      ) : null}

      <div className="panel">
        <h2>📜 All Past & Current Tasks (Full History)</h2>
        <p className="search-meta">View all tasks including completed, in-progress, submitted, and open tasks.</p>
        {gigs.length === 0 ? (
          <p className="search-meta">No tasks found.</p>
        ) : (
          <div className="gig-list">
            {gigs.map((gig) => {
              const hirerInfo = usersMap[gig.hirerId] || {};
              return (
                <GigCard 
                  key={gig.id} 
                  gig={gig}
                  hirerName={hirerInfo.name || "Unknown"}
                  hirerRole={hirerInfo.role || "hirer"}
                />
              );
            })}
          </div>
        )}
      </div>

      {!isHirer ? (
        <div className="panel">
          <h2>Tasks You Got Selected For</h2>
          {selectedForStudent.length === 0 ? (
            <p className="search-meta">You have not been selected for a task yet.</p>
          ) : (
            <div className="gig-list">
              {selectedForStudent.map((gig) => {
                const hirerInfo = usersMap[gig.hirerId] || {};
                return (
                  <GigCard
                    key={gig.id}
                    gig={gig}
                    hirerName={hirerInfo.name || "Unknown"}
                    hirerRole={hirerInfo.role || "hirer"}
                    selectedForCurrentStudent
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {isHirer ? (
        <div className="panel">
          <h2>Tasks You Posted</h2>
          {myPostedGigs.length === 0 ? (
            <p className="search-meta">You haven't posted any tasks yet.</p>
          ) : (
            <div className="gig-list">
              {myPostedGigs.map((gig) => {
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
      ) : null}

      {!isHirer ? (
        <div className="panel">
          <h2>Your Posted Tasks (as Student Hirer)</h2>
          {myPostedGigs.length === 0 ? (
            <p className="search-meta">You haven't posted any tasks as a student hirer yet.</p>
          ) : (
            <div className="gig-list">
              {myPostedGigs.map((gig) => {
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
      ) : null}
    </section>
  );
}
