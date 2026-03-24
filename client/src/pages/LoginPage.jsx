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
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student"
  });
  const googleButtonRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

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
      navigate("/");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return undefined;

    let cancelled = false;

    const handleGoogleCredential = async (response) => {
      if (cancelled || !response?.credential) return;

      setError("");
      setBusy(true);
      try {
        await signInWithGoogle({
          idToken: response.credential,
          role: accountType,
          expectedRole: accountType
        });
        navigate("/");
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || "Google sign in failed");
      } finally {
        setBusy(false);
      }
    };

    const renderGoogleButton = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential
      });

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: mode === "login" ? "continue_with" : "signup_with",
        shape: "pill",
        width: 320
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener("load", renderGoogleButton, { once: true });
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [accountType, googleClientId, mode, navigate, signInWithGoogle]);

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

        {googleClientId ? (
          <div className="google-auth-wrap">
            <p className="auth-subtitle">Or continue with Google</p>
            <div ref={googleButtonRef} className="google-button-slot" />
          </div>
        ) : (
          <p className="search-meta">Google login is available when VITE_GOOGLE_CLIENT_ID is configured.</p>
        )}

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
