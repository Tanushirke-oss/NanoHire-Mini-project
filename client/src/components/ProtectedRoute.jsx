import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, authLoading } = useAuth();

  if (isAuthenticated) {
    return children;
  }

  if (authLoading) {
    return (
      <section className="page">
        <div className="panel">
          <h2>Loading your workspace...</h2>
          <p>Please wait while we restore your session.</p>
        </div>
      </section>
    );
  }

  return <Navigate to="/login" replace />;
}
