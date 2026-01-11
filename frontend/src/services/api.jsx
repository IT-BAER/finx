import axios from "axios";
import {
  getAuthToken,
  getRefreshToken,
  getRefreshTokenFamily,
  getStoredUserId,
  storeAuthData,
  clearAuthData,
  isTokenExpiringSoon
} from "../utils/auth";
import { getDeviceInfo } from "../utils/deviceInfo";
import cache, { getCachedData, setCachedData, cacheKeys } from "../utils/cache";
import offlineStorage from "../utils/offlineStorage.js";
import { getIsOnline } from "./connectivity.js";

// Create axios instance with relative URL for proxy support
const api = axios.create({
  baseURL: "/api",
});

// Refresh state management
let isRefreshing = false;
let refreshSubscribers = [];

// Subscribe to token refresh
const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

// Notify all subscribers when token is refreshed
const onTokenRefreshed = (newToken) => {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
};

// Notify all subscribers of refresh failure
const onRefreshFailed = () => {
  refreshSubscribers.forEach((callback) => callback(null));
  refreshSubscribers = [];
};

// Attempt to refresh the access token
const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  const refreshTokenFamily = getRefreshTokenFamily();
  const userId = getStoredUserId();

  if (!refreshToken || !refreshTokenFamily || !userId) {
    throw new Error("No refresh token available");
  }

  // Get device info for the refresh request
  const deviceInfo = getDeviceInfo();

  // Use a direct axios call to avoid interceptor loop
  const response = await axios.post("/api/auth/refresh", {
    refreshToken,
    refreshTokenFamily,
    userId,
    ...deviceInfo,
  });

  // Store the new tokens
  storeAuthData(response.data);

  return response.data.token;
};

