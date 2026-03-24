import { useAuth } from "../context/AuthContext";

export default function WalletConnect() {
  const { currentUser } = useAuth();

  if (!currentUser) return null;

  const balance = typeof currentUser.walletBalance === "number" ? currentUser.walletBalance : 0;

  return (
    <div className="wallet-connect fake-wallet-pill">
      <strong>Wallet = Rs. {balance}</strong>
    </div>
  );
}
