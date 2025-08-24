import axios from "axios";
import { getAuthToken } from "../utils/auth";
import cache, { getCachedData, setCachedData, cacheKeys } from "../utils/cache";
import offlineStorage from "../utils/offlineStorage.js";
import { getIsOnline } from "./connectivity.js";
// Removed prefetchData import to avoid circular dependency
// Rate limiting removed temporarily
// Removed prefetchData import to avoid circular dependency

// Create axios instance with relative URL for proxy support
const api = axios.create({
  baseURL: "/api",
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Handle 401 errors (unauthorized) by logging out the user
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Remove token and redirect to login
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// Auth endpoints
export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
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

    // Persistent cache key used by offlineStorage
    const persistentKey = `/api/transactions/dashboard${
      params && Object.keys(params || {}).length
        ? `?${new URLSearchParams(params).toString()}`
        : ""
    }`;

    // If offline, try persistent cache in IndexedDB
  if (typeof window !== "undefined" && !getIsOnline()) {
      const persisted = await offlineStorage.getCachedAPIResponse(persistentKey);
      if (persisted) {
        return { data: persisted };
      }
    }

    // Fetch from API
    const response = await api.get("/transactions/dashboard", { params });
    // Write to in-memory cache (2 minutes)
    setCachedData(cacheKey, response.data.data, 2 * 60 * 1000);
    // Persist entire response payload for robust offline fallback
    try {
      await offlineStorage.cacheAPIResponse(persistentKey, response.data);
    } catch {}
    return response;
  },
  getReportData: async (params) => {
    const cacheKey = `${cacheKeys.REPORT_DATA}_${JSON.stringify(params || {})}`;

    // In-memory cache first
    const cached = getCachedData(cacheKey);
    if (cached) {
      return Promise.resolve({ data: { data: cached } });
    }

    // Persistent cache key used by offlineStorage
    const persistentKey = `/api/transactions/dashboard${
      params && Object.keys(params || {}).length
        ? `?${new URLSearchParams(params).toString()}`
        : ""
    }`;

    // If offline, try persistent cache in IndexedDB
  if (typeof window !== "undefined" && !getIsOnline()) {
      const persisted = await offlineStorage.getCachedAPIResponse(persistentKey);
      if (persisted) {
        return { data: persisted };
      }
    }

    // Fetch from API
    const response = await api.get("/transactions/dashboard", { params });
    // Cache the result for 2 minutes (report data can change frequently)
    setCachedData(cacheKey, response.data.data, 2 * 60 * 1000);
    // Persist entire response payload for robust offline fallback
    try {
      await offlineStorage.cacheAPIResponse(persistentKey, response.data);
    } catch {}
    return response;
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
