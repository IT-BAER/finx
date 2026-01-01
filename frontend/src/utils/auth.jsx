// Utility functions for authentication

// Storage keys
const TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const REFRESH_TOKEN_FAMILY_KEY = "refreshTokenFamily";
const USER_ID_KEY = "userId";

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

// Check if token will expire soon (within 30 seconds)
export const isTokenExpiringSoon = (token, bufferSeconds = 30) => {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + bufferSeconds;
};

// Save access token to localStorage
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

// Get access token from localStorage
export const getAuthToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

// Save refresh token data to localStorage
export const setRefreshTokenData = (refreshToken, refreshTokenFamily, userId) => {
  if (refreshToken && refreshTokenFamily && userId) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(REFRESH_TOKEN_FAMILY_KEY, refreshTokenFamily);
    localStorage.setItem(USER_ID_KEY, String(userId));
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_FAMILY_KEY);
    localStorage.removeItem(USER_ID_KEY);
  }
};

// Get refresh token from localStorage
export const getRefreshToken = () => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

// Get refresh token family from localStorage
export const getRefreshTokenFamily = () => {
  return localStorage.getItem(REFRESH_TOKEN_FAMILY_KEY);
};

// Get stored user ID from localStorage
export const getStoredUserId = () => {
  const id = localStorage.getItem(USER_ID_KEY);
  return id ? parseInt(id, 10) : null;
};

// Store all auth data at once (after login/register/refresh)
export const storeAuthData = (authResponse) => {
  const { token, refreshToken, refreshTokenFamily, user } = authResponse;
  setAuthToken(token);
  if (refreshToken && refreshTokenFamily && user?.id) {
    setRefreshTokenData(refreshToken, refreshTokenFamily, user.id);
  }
};

// Clear all auth data (logout)
export const clearAuthData = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_FAMILY_KEY);
  localStorage.removeItem(USER_ID_KEY);
};

// Check if user is authenticated (has valid or refreshable token)
export const isAuthenticated = () => {
  const token = getAuthToken();
  if (!token) return false;

  // If token is valid, we're authenticated
  if (!isTokenExpired(token)) return true;

  // If token is expired but we have refresh token, we might still be authenticated
  const refreshToken = getRefreshToken();
  return !!refreshToken;
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
    return null;
  } catch (error) {
    console.error("Error decoding token:", error);
    return null;
  }
};

