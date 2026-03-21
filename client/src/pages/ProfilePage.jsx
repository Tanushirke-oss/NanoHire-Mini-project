import { useEffect, useState } from "react";
import { getUser, updateUser, uploadUserFiles } from "../api";
import { useAuth } from "../context/AuthContext";
import { useParams } from "react-router-dom";

export default function ProfilePage() {
  const { userId } = useParams();
  const { currentUser, setUsers } = useAuth();
  const viewingOwnProfile = !userId || userId === currentUser?.id;
  const [publicProfile, setPublicProfile] = useState(null);
  const [form, setForm] = useState({
    name: "",
    role: "student",
    bio: "",
    portfolioUrl: "",
    resumeUrl: "",
    projectsText: ""
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [portfolioFile, setPortfolioFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!currentUser?.id) return;

      if (!viewingOwnProfile && userId) {
        const user = await getUser(userId);
        setPublicProfile(user);
        return;
      }

      const user = await getUser(currentUser.id);
      setForm({
        name: user.name ?? "",
        role: user.role ?? "student",
        bio: user.bio ?? "",
        portfolioUrl: user.portfolioUrl ?? "",
        resumeUrl: user.resumeUrl ?? "",
        projectsText: (user.projects ?? []).join("\n")
      });
    }

    loadProfile();
  }, [currentUser?.id, userId, viewingOwnProfile]);

  async function handleSave(e) {
    e.preventDefault();
    if (!currentUser?.id) return;
    setStatusMessage("Saving profile...");

    let updated = await updateUser(currentUser.id, {
      ...form,
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

    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setStatusMessage("Profile saved successfully.");
    setResumeFile(null);
    setPortfolioFile(null);
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
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-head">
        <h1>Your Public Profile</h1>
        <p>Resume and portfolio are optional. Add them only if available.</p>
      </div>

      <form className="panel" onSubmit={handleSave}>
        <input
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Full name"
        />
        <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}>
          <option value="student">Student</option>
          <option value="hirer">Hirer</option>
        </select>
        <textarea
          value={form.bio}
          onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
          placeholder="Short bio"
          rows={4}
        />
        <input
          value={form.portfolioUrl}
          onChange={(e) => setForm((prev) => ({ ...prev, portfolioUrl: e.target.value }))}
          placeholder="Portfolio URL (optional)"
        />
        <input
          value={form.resumeUrl}
          onChange={(e) => setForm((prev) => ({ ...prev, resumeUrl: e.target.value }))}
          placeholder="Resume URL (optional)"
        />
        <label>
          Upload portfolio file (optional)
          <input
            type="file"
            onChange={(e) => setPortfolioFile(e.target.files?.[0] ?? null)}
            accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.webp"
          />
        </label>
        <label>
          Upload resume file (optional)
          <input
            type="file"
            onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            accept=".pdf,.doc,.docx"
          />
        </label>
        <textarea
          value={form.projectsText}
          onChange={(e) => setForm((prev) => ({ ...prev, projectsText: e.target.value }))}
          placeholder="Previous works/projects (one per line)"
          rows={6}
        />
        <button type="submit">Save Profile</button>
        {statusMessage ? <p>{statusMessage}</p> : null}
      </form>
    </section>
  );
}
