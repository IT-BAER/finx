import { createContext, useState, useEffect, useContext } from "react";
import { authAPI } from "../services/api.jsx";
import { setAuthToken, isAuthenticated, getCurrentUser } from "../utils/auth.jsx";
import offlineAPI from "../services/offlineAPI.js";
import tRaw from "../lib/i18n";

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
  // Only attempt to load the current user when we already have a token
  if (isAuthenticated()) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async () => {
    try {
      // If offline, try cached user or token-derived user first
      if (!offlineAPI.isOnline) {
        const cachedStr = localStorage.getItem("user");
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          setUser(cached);
          setIsIncomeTrackingDisabled(!!cached.income_tracking_disabled);
          return;
        }
        const tokenUser = getCurrentUser();
        if (tokenUser) {
          setUser(tokenUser);
          setIsIncomeTrackingDisabled(false);
          return;
        }
      }

      // Otherwise, fetch online
      const res = await authAPI.getCurrentUser();
      const u = res && res.data && res.data.user ? res.data.user : null;
      if (!u) throw new Error("Invalid user response");

      setUser(u);
      setIsIncomeTrackingDisabled(!!u.income_tracking_disabled);
      try { localStorage.setItem("user", JSON.stringify(u)); } catch {}

      if (offlineAPI.isOnline) {
        setTimeout(() => {
          // offlineAPI.cacheAllOfflineData();
        }, 1000);
      }
    } catch (err) {
      console.warn("Falling back to offline user due to load failure:", err?.message || err);
      const cachedStr = localStorage.getItem("user");
      if (cachedStr) {
        try {
          const cached = JSON.parse(cachedStr);
          setUser(cached);
          setIsIncomeTrackingDisabled(!!cached.income_tracking_disabled);
        } catch {}
      } else {
        const tokenUser = getCurrentUser();
        if (tokenUser) {
          setUser(tokenUser);
          setIsIncomeTrackingDisabled(false);
        }
      }
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
  try { localStorage.setItem("user", JSON.stringify(u)); } catch {}
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
  try { localStorage.setItem("user", JSON.stringify(res.data.user)); } catch {}

  // Show login success notification localized
  window.toastWithHaptic.success(tRaw("loginSuccessful"), {
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
  try { localStorage.setItem("user", JSON.stringify(res.data.user)); } catch {}
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
  try { localStorage.removeItem("user"); } catch {}

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
      // persist change in cached user for offline continuity
      try {
        const str = localStorage.getItem("user");
        if (str) {
          const cached = JSON.parse(str);
          cached.income_tracking_disabled = newIncomeTrackingDisabled;
          localStorage.setItem("user", JSON.stringify(cached));
        }
      } catch {}
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
