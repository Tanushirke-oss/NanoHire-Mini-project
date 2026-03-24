import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import WalletConnect from "./WalletConnect";
import { useState } from "react";

export default function Navbar() {
  const { currentUser, signOut, isAuthenticated } = useAuth();
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  if (!isAuthenticated) return null;

  return (
    <header className="topbar">
      <Link to="/" className="brand-mark" aria-label="NanoHire home">
        {logoLoadFailed ? (
          <span className="logo-icon-fallback">NH</span>
        ) : (
          <img
            src="/logo.png"
            alt="NanoHire logo"
            className="brand-logo"
            onError={() => setLogoLoadFailed(true)}
          />
        )}
        <span className="brand-text">NanoHire</span>
      </Link>
      <nav className="menu">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/tasks">Tasks</NavLink>
          <NavLink to="/history">History</NavLink>
        <NavLink to="/marketplace">Marketplace</NavLink>
        <NavLink to="/messages">Messages</NavLink>
        <NavLink to="/profile">Profile</NavLink>
      </nav>
      <div className="topbar-right">
        <span className="identity-pill">{currentUser?.name} ({currentUser?.role})</span>
        <WalletConnect />
        <button type="button" className="secondary-btn" onClick={signOut}>
          Logout
        </button>
      </div>
    </header>
  );
}
