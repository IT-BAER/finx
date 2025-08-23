import { createContext, useState, useEffect, useContext } from "react";
import { authAPI } from "../services/api.jsx";
import { setAuthToken, isAuthenticated } from "../utils/auth.jsx";
import offlineAPI from "../services/offlineAPI.js";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isIncomeTrackingDisabled, setIsIncomeTrackingDisabled] =
    useState(false);

  useEffect(() => {
    // If Vite frontend DEV mode is enabled, attempt to load the current user
    // even if there's no token. This pairs with backend DEV_MODE which
    // bypasses authentication server-side. Only enable when VITE_DEV_MODE === 'true'.
    // Use a safe runtime check (try/catch) instead of `typeof import` which can break parsing.
    let VITE_DEV_MODE = false;
    try {
      VITE_DEV_MODE = !!(
        import.meta &&
        import.meta.env &&
        import.meta.env.VITE_DEV_MODE === "true"
      );
    } catch (e) {
      VITE_DEV_MODE = false;
    }

    // Only bypass auth in true development builds
    const isDevBuild = (() => {
      try {
        return import.meta && import.meta.env && import.meta.env.MODE === "development";
      } catch (_) {
        return false;
      }
    })();

    if (VITE_DEV_MODE && isDevBuild) {
      // Try to load user from server; backend must also have DEV_MODE=true for this to succeed.
      loadUser();
    } else if (isAuthenticated()) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async () => {
    try {
      const res = await authAPI.getCurrentUser();
      const u = res && res.data && res.data.user ? res.data.user : null;
      if (!u) throw new Error("Invalid user response");

      setUser(u);
      setIsIncomeTrackingDisabled(!!u.income_tracking_disabled);

      // Trigger offline data caching for authenticated users
      if (offlineAPI.isOnline) {
        setTimeout(() => {
          // offlineAPI.cacheAllOfflineData();
        }, 1000); // Delay to allow app to initialize
      }
    } catch (err) {
      console.error("Error loading user:", err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  // Expose a refresh method for consumers to re-sync user from backend after updates
  const refreshUser = async (themeData = null) => {
    try {
      // If theme data is provided, update the user's theme settings
      if (themeData) {
        await authAPI.updateUser(themeData);
      }

  const res = await authAPI.getCurrentUser();
  const u = res && res.data && res.data.user ? res.data.user : null;
  if (!u) throw new Error("Invalid user response");
  setUser(u);
  setIsIncomeTrackingDisabled(!!u.income_tracking_disabled);
  return u;
    } catch (err) {
      console.error("Error refreshing user:", err);
      return null;
    }
  };

  const login = async (email, password, rememberMe = false) => {
    try {
      const res = await authAPI.login({ email, password, rememberMe });
      setAuthToken(res.data.token);
      setUser(res.data.user);

      // Show login success notification for all users
      window.toastWithHaptic.success("Login successful!", {
        duration: 3000,
        position: "top-center",
      });

      // Trigger offline data caching after successful login
      if (offlineAPI.isOnline) {
        setTimeout(() => {
          offlineAPI.cacheAllOfflineData();
        }, 1000); // Delay to allow app to initialize
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || "Login failed",
      };
    }
  };

  const register = async (email, password) => {
    try {
      const res = await authAPI.register({ email, password });
      setAuthToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || "Registration failed",
      };
    }
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);

    // Clear theme settings from localStorage
    localStorage.removeItem("theme");
    localStorage.removeItem("themeDarkMode");
    localStorage.removeItem("darkMode");
  };

  const toggleIncomeTracking = async () => {
    try {
      const newIncomeTrackingDisabled = !isIncomeTrackingDisabled;
      setIsIncomeTrackingDisabled(newIncomeTrackingDisabled);

      // Update on server
      await authAPI.updateUser({
        income_tracking_disabled: newIncomeTrackingDisabled,
      });
    } catch (err) {
      console.error("Error updating income tracking preference:", err);
      // Revert state if update fails
      setIsIncomeTrackingDisabled(!isIncomeTrackingDisabled);
    }
  };

  const value = {
    user,
    loading,
    isIncomeTrackingDisabled,
    login,
    register,
    logout,
    toggleIncomeTracking,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
