import { useEffect, useState } from "react";
import { getUser, updateUser, updateUserWallet, uploadUserFiles } from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";

const SKILL_SUGGESTIONS = [
  "React",
  "Node.js",
  "Express",
  "MongoDB",
  "JavaScript",
  "TypeScript",
  "Solidity",
  "Web3",
  "Ethers.js",
  "UI/UX",
  "Figma",
  "Data Analysis",
  "Content Writing",
  "Digital Marketing",
  "Video Editing"
];

function normalizeSkills(rawSkills = []) {
  return Array.from(new Set(rawSkills.map((skill) => String(skill).trim()).filter(Boolean)));
}

function parseSkillsText(skillsText = "") {
  return normalizeSkills(skillsText.split(/[\n,]/g));
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { currentUser, setUsers, deleteAccount } = useAuth();
  const viewingOwnProfile = !userId || userId === currentUser?.id;
  const [publicProfile, setPublicProfile] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [form, setForm] = useState({
    name: "",
    role: "student",
    bio: "",
    portfolioUrl: "",
    resumeUrl: "",
    projectsText: "",
    skillsText: ""
  });
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [customSkillInput, setCustomSkillInput] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [portfolioFile, setPortfolioFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [isEditingPublicWallet, setIsEditingPublicWallet] = useState(false);
  const [publicWalletDraft, setPublicWalletDraft] = useState("");
  const [publicWalletStatus, setPublicWalletStatus] = useState("");
  const [savingPublicWallet, setSavingPublicWallet] = useState(false);
  const [ownWalletBalance, setOwnWalletBalance] = useState(0);
  const [ownWalletTransactions, setOwnWalletTransactions] = useState([]);
  const walletHistory = ownWalletTransactions
    .filter((entry) => Boolean(String(entry?.gigId || "").trim()) && entry?.type !== "developer-adjustment")
    .slice()
    .reverse();
  const shownWalletBalance = ownWalletBalance;
  const isDeveloper = currentUser?.email === "tanu.shirke06@gmail.com";

  useEffect(() => {
    async function loadProfile() {
      if (!currentUser?.id) return;

      if (!viewingOwnProfile && userId) {
        const user = await getUser(userId);
        setPublicProfile(user);
        setPublicWalletDraft(
          Number.isFinite(Number(user.walletBalance)) ? String(Number(user.walletBalance)) : ""
        );
        setIsEditingPublicWallet(false);
        setPublicWalletStatus("");
        return;
      }

      const user = await getUser(currentUser.id);
      setOwnWalletBalance(Number(user.walletBalance || 0));
      setOwnWalletTransactions(Array.isArray(user.walletTransactions) ? user.walletTransactions : []);
      setForm({
        name: user.name ?? "",
        role: user.role ?? "student",
        bio: user.bio ?? "",
        portfolioUrl: user.portfolioUrl ?? "",
        resumeUrl: user.resumeUrl ?? "",
        projectsText: (user.projects ?? []).join("\n"),
        skillsText: (user.skills ?? []).join(", ")
      });
      setSelectedSkills(normalizeSkills(user.skills ?? []));
    }

    loadProfile();
  }, [currentUser?.id, userId, viewingOwnProfile]);

  async function handleSave(e) {
    e.preventDefault();
    if (!currentUser?.id) return;
    setStatusMessage("Saving profile...");

    const typedSkills = parseSkillsText(form.skillsText);
    const skills = normalizeSkills([...selectedSkills, ...typedSkills]);

    let updated = await updateUser(currentUser.id, {
      ...form,
      skills,
      projects: form.projectsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    });

    if (resumeFile || portfolioFile) {
      updated = await uploadUserFiles(currentUser.id, {
        resume: resumeFile,
        portfolio: portfolioFile
      });
    }

    setOwnWalletBalance(Number(updated.walletBalance || 0));
    setOwnWalletTransactions(Array.isArray(updated.walletTransactions) ? updated.walletTransactions : []);

    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setStatusMessage("Profile saved successfully.");
    setResumeFile(null);
    setPortfolioFile(null);
    setForm((prev) => ({ ...prev, skillsText: skills.join(", ") }));
    setSelectedSkills(skills);
  }

  function toggleSuggestedSkill(skill) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  function addCustomSkill() {
    const trimmed = customSkillInput.trim();
    if (!trimmed) return;
    const nextSkills = normalizeSkills([...selectedSkills, trimmed]);
    setSelectedSkills(nextSkills);
    setForm((prev) => {
      const typedSkills = parseSkillsText(prev.skillsText);
      return { ...prev, skillsText: normalizeSkills([...typedSkills, trimmed]).join(", ") };
    });
    setCustomSkillInput("");
  }

  async function handleDeleteAccount() {
    if (!currentUser?.id || deletingAccount) return;

    const confirmed = window.confirm(
      "Delete your account permanently? This will remove your profile, posts, messages, and related task data."
    );
    if (!confirmed) return;

    try {
      setDeletingAccount(true);
      setStatusMessage("Deleting account...");
      await deleteAccount();
      navigate("/login", { replace: true });
    } catch (err) {
      setStatusMessage(err?.response?.data?.message || "Unable to delete account right now.");
      setDeletingAccount(false);
    }
  }

  async function handleSavePublicWallet() {
    if (!publicProfile?.id || savingPublicWallet) return;

    const nextBalance = Number(publicWalletDraft);
    if (!Number.isFinite(nextBalance) || nextBalance < 0) {
      setPublicWalletStatus("Wallet amount must be a non-negative number.");
      return;
    }

    try {
      setSavingPublicWallet(true);
      setPublicWalletStatus("Updating wallet...");
      const updated = await updateUserWallet(publicProfile.id, { walletBalance: nextBalance });
      setPublicProfile(updated);
      setPublicWalletDraft(String(Number(updated.walletBalance || 0)));
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
      setPublicWalletStatus("Wallet updated.");
      setIsEditingPublicWallet(false);
    } catch (err) {
      setPublicWalletStatus(err?.response?.data?.message || "Could not update wallet.");
    } finally {
      setSavingPublicWallet(false);
    }
  }

  if (!currentUser) {
    return <section className="page">Select a user to open profile.</section>;
  }

  if (!viewingOwnProfile) {
    if (!publicProfile) {
      return <section className="page">Loading profile...</section>;
    }

    return (
      <section className="page">
        <div className="page-head">
          <h1>{publicProfile.name}</h1>
          <p>{publicProfile.role === "hirer" ? "Hirer" : "Student"} profile</p>
        </div>

        <div className="panel">
          <p><strong>Bio:</strong> {publicProfile.bio || "No bio added."}</p>
          {isDeveloper && Number.isFinite(Number(publicProfile.walletBalance)) ? (
            <p>
              <strong>Wallet:</strong>{" "}
              {isEditingPublicWallet ? (
                <>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={publicWalletDraft}
                    onChange={(e) => setPublicWalletDraft(e.target.value)}
                    style={{ width: 120, marginRight: 8 }}
                  />
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleSavePublicWallet}
                    disabled={savingPublicWallet}
                  >
                    {savingPublicWallet ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setIsEditingPublicWallet(false);
                      setPublicWalletDraft(String(Number(publicProfile.walletBalance || 0)));
                      setPublicWalletStatus("");
                    }}
                    disabled={savingPublicWallet}
                    style={{ marginLeft: 8 }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setIsEditingPublicWallet(true)}
                >
                  Rs. {Number(publicProfile.walletBalance || 0)}
                </button>
              )}
            </p>
          ) : null}
          {isDeveloper && publicWalletStatus ? <p>{publicWalletStatus}</p> : null}
          {publicProfile.portfolioUrl ? (
            <p>
              <strong>Portfolio:</strong> <a href={publicProfile.portfolioUrl} target="_blank" rel="noreferrer">Open Portfolio</a>
            </p>
          ) : null}
          {publicProfile.resumeUrl ? (
            <p>
              <strong>Resume:</strong> <a href={publicProfile.resumeUrl} target="_blank" rel="noreferrer">Open Resume</a>
            </p>
          ) : null}
          {(publicProfile.projects || []).length > 0 ? (
            <>
              <h3>Projects</h3>
              <ul>
                {(publicProfile.projects || []).map((project) => (
                  <li key={project}>{project}</li>
                ))}
              </ul>
            </>
          ) : null}
          {(publicProfile.skills || []).length > 0 ? (
            <>
              <h3>Skills</h3>
              <div className="chip-list">
                {(publicProfile.skills || []).map((skill) => (
                  <span className="chip" key={skill}>{skill}</span>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>
    );
  }

  // Own profile - view or edit mode
  if (!isEditMode) {
    return (
      <section className="page">
        <div className="page-head">
          <h1>Your Public Profile</h1>
          <button 
            type="button" 
            className="primary-btn"
            onClick={() => setIsEditMode(true)}
          >
            ✏️ Edit Profile
          </button>
        </div>

        <div className="panel">
          <h2>{form.name || "No name set"}</h2>
          <p><strong>Role:</strong> {form.role === "hirer" ? "Hirer" : "Student"}</p>
          <p><strong>Bio:</strong> {form.bio || "No bio added."}</p>
          <p><strong>Wallet:</strong> Rs. {shownWalletBalance}</p>
          
          {form.portfolioUrl ? (
            <p>
              <strong>Portfolio:</strong> <a href={form.portfolioUrl} target="_blank" rel="noreferrer">Open Portfolio</a>
            </p>
          ) : null}
          
          {form.resumeUrl ? (
            <p>
              <strong>Resume:</strong> <a href={form.resumeUrl} target="_blank" rel="noreferrer">Open Resume</a>
            </p>
          ) : null}
          
          {selectedSkills && selectedSkills.length > 0 ? (
            <>
              <h3>Skills</h3>
              <div className="chip-list">
                {selectedSkills.map((skill) => (
                  <span className="chip" key={skill}>{skill}</span>
                ))}
              </div>
            </>
          ) : null}
          
          {form.projectsText.trim() ? (
            <>
              <h3>Projects</h3>
              <ul>
                {form.projectsText.split("\n").map((project, idx) => (
                  project.trim() ? <li key={idx}>{project.trim()}</li> : null
                ))}
              </ul>
            </>
          ) : null}

          <div className="wallet-history-box">
            <h3>Wallet Transactions</h3>
            {walletHistory.length === 0 ? (
              <p>No transactions yet.</p>
            ) : (
              <div className="wallet-history-list">
                {walletHistory.slice(0, 12).map((entry, idx) => (
                  <div key={`${entry.createdAt}-${idx}`} className="wallet-history-item">
                    <strong>{entry.direction === "credit" ? "+" : "-"} Rs. {entry.amount}</strong>
                    <span>{entry.note || entry.type || "Wallet update"}</span>
                    <time>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}</time>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="profile-danger-zone">
            <h3>Danger Zone</h3>
            <p>Delete your account permanently. This action cannot be undone.</p>
            <button
              type="button"
              className="danger-btn"
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
            >
              {deletingAccount ? "Deleting Account..." : "Delete Account"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-head">
        <h1>Edit Your Profile</h1>
        <button 
          type="button" 
          className="secondary-btn"
          onClick={() => setIsEditMode(false)}
        >
          ✕ Cancel
        </button>
      </div>

      <form className="panel profile-form" onSubmit={handleSave}>
        <label className="form-field">
          <span>Full Name</span>
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Full name"
          />
        </label>

        <label className="form-field">
          <span>Role</span>
          <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}>
            <option value="student">Student</option>
            <option value="hirer">Hirer</option>
          </select>
        </label>

        <label className="form-field">
          <span>Bio</span>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
            placeholder="Short bio"
            rows={4}
          />
        </label>

        <label className="form-field">
          <span>Portfolio URL (Optional)</span>
          <input
            value={form.portfolioUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, portfolioUrl: e.target.value }))}
            placeholder="Portfolio URL"
          />
        </label>

        <label className="form-field">
          <span>Resume URL (Optional)</span>
          <input
            value={form.resumeUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, resumeUrl: e.target.value }))}
            placeholder="Resume URL"
          />
        </label>

        <label className="form-field">
          <span>Upload Portfolio File (Optional)</span>
          <input
            type="file"
            onChange={(e) => setPortfolioFile(e.target.files?.[0] ?? null)}
            accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.webp"
          />
        </label>

        <label className="form-field">
          <span>Upload Resume File (Optional)</span>
          <input
            type="file"
            onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            accept=".pdf,.doc,.docx"
          />
        </label>

        <label className="form-field">
          <span>Skills</span>
          <div className="chip-list">
            {SKILL_SUGGESTIONS.map((skill) => {
              const active = selectedSkills.includes(skill);
              return (
                <button
                  type="button"
                  key={skill}
                  className={`search-pill ${active ? "active" : ""}`}
                  onClick={() => toggleSuggestedSkill(skill)}
                >
                  {active ? `Selected: ${skill}` : skill}
                </button>
              );
            })}
          </div>
        </label>

        <label className="form-field">
          <span>Add Custom Skill</span>
          <div className="row">
            <input
              value={customSkillInput}
              onChange={(e) => setCustomSkillInput(e.target.value)}
              placeholder="Type a skill and click Add"
              list="skill-suggestions"
            />
            <button type="button" className="secondary-btn" onClick={addCustomSkill}>Add</button>
          </div>
          <datalist id="skill-suggestions">
            {SKILL_SUGGESTIONS.map((skill) => (
              <option key={skill} value={skill} />
            ))}
          </datalist>
        </label>

        <label className="form-field">
          <span>Skills (Manual Input Also Supported)</span>
          <textarea
            value={form.skillsText}
            onChange={(e) => setForm((prev) => ({ ...prev, skillsText: e.target.value }))}
            placeholder="Type your own skills separated by comma or new line"
            rows={3}
          />
        </label>

        <label className="form-field">
          <span>Previous Works / Projects</span>
          <textarea
            value={form.projectsText}
            onChange={(e) => setForm((prev) => ({ ...prev, projectsText: e.target.value }))}
            placeholder="Previous works/projects (one per line)"
            rows={6}
          />
        </label>

        <div className="form-actions">
          <button type="submit">💾 Save Profile</button>
          <button type="button" className="secondary-btn" onClick={() => setIsEditMode(false)}>✕ Cancel</button>
          <button
            type="button"
            className="danger-btn"
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
          >
            {deletingAccount ? "Deleting Account..." : "Delete Account"}
          </button>
        </div>
        {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
      </form>
    </section>
  );
}