// Add auth token to requests (and proactively refresh if expiring soon)
api.interceptors.request.use(
  async (config) => {
    let token = getAuthToken();

    // Proactively refresh if token is expiring soon (within 30 seconds)
    if (token && isTokenExpiringSoon(token, 30) && !isRefreshing) {
      try {
        isRefreshing = true;
        token = await refreshAccessToken();
        isRefreshing = false;
      } catch (error) {
        isRefreshing = false;
        // Don't fail the request yet, let the response interceptor handle it
        console.warn("Proactive token refresh failed:", error.message);
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Handle 401 errors by attempting token refresh first
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if this is a 401 error and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't try to refresh the refresh endpoint itself
      if (originalRequest.url === "/auth/refresh") {
        clearAuthData();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // If already refreshing, wait for refresh to complete
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken) => {
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        onTokenRefreshed(newToken);

        // Retry the original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshFailed();

        // Refresh failed - clear auth and redirect to login
        console.error("Token refresh failed:", refreshError.message);
        clearAuthData();
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

// Auth endpoints
export const authAPI = {
  register: (data) => {
    const deviceInfo = getDeviceInfo();
    return api.post("/auth/register", { ...data, ...deviceInfo });
  },
  login: (data) => {
    const deviceInfo = getDeviceInfo();
    return api.post("/auth/login", { ...data, ...deviceInfo });
  },
  logout: () => {
    // Get current refresh token family to logout only this device
    const refreshTokenFamily = getRefreshTokenFamily();
    return api.post("/auth/logout", { refreshTokenFamily });
  },
  logoutAll: () => api.post("/auth/logout-all"),
  getSessions: () => api.get("/auth/sessions"),
  revokeSession: (tokenFamily) => api.post("/auth/sessions/revoke", { tokenFamily }),
  refresh: (data) => api.post("/auth/refresh", data),
  getCurrentUser: () => api.get("/auth/me"),
  updateUser: (data) => api.put("/auth/me", data),
  changePassword: (data) => api.post("/auth/change-password", data),
  deleteAccount: () => api.delete("/auth/me"),
};

// Category endpoints with caching
export const categoryAPI = {
  create: async (data) => {
    const response = await api.post("/categories", data);
    // Clear cache when creating new category
    cache.remove(cacheKeys.CATEGORIES);
    return response;
  },
  getAll: async () => {
    // Check cache first
    const cached = getCachedData(cacheKeys.CATEGORIES);
    if (cached) {
      return Promise.resolve({ data: { categories: cached } });
    }

    // Fetch from API if not in cache
    const response = await api.get("/categories");
    // Cache the result for 5 minutes
    setCachedData(cacheKeys.CATEGORIES, response.data.categories);
    return response;
  },
  update: async (id, data) => {
    const response = await api.put(`/categories/${id}`, data);
    // Clear cache when updating category
    cache.remove(cacheKeys.CATEGORIES);
    return response;
  },
  delete: async (id) => {
    const response = await api.delete(`/categories/${id}`);
    // Clear cache when deleting category
    cache.remove(cacheKeys.CATEGORIES);
    return response;
  },
};

// Source endpoints with caching
export const sourceAPI = {
  create: async (data) => {
    const response = await api.post("/sources", data);
    // Clear cache when creating new source
    cache.remove(cacheKeys.SOURCES);
    return response;
  },
  getAll: async () => {
    // Check cache first
    const cached = getCachedData(cacheKeys.SOURCES);
    if (cached) {
      return Promise.resolve({ data: { sources: cached } });
    }

    // Fetch from API if not in cache
    const response = await api.get("/sources");
    // Cache the result for 5 minutes
    setCachedData(cacheKeys.SOURCES, response.data.sources);
    return response;
  },
  update: async (id, data) => {
    const response = await api.put(`/sources/${id}`, data);
    // Clear cache when updating source
    cache.remove(cacheKeys.SOURCES);
    return response;
  },
  delete: async (id) => {
    const response = await api.delete(`/sources/${id}`);
    // Clear cache when deleting source
    cache.remove(cacheKeys.SOURCES);
    return response;
  },
};

// Target endpoints with caching
export const targetAPI = {
  create: async (data) => {
    const response = await api.post("/targets", data);
    // Clear cache when creating new target
    cache.remove(cacheKeys.TARGETS);
    return response;
  },
  getAll: async () => {
    // Check cache first
    const cached = getCachedData(cacheKeys.TARGETS);
    if (cached) {
      return Promise.resolve({ data: { targets: cached } });
    }

    // Fetch from API if not in cache
    const response = await api.get("/targets");
    // Cache the result for 5 minutes
    setCachedData(cacheKeys.TARGETS, response.data.targets);
    return response;
  },
  update: async (id, data) => {
    const response = await api.put(`/targets/${id}`, data);
    // Clear cache when updating target
    cache.remove(cacheKeys.TARGETS);
    return response;
  },
  delete: async (id) => {
    const response = await api.delete(`/targets/${id}`);
    // Clear cache when deleting target
    cache.remove(cacheKeys.TARGETS);
    return response;
  },
};

// Transaction endpoints with caching

// Helper to clear all transaction-related caches
const clearTransactionCaches = () => {
  // Clear dashboard, reports, and potentially transactions list caches
  cache.remove(cacheKeys.DASHBOARD_DATA);
  cache.remove(cacheKeys.REPORT_DATA);
  // Add any other related cache keys here if needed
  // e.g., cache.remove(cacheKeys.TRANSACTIONS);

  // Dispatch a global event that components can listen to
  window.dispatchEvent(new CustomEvent("dataRefreshNeeded"));
};

export const transactionAPI = {
  getDashboardData: async (params) => {
    const cacheKey = `${cacheKeys.DASHBOARD_DATA}_${JSON.stringify(params || {})}`;

    // In-memory cache first
    const cached = getCachedData(cacheKey);
    if (cached) {
      return Promise.resolve({ data: { data: cached } });
    }

    // Persistent cache key used by offlineStorage (normalize param order)
    const usp = new URLSearchParams(params || {});
    const persistentKey = `/api/transactions/dashboard${usp.toString() ? `?${usp.toString()}` : ""}`;

    // If offline (including offline startup), try persistent cache in IndexedDB first
    if (typeof window !== "undefined" && !getIsOnline()) {
      const persisted = await offlineStorage.getCachedAPIResponse(persistentKey);
      if (persisted) {
        // Seed in-memory for this session too
        try { setCachedData(cacheKey, persisted.data, 2 * 60 * 1000); } catch { }
        return { data: persisted };
      }
    }

    // Try network with graceful fallback to cache
    try {
      const response = await api.get("/transactions/dashboard", { params });
      // Write to in-memory cache (2 minutes)
      setCachedData(cacheKey, response.data.data, 2 * 60 * 1000);
      // Persist entire response payload for robust offline fallback
      try {
        await offlineStorage.cacheAPIResponse(persistentKey, response.data);
      } catch { }
      return response;
    } catch (err) {
      // Network failed or 401 redirected. Fall back to persisted cache if available.
      try {
        const persisted = await offlineStorage.getCachedAPIResponse(persistentKey);
        if (persisted) {
          try { setCachedData(cacheKey, persisted.data, 2 * 60 * 1000); } catch { }
          return { data: persisted };
        }
      } catch { }
      throw err;
    }
  },
  getReportData: async (params) => {
    const cacheKey = `${cacheKeys.REPORT_DATA}_${JSON.stringify(params || {})}`;

    // In-memory cache first
    const cached = getCachedData(cacheKey);
    if (cached) {
      return Promise.resolve({ data: { data: cached } });
    }

    // Persistent cache key used by offlineStorage (normalize param order)
    const usp = new URLSearchParams(params || {});
    const persistentKey = `/api/transactions/report${usp.toString() ? `?${usp.toString()}` : ""}`;

    // If offline (including offline startup), try persistent cache first
    if (typeof window !== "undefined" && !getIsOnline()) {
      const persisted = await offlineStorage.getCachedAPIResponse(persistentKey);
      if (persisted) {
        try { setCachedData(cacheKey, persisted.data, 2 * 60 * 1000); } catch { }
        return { data: persisted };
      }
    }

    // Try network with graceful fallback to cache
    try {
      const response = await api.get("/transactions/dashboard", { params });
      // Cache the result for 2 minutes (report data can change frequently)
      setCachedData(cacheKey, response.data.data, 2 * 60 * 1000);
      // Persist entire response payload for robust offline fallback
      try {
        await offlineStorage.cacheAPIResponse(persistentKey, response.data);
      } catch { }
      return response;
    } catch (err) {
      try {
        const persisted = await offlineStorage.getCachedAPIResponse(persistentKey);
        if (persisted) {
          try { setCachedData(cacheKey, persisted.data, 2 * 60 * 1000); } catch { }
          return { data: persisted };
        }
      } catch { }
      throw err;
    }
  },
  create: async (data) => {
    const response = await api.post("/transactions", data);
    clearTransactionCaches();
    return response;
  },
  getAll: () => api.get("/transactions"),
  getById: (id) => api.get(`/transactions/${id}`),
  update: async (id, data) => {
    const response = await api.put(`/transactions/${id}`, data);
    clearTransactionCaches();
    return response;
  },
  delete: async (id) => {
    const response = await api.delete(`/transactions/${id}`);
    clearTransactionCaches();
    return response;
  },
  importTransactions: async (transactions) => {
    const mappedTransactions = transactions
      .filter((t) => t.date) // Filter out rows with empty date
      .map((t) => {
        // Handle different date formats
        let date;
        if (t.date.includes("T")) {
          // Format: 2025-07-31T10:11:59+02:00
          date = new Date(t.date);
        } else {
          // Fallback for other formats if needed
          date = new Date(t.date);
        }

        // Check for invalid date
        if (isNaN(date.getTime())) {
          console.error("Invalid date format:", t.date);
          return null; // Skip this transaction
        }

        return {
          date: date.toISOString().split("T")[0],
          description: t.description,
          amount: Math.abs(parseFloat(t.amount)),
          type: t.type === "Withdrawal" ? "expense" : "income",
          category: t.category,
          source: t.source_name,
          target: t.destination_name,
        };
      })
      .filter(Boolean); // Remove null entries from invalid dates

    // Process transactions one by one with pacing and retries to avoid server-side rate limits (429).
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const results = [];
    const MAX_RETRIES = 4;
    const BASE_DELAY_MS = 250; // base delay between attempts

    for (const transaction of mappedTransactions) {
      let attempt = 0;
      let success = false;
      let lastError = null;

      while (attempt <= MAX_RETRIES && !success) {
        try {
          // Slight delay between consecutive requests to avoid bursting
          if (attempt === 0) await sleep(150);

          const response = await api.post("/transactions", transaction);
          if (response.data && response.data.skipped) {
            results.push({
              success: true,
              skipped: true,
              transaction: response.data.transaction,
            });
          } else {
            results.push({
              success: true,
              transaction: response.data.transaction,
            });
          }
          success = true;
        } catch (error) {
          lastError = error;
          // If server responded with 429, perform exponential backoff and retry
          const status = error?.response?.status;
          if (status === 429) {
            const backoff = BASE_DELAY_MS * Math.pow(2, attempt);
            console.warn(
              `Got 429 importing transaction, backing off ${backoff}ms (attempt ${attempt + 1})`,
            );
            await sleep(backoff);
            attempt++;
            continue;
          }
          // For other errors, don't retry many times
          console.error("Failed to import transaction:", transaction, error);
          break;
        }
      }

      if (!success) {
        results.push({
          success: false,
          transaction,
          error: lastError ? lastError.message : "unknown",
        });
      }
    }

    // Return results so the caller can handle success/failure
    return results;
  },
};

// Sharing endpoints
export const sharingAPI = {
  createPermission: (data) => api.post("/sharing", data),
  getMyPermissions: () => api.get("/sharing/my-permissions"),
  getSharedWithMe: () => api.get("/sharing/shared-with-me"),
  updatePermission: (id, data) => api.put(`/sharing/${id}`, data),
  deletePermission: (id) => api.delete(`/sharing/${id}`),
  getSharedTransactions: (owner_user_id) =>
    api.get("/sharing/transactions", { params: { owner_user_id } }),
  getAllUsers: () => api.get("/sharing/users"),
  getUserSources: () => api.get("/sharing/sources"),
};

/**
 * Admin endpoints
 * - Lists support optional filters: { user_id, q, page, pageSize }
 * - Rename: { name }
 * - Delete supports optional { reassign_to } as query param, limited to same owner
 * - Categories also support merge: { into_category_id }
 */
export const adminAPI = {
  // Categories
  getCategories: (params = {}) => api.get("/admin/categories", { params }),
  renameCategory: (id, data) => api.patch(`/admin/categories/${id}`, data),
  mergeCategory: (id, data) => api.post(`/admin/categories/${id}/merge`, data),
  deleteCategory: (id, reassign_to = null) =>
    api.delete(`/admin/categories/${id}`, {
      params: reassign_to ? { reassign_to } : {},
    }),

  // Sources
  getSources: (params = {}) => api.get("/admin/sources", { params }),
  renameSource: (id, data) => api.patch(`/admin/sources/${id}`, data),
  deleteSource: (id, reassign_to = null) =>
    api.delete(`/admin/sources/${id}`, {
      params: reassign_to ? { reassign_to } : {},
    }),

  // Targets
  getTargets: (params = {}) => api.get("/admin/targets", { params }),
  renameTarget: (id, data) => api.patch(`/admin/targets/${id}`, data),
  deleteTarget: (id, reassign_to = null) =>
    api.delete(`/admin/targets/${id}`, {
      params: reassign_to ? { reassign_to } : {},
    }),

  // System stats and cleanup
  getSystemStats: () => api.get("/admin/system-stats"),
  removeSampleData: () => api.post("/admin/remove-sample-data"),
};

// User management endpoints
export const userAPI = {
  getAllUsers: () => api.get("/users"),
  createUser: (data) => api.post("/users", data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  updateUser: (id, data) => api.patch(`/users/${id}`, data),
};

// Recurring Transaction endpoints
export const recurringTransactionAPI = {
  create: (data) => api.post("/recurring-transactions", data),
  getAll: () => api.get("/recurring-transactions"),
  getById: (id) => api.get(`/recurring-transactions/${id}`),
  update: (id, data) => api.put(`/recurring-transactions/${id}`, data),
  delete: (id) => api.delete(`/recurring-transactions/${id}`),
};

// Goals endpoints
export const goalAPI = {
  create: (data) => api.post("/goals", data),
  getAll: (includeCompleted = true) =>
    api.get("/goals", { params: { includeCompleted } }),
  getById: (id) => api.get(`/goals/${id}`),
  update: (id, data) => api.put(`/goals/${id}`, data),
  delete: (id) => api.delete(`/goals/${id}`),
  addContribution: (id, data) => api.post(`/goals/${id}/contributions`, data),
  getContributions: (id) => api.get(`/goals/${id}/contributions`),
  deleteContribution: (contributionId) =>
    api.delete(`/goals/contributions/${contributionId}`),
  setCurrentAmount: (id, amount) =>
    api.put(`/goals/${id}/amount`, { amount }),
  getSummary: () => api.get("/goals/summary"),
};
