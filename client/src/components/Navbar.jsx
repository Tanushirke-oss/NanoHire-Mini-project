import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import WalletConnect from "./WalletConnect";

function WalletBadge() {
  const { currentUser } = useAuth();

  if (!currentUser?.walletAddress) return null;
  const short = `${currentUser.walletAddress.slice(0, 6)}...${currentUser.walletAddress.slice(-4)}`;

  return <span className="wallet-badge">Wallet: {short}</span>;
}

export default function Navbar() {
  const { currentUser, signOut, isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <header className="topbar">
      <Link to="/" className="brand-mark">
        NanoHire
      </Link>
      <nav className="menu">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/tasks">Tasks</NavLink>
        <NavLink to="/marketplace">Marketplace</NavLink>
        <NavLink to="/messages">Messages</NavLink>
        <NavLink to="/profile">Profile</NavLink>
      </nav>
      <div className="topbar-right">
        <span className="identity-pill">{currentUser?.name} ({currentUser?.role})</span>
        <WalletBadge />
        <WalletConnect />
        <button type="button" className="secondary-btn" onClick={signOut}>
          Logout
        </button>
      </div>
    </header>
  );
}
