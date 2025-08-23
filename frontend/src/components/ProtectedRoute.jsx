import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { isAuthenticated } from "../utils/auth";
import useOfflineAPI from "../hooks/useOfflineAPI";

const ProtectedRoute = ({ children, offlineDisabled }) => {
  const { user, loading } = useAuth();
  const { isOnline } = useOfflineAPI();

  if (offlineDisabled && !isOnline) {
    // return null; // Render nothing while redirecting
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 pt-4 pb-8 sm:py-8">
        <div className="flex justify-center items-center h-64">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  // Prefer the loaded user from AuthContext (covers DEV_MODE auto-login).
  // Fall back to token-based check only if context user is not available.
  if (!user && !isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
