import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, signUp, isAuthenticated } = useAuth();
  const [mode, setMode] = useState("login");
  const [accountType, setAccountType] = useState("student");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student"
  });
  useEffect(() => {
    if (pendingRedirect && isAuthenticated) {
      navigate("/", { replace: true });
      setPendingRedirect(false);
    }
  }, [pendingRedirect, isAuthenticated, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (mode === "login") {
        await signIn({
          email: form.email,
          password: form.password,
          expectedRole: accountType
        });
      } else {
        await signUp({
          name: form.name,
          email: form.email,
          password: form.password,
          role: accountType,
          walletAddress: form.walletAddress
        });
      }
      setPendingRedirect(true);
    } catch (err) {
      if (err?.code === "ERR_NETWORK") {
        setError("Server is starting. Please wait a moment and try login again.");
      } else {
        setError(err?.response?.data?.message || err?.message || "Authentication failed");
      }
    } finally {
      setBusy(false);
    }
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="auth-page">
      <div className="auth-art">
        <div className="login-brand">
          <div className="login-logo">NH</div>
          <div className="login-brand-text">
            <strong>NanoHire</strong>
            <span>Talent Meets Opportunity</span>
          </div>
        </div>
        <h1>Ship Micro Internships, Not Empty Promises</h1>
        <p>
          Students and hirers both login with email and password, collaborate transparently, and close tasks with tracked payments.
        </p>
        <div className="auth-badges">
          <span>Escrow-secured payouts</span>
          <span>Student + Hirer accounts</span>
          <span>Progress and feedback threads</span>
        </div>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>{mode === "login" ? "Welcome Back" : "Create Account"}</h2>
        <div className="auth-role-switch">
          <button
            type="button"
            className={accountType === "student" ? "role-toggle active" : "role-toggle"}
            onClick={() => {
              setAccountType("student");
              setForm((prev) => ({ ...prev, role: "student" }));
            }}
          >
            Student
          </button>
          <button
            type="button"
            className={accountType === "hirer" ? "role-toggle active" : "role-toggle"}
            onClick={() => {
              setAccountType("hirer");
              setForm((prev) => ({ ...prev, role: "hirer" }));
            }}
          >
            Hirer
          </button>
        </div>
        <p className="auth-subtitle">
          {mode === "login"
            ? `Login as ${accountType} with your registered email.`
            : `Create a ${accountType} account with email and password.`}
        </p>

        {mode === "register" ? (
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
        ) : null}

        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          required
        />

        {error ? <p className="error-text">{error}</p> : null}

        <button type="submit" disabled={busy}>
          {busy ? "Please wait..." : mode === "login" ? "Login" : "Register"}
        </button>

        <button
          type="button"
          className="text-switch"
          onClick={() => setMode((prev) => (prev === "login" ? "register" : "login"))}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </form>
    </section>
  );
}
