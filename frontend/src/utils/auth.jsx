// Utility functions for authentication

// Decode JWT token payload without verification (for client-side inspection only)
// WARNING: Do not use this data for security decisions - always verify server-side
export const decodeJwtPayload = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json);
  } catch (error) {
    console.error("Error decoding JWT payload:", error);
    return null;
  }
};

// Check if token is expired
export const isTokenExpired = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false; // no exp claim
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
};

// Save token to localStorage
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
};

// Get token from localStorage
export const getAuthToken = () => {
  return localStorage.getItem("token");
};

// Check if user is authenticated
export const isAuthenticated = () => {
  const token = getAuthToken();
  return !!token && !isTokenExpired(token);
};

// Get user from token (decoded)
export const getCurrentUser = () => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const payload = decodeJwtPayload(token);
    if (payload) {
      return {
        id: payload.id,
        email: payload.email || "user@example.com",
      };
    }
    // In a real app, you would decode the JWT token here
    // For now, we'll just return a placeholder
    return { id: 1, email: "user@example.com" };
  } catch (error) {
    console.error("Error decoding token:", error);
    return null;
  }
};
