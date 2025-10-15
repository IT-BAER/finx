/**
 * Offline-First API Service
 * Handles API calls with offline support and sync queue
 */

import axios from "axios";
import offlineStorage from "../utils/offlineStorage.js";
import cache, { cacheKeys } from "../utils/cache.js";
import connectivity, { getIsOnline } from "./connectivity.js";
import { tRaw } from "../lib/i18n";

// Remove toast import since we'll use the global toastWithHaptic

const API_BASE_URL = "/api";

class OfflineAPI {
  constructor() {
  this.isOnline = typeof window !== "undefined" ? getIsOnline() : true;
    this.cacheTimeout = null;
  // Track in-flight full transaction fetches to prevent duplicate pagination loops
  this._inFlightFullFetches = new Map();
    // Cache the last full transactions dataset to reuse for snapshots/offline caching
    this._lastFullTransactions = null;
    this._lastFullTransactionsAt = 0;
    // Track freshness timestamps for auxiliary resources
    this._resourceFreshness = {
      categories: 0,
      sources: 0,
      targets: 0,
    };
    this.setupEventListeners();
    this.setupAxiosInterceptors();
    // Cache all data for offline use when the application starts
    // We'll check authentication inside the caching method
    if (this.isOnline) {
      setTimeout(() => {
        this.cacheAllOfflineData({ preFetchedTransactions: this._lastFullTransactions });
      }, 1000); // Delay to allow app to initialize
    }
  }

  setupEventListeners() {
    // Listen to server connectivity events
    window.addEventListener("serverConnectivityChange", (e) => {
      const nowOnline = !!(e && e.detail && e.detail.isOnline);
      this.isOnline = nowOnline;
      if (nowOnline) {
        if (window.toastWithHaptic?.success) {
          window.toastWithHaptic.success(tRaw("backOnlineSyncing"), {
            duration: 3000,
          });
        }
        try {
          offlineStorage.processSyncQueue();
        } catch (err) {
          console.warn("Could not start sync queue immediately", err);
        }
        if (this.cacheTimeout) {
          clearTimeout(this.cacheTimeout);
        }
        this.cacheTimeout = setTimeout(async () => {
          if (this.isAuthenticated()) {
            await this.cleanupDuplicateTransactions();
            await this.cacheAllOfflineData({ preFetchedTransactions: this._lastFullTransactions });
          }
          this.cacheTimeout = null;
          cache.remove(cacheKeys.DASHBOARD_DATA);
          cache.remove(cacheKeys.REPORT_DATA);
          window.dispatchEvent(new CustomEvent("dataRefreshNeeded"));
        }, 1000);
      } else {
        if (window.toastWithHaptic?.info) {
          window.toastWithHaptic.info(tRaw("serverUnavailableOfflineMode"), {
            duration: 5000,
          });
        }
      }
    });

    // Fallback: also mirror browser offline to immediate feedback
    window.addEventListener("offline", () => {
      this.isOnline = false;
      if (window.toastWithHaptic?.success) {
        // Use info variant when browser reports offline
        window.toastWithHaptic.info(tRaw("youAreOfflineWillSync"), {
          duration: 5000,
        });
      }
    });
  }

  setupAxiosInterceptors() {
    // Request interceptor
    axios.interceptors.request.use((config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor
    axios.interceptors.response.use(
      async (response) => {
        // Cache successful GET responses
        if (response.config.method === "get" && response.status === 200) {
          // Use the same cache key generation as the get method
          const fullUrl = response.config.url.startsWith(API_BASE_URL)
            ? response.config.url
            : `${API_BASE_URL}${response.config.url}`;
          const cacheKey = this.getCacheKey(fullUrl, response.config.params);
          console.log("Caching API response for:", cacheKey);
          await offlineStorage.cacheAPIResponse(cacheKey, response.data);

          // Special handling for categories, sources, and targets
          if (fullUrl.includes("/categories")) {
            // Normalize categories data before caching
            const categories = response.data.categories || response.data;
            await offlineStorage.cacheCategories(categories);
          } else if (fullUrl.includes("/sources")) {
            // Normalize sources data before caching
            const sources = response.data.sources || response.data;
            await offlineStorage.cacheSources(sources);
          } else if (fullUrl.includes("/targets")) {
            // Normalize targets data before caching
            const targets = response.data.targets || response.data;
            await offlineStorage.cacheTargets(targets);
          }
        }
        return response;
      },
      (error) => {
        if (!this.isOnline && (error.code === "ERR_NETWORK" || error.message === "Network Error")) {
          // Handle offline error gracefully
          console.log("Network error while offline, using cached data");
        }
        return Promise.reject(error);
      },
    );
  }

  getCacheKey(url, params = {}) {
    // Ensure we're using the full URL for caching
    const fullUrl = url.startsWith(API_BASE_URL)
      ? url
      : `${API_BASE_URL}${url}`;
    const paramString =
      Object.keys(params).length > 0
        ? "?" + new URLSearchParams(params).toString()
        : "";
    return `${fullUrl}${paramString}`;
  }

  // Generic GET request with offline support
  async get(endpoint, params = {}) {
    // Use the full endpoint with API base URL for caching
    const fullEndpoint = endpoint.startsWith(API_BASE_URL)
      ? endpoint
      : `${API_BASE_URL}${endpoint}`;
    const cacheKey = this.getCacheKey(fullEndpoint, params);

    try {
      if (this.isOnline) {
        const response = await axios.get(fullEndpoint, { params });
        return response.data;
      } else {
        throw new Error("Offline");
      }
    } catch (error) {
      // Try to get cached data when offline or on error
      const cachedData = await offlineStorage.getCachedAPIResponse(cacheKey);
      if (cachedData) {
        console.log("Using cached data for:", endpoint);
        return cachedData;
      }
      // If no cached data, throw a more specific error
      throw new Error(`No cached data available for ${endpoint}`);
    }
  }

  // Get transaction by ID with caching for offline editing
  async getTransactionById(id) {
    // ID from URL is a string. Offline transaction IDs are numbers.
    const numericId = /^\d+$/.test(id) ? parseInt(id, 10) : null;

    if (numericId) {
      const localTransactions = await this.getLocalTransactions();
      const localTransaction = localTransactions.find(
        (t) => t.id === numericId || t._tempId === numericId,
      );
      if (localTransaction) {
        console.log(
          "Found offline transaction in local list for editing:",
          localTransaction,
        );
        return localTransaction;
      }
    }

    try {
      if (this.isOnline) {
        const response = await axios.get(`${API_BASE_URL}/transactions/${id}`);
        const transaction = response.data;

        // Cache the transaction for offline editing
        if (transaction && transaction.transaction) {
          await offlineStorage.cacheTransactionForEditing(
            transaction.transaction,
          );
        }

        return transaction.transaction;
      } else {
        // Try to get cached transaction for editing
        const cachedTransaction =
          await offlineStorage.getCachedTransactionForEditing(id);
        if (cachedTransaction) {
          return cachedTransaction;
        }
        // If no cached data, throw a more specific error
        throw new Error("No cached data available for this transaction");
      }
    } catch (error) {
      // Try to get cached transaction for editing
      const cachedTransaction =
        await offlineStorage.getCachedTransactionForEditing(id);
      if (cachedTransaction) {
        return cachedTransaction;
      }
      // Re-throw the error if no cached data
      throw error;
    }
  }

  // Generic POST request with offline queue support
  async post(endpoint, data, options = {}) {
    if (this.isOnline) {
      try {
        const response = await axios.post(`${API_BASE_URL}${endpoint}`, data);
        return response.data;
      } catch (error) {
        if (options.queueOnFailure) {
          await this.queueRequest("POST", endpoint, data);
          return { queued: true, tempId: Date.now() };
        }
        throw error;
      }
    } else {
      // Queue for later sync
      await this.queueRequest("POST", endpoint, data);
      return { queued: true, tempId: Date.now() };
    }
  }

  // Generic PUT request with offline queue support
  async put(endpoint, data, options = {}) {
    if (this.isOnline) {
      try {
        const response = await axios.put(`${API_BASE_URL}${endpoint}`, data);
        return response.data;
      } catch (error) {
        if (options.queueOnFailure) {
          await this.queueRequest("PUT", endpoint, data);
          return { queued: true };
        }
        throw error;
      }
    } else {
      // Queue for later sync
      await this.queueRequest("PUT", endpoint, data);
      return { queued: true };
    }
  }

  // Generic DELETE request with offline queue support
  async delete(endpoint, options = {}) {
    if (this.isOnline) {
      try {
        const response = await axios.delete(`${API_BASE_URL}${endpoint}`);
        return response.data;
      } catch (error) {
        if (options.queueOnFailure) {
          await this.queueRequest("DELETE", endpoint);
          return { queued: true };
        }
        throw error;
      }
    } else {
      // Queue for later sync
      await this.queueRequest("DELETE", endpoint);
      return { queued: true };
    }
  }

  // Queue request for later sync
  async queueRequest(method, endpoint, data = null) {
    const type = this.getRequestType(endpoint);
    await offlineStorage.addToSyncQueue(
      type,
      method,
      `${API_BASE_URL}${endpoint}`,
      data,
    );
  }

  // Determine request type from endpoint
  getRequestType(endpoint) {
    if (endpoint.includes("/transactions")) return "transaction";
    if (endpoint.includes("/categories")) return "category";
    if (endpoint.includes("/sources")) return "source";
    if (endpoint.includes("/targets")) return "target";
    return "other";
  }

  // Transaction-specific methods
  async getTransactions(params = {}) {
    const response = await this.get("/transactions", params);
    return response.transactions || [];
  }

  // Fetch all online transactions across pages with limit/offset pagination
  async getAllOnlineTransactions(params = {}) {
    // If offline, return empty to allow local fallback
    if (!this.isOnline) {
      return [];
    }
    const pageLimit = Math.min(Number(params.limit) || 100, 200); // cap per-page
    let offset = Number(params.offset) || 0;
    const maxPages = 100; // hard cap to prevent runaway loops (up to ~20k records)
    const all = [];
    for (let page = 0; page < maxPages; page++) {
      const batch = await this.get("/transactions", {
        ...params,
        limit: pageLimit,
        offset,
      });
      const rows = batch.transactions || batch.data?.transactions || batch || [];
      if (!Array.isArray(rows) || rows.length === 0) break;
      all.push(...rows);
      if (rows.length < pageLimit) break;
      offset += pageLimit;
    }
    return all;
  }

  async createTransaction(data) {
    if (!this.isOnline) {
      const tempId = Date.now();
      const dataWithTempId = { ...data, _tempId: tempId };
      await this.queueRequest("POST", "/transactions", dataWithTempId);

      const localTransaction = {
        ...data,
        id: tempId,
        _isOffline: true,
        _tempId: tempId,
        date: new Date(data.date).toISOString().split("T")[0],
        _createdAt: new Date().toISOString(),
        source_name: data.source || null,
        target_name: data.target || null,
      };
      await this.storeLocalTransaction(localTransaction);

      // Also append to snapshot so relaunch while still offline shows it together with previous items
      try {
        const userId = this.getCurrentUserId();
        if (userId) {
          const key = `transactions_snapshot_user_${userId}`;
          const current = (await offlineStorage.getOfflineData(key)) || [];
          const entry = {
            id: localTransaction.id,
            date: localTransaction.date,
            description: localTransaction.description,
            amount: localTransaction.amount,
            type: localTransaction.type,
            category_name: localTransaction.category_name,
            source_name: localTransaction.source_name || localTransaction.source || null,
            target_name: localTransaction.target_name || localTransaction.target || null,
            user_id: userId,
          };
          const updated = [entry, ...current].slice(0, 50);
          await offlineStorage.storeOfflineData(key, updated);
        }
      } catch (e) {}

      // Notify UI to refresh lists
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("transactionAdded"));
        window.dispatchEvent(new CustomEvent("dataRefreshNeeded"));
      }

      if (data.isRecurring) {
        // Build a normalized recurring payload for compatibility with older servers
        const recurringData = {
          title:
            (data.description && String(data.description).trim()) ||
            (data.type !== "income" && data.category
              ? String(data.category).trim()
              : "") ||
            `Recurring ${data.type || "transaction"}`,
          amount: data.amount,
          type: data.type,
          category_id:
            data.category_id != null && data.category_id !== ""
              ? data.category_id
              : null,
          source: data.source || null,
          target: data.target || null,
          description: data.description || "",
          recurrence_type: data.recurrence_type || "monthly",
          recurrence_interval: data.recurrence_interval || 1,
          start_date: data.start_date || data.date, // map base date
          end_date: data.end_date || null,
          max_occurrences: data.max_occurrences || null,
          transaction_id: tempId,
        };
        await this.queueRequest(
          "POST",
          "/recurring-transactions",
          recurringData,
        );
      }

      return { transaction: localTransaction, queued: true };
    }

  const result = await this.post("/transactions", data);

    if (data.isRecurring) {
      // Build a normalized recurring payload for compatibility with older servers
      const recurringData = {
        title:
          (data.description && String(data.description).trim()) ||
          (data.type !== "income" && data.category
            ? String(data.category).trim()
            : "") ||
          `Recurring ${data.type || "transaction"}`,
        amount: data.amount,
        type: data.type,
        category_id:
          data.category_id != null && data.category_id !== ""
            ? data.category_id
            : null,
        source: data.source || null,
        target: data.target || null,
        description: data.description || "",
        recurrence_type: data.recurrence_type || "monthly",
        recurrence_interval: data.recurrence_interval || 1,
        start_date: data.start_date || data.date, // map base date
        end_date: data.end_date || null,
        max_occurrences: data.max_occurrences || null,
        transaction_id: result.transaction.id,
      };
      await this.post("/recurring-transactions", recurringData);
    }

    // Notify UI to refresh lists regardless of duplicate/created
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("transactionAdded"));
      window.dispatchEvent(new CustomEvent("dataRefreshNeeded"));
    }
    // Update transactions snapshot with the newly created online transaction
    try {
      const userId = this.getCurrentUserId();
      if (userId && result?.transaction) {
        const key = `transactions_snapshot_user_${userId}`;
        const current = (await offlineStorage.getOfflineData(key)) || [];
        const entry = {
          id: result.transaction.id,
          date: result.transaction.date,
          description: result.transaction.description,
          amount: result.transaction.amount,
          type: result.transaction.type,
          category_name: result.transaction.category_name,
          source_name: result.transaction.source_name || result.transaction.source || null,
          target_name: result.transaction.target_name || result.transaction.target || null,
          user_id: result.transaction.user_id,
        };
        const updated = [entry, ...current].slice(0, 50);
        await offlineStorage.storeOfflineData(key, updated);
      }
    } catch (e) {}
    return result;
  }

  async updateTransaction(id, data) {
    const result = await this.put(`/transactions/${id}`, data, {
      queueOnFailure: true,
    });

    // If queued, update local storage
    if (result.queued) {
      const numericId = parseInt(id, 10);
      const localTransaction = {
        ...data,
        id: numericId, // Ensure ID is a number for local storage consistency
        _isOffline: true,
        // Ensure source_name and target_name are set for proper UI display
        source_name: data.source || null,
        target_name: data.target || null,
      };
      await this.updateLocalTransaction(id, localTransaction);

      // Also update the cached single-transaction entry used by the editor
      try {
        await offlineStorage.cacheTransactionForEditing({
          id: numericId,
          ...localTransaction,
        });
      } catch (e) {
        console.warn("Failed to cache transaction for offline editing", e);
      }
      return { ...localTransaction, queued: true }; // Return the updated local data
    }

    return result;
  }

  async deleteTransaction(id) {
    const result = await this.delete(`/transactions/${id}`, {
      queueOnFailure: true,
    });

    // If queued, mark as deleted locally
    if (result.queued) {
      await this.markLocalTransactionDeleted(id);
    } else {
      // If deleted successfully online, also remove from local storage
      await this.removeLocalTransaction(id);
    }

    return result;
  }

  // Local storage methods for transactions
  async storeLocalTransaction(transaction) {
    const userId = this.getCurrentUserId();
    const key = `transactions_user_${userId}`;

    let transactions = (await offlineStorage.getOfflineData(key)) || [];
    transactions.push(transaction);

    // Keep only the last 10 transactions for offline editing
    if (transactions.length > 10) {
      transactions = transactions.slice(-10);
    }

    await offlineStorage.storeOfflineData(key, transactions);
  }

  async updateLocalTransaction(id, updatedTransaction) {
    const userId = this.getCurrentUserId();
    const key = `transactions_user_${userId}`;

    let transactions = (await offlineStorage.getOfflineData(key)) || [];
    // ID from URL is a string, local IDs are numbers. Use loose equality or parse.
    const numericId = parseInt(id, 10);
    const index = transactions.findIndex(
      (t) => t.id === numericId || t._tempId === numericId,
    );

    if (index !== -1) {
      const originalTransaction = transactions[index];
      transactions[index] = {
        ...originalTransaction,
        ...updatedTransaction,
      };
      await offlineStorage.storeOfflineData(key, transactions);
    } else {
      // Not present locally (e.g., editing an existing online transaction while offline) -> add it
      transactions.push({ ...updatedTransaction });
      await offlineStorage.storeOfflineData(key, transactions);
    }
  }

  async markLocalTransactionDeleted(id) {
    const userId = this.getCurrentUserId();
    const key = `transactions_user_${userId}`;

    let transactions = (await offlineStorage.getOfflineData(key)) || [];
    const index = transactions.findIndex(
      (t) => t.id === id || t._tempId === id,
    );

    if (index !== -1) {
      transactions[index]._isDeleted = true;
      await offlineStorage.storeOfflineData(key, transactions);
    }
  }

  async removeLocalTransaction(id) {
    const userId = this.getCurrentUserId();
    const key = `transactions_user_${userId}`;

    let transactions = (await offlineStorage.getOfflineData(key)) || [];
    const filteredTransactions = transactions.filter(
      (t) => t.id !== id && t._tempId !== id,
    );

    await offlineStorage.storeOfflineData(key, filteredTransactions);
  }

  async getLocalTransactions() {
    const userId = this.getCurrentUserId();
    const key = `transactions_user_${userId}`;

    console.log("getLocalTransactions - userId:", userId, "key:", key);

    const localTransactions = (await offlineStorage.getOfflineData(key)) || [];
    console.log(
      "getLocalTransactions - raw transactions:",
      localTransactions.length,
    );

    const filtered = localTransactions.filter((t) => !t._isDeleted);
    console.log(
      "getLocalTransactions - filtered transactions:",
      filtered.length,
    );

    return filtered;
  }

  // Get cached transactions for offline editing (last 10)
  async getCachedTransactionsForEditing() {
    const userId = this.getCurrentUserId();
    const key = `transactions_user_${userId}`;

    const localTransactions = (await offlineStorage.getOfflineData(key)) || [];
    return localTransactions
      .filter((t) => !t._isDeleted)
      .slice(-10) // Get last 10 transactions
      // Sort by YYYY-MM-DD strings to avoid timezone-induced shifts
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }

  // Merge online and offline transactions
  async getAllTransactions(params = {}) {
    // Support a single-page mode for list views (e.g., infinite scroll)
    const { pageOnly } = params || {};
    if (pageOnly) {
      try {
        // Do not pass control params to server
        const { pageOnly: _omit, ...requestParams } = params || {};
        // Fetch a single page from server when online
        let onlineRows = [];
        if (this.isOnline) {
          const page = await this.get("/transactions", requestParams);
          onlineRows = page.transactions || page.data?.transactions || (Array.isArray(page) ? page : []) || [];
        } else {
          // Offline: use snapshot as a stand-in for the first page
          onlineRows = await this.getTransactionsSnapshot();
        }

        // Always merge with local offline edits; include them on the first page only
        const localTransactions = await this.getLocalTransactions();
        const offset = Number(requestParams.offset) || 0;

        const map = new Map();
        // Online items first, mark data source
        for (const tx of onlineRows) {
          map.set(tx.id, { ...tx, _dataSource: "online" });
        }

  // Include local items only on the first page to avoid repeating them on subsequent pages
  if (offset === 0) {
          for (const localTx of localTransactions) {
            if (map.has(localTx.id)) {
              // Prefer local when it's an offline edit of an existing online transaction
              const existing = map.get(localTx.id);
              if (localTx._isOffline) {
                map.set(localTx.id, { ...existing, ...localTx, _dataSource: "local" });
              }
              continue;
            }
            const key = localTx._tempId || localTx.id;
            map.set(key, { ...localTx, _dataSource: "local" });
          }
        }

        const merged = Array.from(map.values());
        // Sort by YYYY-MM-DD string, newest first (avoids timezone issues)
        return merged.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      } catch (error) {
        // Offline/error: merge snapshot (as base) with local edits, prefer local
        const [snap, local] = await Promise.all([
          this.getTransactionsSnapshot(),
          this.getLocalTransactions(),
        ]);
        const map = new Map();
        for (const tx of snap || []) map.set(tx.id, { ...tx, _dataSource: "snapshot" });
        for (const tx of local || []) {
          const key = tx._tempId || tx.id;
          map.set(key, { ...map.get(key), ...tx, _dataSource: "local" });
        }
        const merged = Array.from(map.values());
        return merged.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      }
    }

    // In-flight de-duplication for full dataset fetches (online only, non pageOnly)
    if (this.isOnline && !params.pageOnly && !params.forceRefresh) {
      try {
        const key = JSON.stringify({ all: true, params: { ...params, forceRefresh: undefined } });
        if (this._inFlightFullFetches.has(key)) {
          return await this._inFlightFullFetches.get(key);
        }
        const execPromise = (async () => {
          try {
            // Existing logic below (mirrors the try/catch further down) but isolated for dedup
            const onlineTransactions = await this.getAllOnlineTransactions(params);
            const localTransactions = await this.getLocalTransactions();

            console.log(
              "getAllTransactions - Online transactions (dedup in-flight):",
              onlineTransactions.length,
            );
            console.log(
              "getAllTransactions - Local transactions:",
              localTransactions.length,
            );

            const transactionMap = new Map();
            onlineTransactions.forEach((tx) => {
              transactionMap.set(tx.id, { ...tx, _dataSource: "online" });
            });
            localTransactions.forEach((localTx) => {
              if (transactionMap.has(localTx.id)) {
                if (localTx._isOffline) {
                  transactionMap.set(localTx.id, { ...transactionMap.get(localTx.id), ...localTx, _dataSource: "local" });
                }
                return;
              }
              if (localTx._isOffline) {
                const possibleDuplicate = onlineTransactions.find(
                  (onlineTx) =>
                    onlineTx.description === localTx.description &&
                    parseFloat(onlineTx.amount) === parseFloat(localTx.amount) &&
                    onlineTx.type === localTx.type &&
                    onlineTx.date === localTx.date,
                );
                if (possibleDuplicate) {
                  this.removeLocalTransaction(localTx.id || localTx._tempId);
                  return;
                }
                const keyLocal = localTx._tempId || localTx.id;
                transactionMap.set(keyLocal, { ...localTx, _dataSource: "local" });
              } else {
                transactionMap.set(localTx.id, { ...localTx, _dataSource: "local" });
              }
            });
            const allTransactions = Array.from(transactionMap.values());
            console.log(
              "getAllTransactions - Final deduplicated transactions (in-flight):",
              allTransactions.length,
            );
            // Store snapshot for reuse
            this._lastFullTransactions = allTransactions;
            this._lastFullTransactionsAt = Date.now();
            return allTransactions.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          } catch (error) {
            console.log(
              "getAllTransactions - Error (in-flight path), returning merged local + snapshot:",
              error.message,
            );
            const [snap, local] = await Promise.all([
              this.getTransactionsSnapshot(),
              this.getLocalTransactions(),
            ]);
            const map = new Map();
            for (const tx of snap || []) map.set(tx.id, { ...tx, _dataSource: "snapshot" });
            for (const tx of local || []) {
              const keyLocal = tx._tempId || tx.id;
              map.set(keyLocal, { ...map.get(keyLocal), ...tx, _dataSource: "local" });
            }
            const merged = Array.from(map.values());
            return merged.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          }
        })();
        this._inFlightFullFetches.set(key, execPromise);
        try {
          return await execPromise;
        } finally {
          this._inFlightFullFetches.delete(key);
        }
      } catch (e) {
        // Fall through to normal logic if something unexpected happened
      }
    }

    try {
      // Fetch full online dataset (paginated) instead of a single page
      const onlineTransactions = await this.getAllOnlineTransactions(params);
      const localTransactions = await this.getLocalTransactions();

      console.log(
        "getAllTransactions - Online transactions:",
        onlineTransactions.length,
      );
      console.log(
        "getAllTransactions - Local transactions:",
        localTransactions.length,
      );
      console.log(
        "getAllTransactions - Local transaction details:",
        localTransactions.map((t) => ({
          id: t.id,
          tempId: t._tempId,
          isOffline: t._isOffline,
          description: t.description,
        })),
      );

      // Create a map for better deduplication based on multiple criteria
      const transactionMap = new Map();

      // Add online transactions first (they have priority)
      onlineTransactions.forEach((tx) => {
        transactionMap.set(tx.id, { ...tx, _dataSource: "online" });
      });

      // Process local transactions
      localTransactions.forEach((localTx) => {
        // Skip if this transaction is already in the map (from online)
        if (transactionMap.has(localTx.id)) {
          // If local item represents an offline edit, prefer it over the cached online copy
          if (localTx._isOffline) {
            console.log(
              "Overriding online transaction with local offline edit:",
              localTx.id,
            );
            transactionMap.set(localTx.id, {
              ...localTx,
              _dataSource: "local",
            });
          } else {
            console.log(
              "Skipping duplicate local transaction with ID:",
              localTx.id,
            );
          }
          return;
        }

        // For offline transactions, check if they might be duplicates based on content
        if (localTx._isOffline) {
          // Check if there's an online transaction with similar content that might be the synced version
          const possibleDuplicate = onlineTransactions.find(
            (onlineTx) =>
              onlineTx.description === localTx.description &&
              parseFloat(onlineTx.amount) === parseFloat(localTx.amount) &&
              onlineTx.type === localTx.type &&
              onlineTx.date === localTx.date,
          );

          if (possibleDuplicate) {
            console.log(
              "Found possible duplicate for offline transaction:",
              localTx._tempId,
              "matching online:",
              possibleDuplicate.id,
            );
            // Clean up the local transaction since it's been synced
            console.log("Removing duplicate local transaction immediately...");
            this.removeLocalTransaction(localTx.id || localTx._tempId);
            return; // Skip this local transaction as it's likely a duplicate
          }

          // Add offline transaction with temp ID as key to avoid conflicts
          const key = localTx._tempId || localTx.id;
          transactionMap.set(key, { ...localTx, _dataSource: "local" });
        } else {
          // For non-offline local transactions, add them if not already present
          transactionMap.set(localTx.id, { ...localTx, _dataSource: "local" });
        }
      });

      const allTransactions = Array.from(transactionMap.values());

      console.log(
        "getAllTransactions - Final deduplicated transactions:",
        allTransactions.length,
      );

      // Sort by YYYY-MM-DD string, newest first (avoids timezone issues)
  const sortedAll = allTransactions.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  this._lastFullTransactions = sortedAll;
  this._lastFullTransactionsAt = Date.now();
  return sortedAll;
    } catch (error) {
      console.log(
        "getAllTransactions - Error, returning merged local + snapshot:",
        error.message,
      );
      // Offline/error: merge snapshot with local, prefer local
      const [snap, local] = await Promise.all([
        this.getTransactionsSnapshot(),
        this.getLocalTransactions(),
      ]);
      const map = new Map();
      for (const tx of snap || []) map.set(tx.id, { ...tx, _dataSource: "snapshot" });
      for (const tx of local || []) {
        const key = tx._tempId || tx.id;
        map.set(key, { ...map.get(key), ...tx, _dataSource: "local" });
      }
      const merged = Array.from(map.values());
      return merged.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    }
  }

  // Category methods
  async getCategories() {
    try {
      const response = await this.get("/categories");
      return (
        response.categories || response.data?.categories || response.data || []
      );
    } catch (error) {
      // Try to get cached categories
      const cachedCategories = await offlineStorage.getCachedCategories();
      if (cachedCategories) {
        // Return in the same format as the online response
        return cachedCategories;
      }
      throw error;
    }
  }

  async createCategory(data) {
    return this.post("/categories", data, { queueOnFailure: true });
  }

  // Source methods
  async getSources() {
    try {
      const response = await this.get("/sources");
      return response.sources || response.data?.sources || response.data || [];
    } catch (error) {
      // Try to get cached sources
      const cachedSources = await offlineStorage.getCachedSources();
      if (cachedSources) {
        // Return in the same format as the online response
        return cachedSources;
      }
      throw error;
    }
  }

  async createSource(data) {
    return this.post("/sources", data, { queueOnFailure: true });
  }

  // Target methods
  async getTargets() {
    try {
      const response = await this.get("/targets");
      return response.targets || response.data?.targets || response.data || [];
    } catch (error) {
      // Try to get cached targets
      const cachedTargets = await offlineStorage.getCachedTargets();
      if (cachedTargets) {
        // Return in the same format as the online response
        return cachedTargets;
      }
      throw error;
    }
  }

  async createTarget(data) {
    return this.post("/targets", data, { queueOnFailure: true });
  }

  // Auth methods
  async login(credentials) {
    return this.post("/auth/login", credentials);
  }

  async register(userData) {
    return this.post("/auth/register", userData);
  }

  // Utility methods
  getCurrentUserId() {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      // Try different common field names for user ID
      const userId =
        payload.userId || payload.user_id || payload.sub || payload.id;
      return userId;
    } catch (error) {
      return null;
    }
  }

  isAuthenticated() {
    const token = localStorage.getItem("token");
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      // Check if token is expired
      const expiry = payload.exp;
      if (expiry) {
        const now = Math.floor(Date.now() / 1000);
        return now < expiry;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get sync status
  async getSyncStatus() {
    const queueCount = await offlineStorage.getSyncQueueCount();
    return {
      isOnline: this.isOnline,
      pendingSync: queueCount,
      hasOfflineData: queueCount > 0,
    };
  }

  // Clean up duplicate transactions
  async cleanupDuplicateTransactions() {
    try {
      const onlineTransactions = await this.getTransactions();
      const localTransactions = await this.getLocalTransactions();

      console.log("Cleanup: Checking for duplicates...");

      const duplicatesToRemove = [];

      localTransactions.forEach((localTx) => {
        // Find potential duplicates in online transactions
        const duplicate = onlineTransactions.find(
          (onlineTx) =>
            onlineTx.description === localTx.description &&
            parseFloat(onlineTx.amount) === parseFloat(localTx.amount) &&
            onlineTx.type === localTx.type &&
            onlineTx.date === localTx.date,
        );

        if (duplicate) {
          console.log(
            "Cleanup: Found duplicate to remove:",
            localTx._tempId || localTx.id,
          );
          duplicatesToRemove.push(localTx.id || localTx._tempId);
        }
      });

      // Remove duplicates from local storage
      for (const id of duplicatesToRemove) {
        await this.removeLocalTransaction(id);
      }

      console.log("Cleanup: Removed", duplicatesToRemove.length, "duplicates");
  // Important: Do NOT clear the sync queue here; it may contain valid
  // PUT/DELETE operations we still need to sync. We'll let the normal
  // sync process handle reconciliation.
    } catch (error) {
      console.error("Error cleaning up duplicates:", error);
    }
  }

  // Clear all local transaction data (for debugging)
  async clearAllLocalData() {
    try {
      const userId = this.getCurrentUserId();
      if (userId) {
        const key = `transactions_user_${userId}`;
        await offlineStorage.storeOfflineData(key, []);
        console.log("Cleared all local transaction data");
      }
      await offlineStorage.clearSyncQueue();
      console.log("Cleared sync queue");
    } catch (error) {
      console.error("Error clearing local data:", error);
    }
  }

  // Debug methods
  async debugSyncQueue() {
    const queue = await offlineStorage.getSyncQueue();
    console.log("Current sync queue:", queue);
    return queue;
  }

  async debugLocalTransactions() {
    const local = await this.getLocalTransactions();
    console.log("Current local transactions:", local);
    return local;
  }

  async manualSync() {
    console.log("Manual sync triggered...");
    await offlineStorage.processSyncQueue();
  }

  async forceCleanupDuplicates() {
    console.log("Force cleanup duplicates...");
    try {
      const onlineTransactions = await this.getTransactions();
      const localTransactions = await this.getLocalTransactions();

      console.log("Online transactions:", onlineTransactions.length);
      console.log("Local transactions:", localTransactions.length);

      let removedCount = 0;

      for (const localTx of localTransactions) {
        if (localTx._isOffline) {
          // Find matching online transaction
          const duplicate = onlineTransactions.find(
            (onlineTx) =>
              onlineTx.description === localTx.description &&
              parseFloat(onlineTx.amount) === parseFloat(localTx.amount) &&
              onlineTx.type === localTx.type &&
              onlineTx.date === localTx.date,
          );

          if (duplicate) {
            console.log(
              "Removing duplicate local transaction:",
              localTx._tempId || localTx.id,
            );
            await this.removeLocalTransaction(localTx.id || localTx._tempId);
            removedCount++;
          }
        }
      }

      console.log("Removed", removedCount, "duplicate transactions");

      // Also clear sync queue
      await offlineStorage.clearSyncQueue();

      return removedCount;
    } catch (error) {
      console.error("Error in force cleanup:", error);
    }
  }

  async cacheAllOfflineData(options = {}) {
    const { preFetchedTransactions = null, reuseLastFull = true } = options || {};
    if (!this.isOnline) return;

    // Check if user is authenticated before caching
    if (!this.isAuthenticated()) {
      console.log("User not authenticated, skipping data caching");
      return;
    }

    try {
      console.log("Caching all data for offline use...");

      const RESOURCE_TTL = 5 * 60 * 1000; // 5 minutes

      // Helper to decide fetch
      const nowTs = Date.now();

      // Categories
      if (nowTs - this._resourceFreshness.categories > RESOURCE_TTL) {
        const categoriesResponse = await this.get("/categories");
        console.log("Cached categories:", categoriesResponse);
        if (categoriesResponse) {
          const categories =
            categoriesResponse.categories ||
            categoriesResponse.data?.categories ||
            categoriesResponse.data ||
            categoriesResponse;
          if (Array.isArray(categories)) {
            await offlineStorage.cacheCategories(categories);
            this._resourceFreshness.categories = nowTs;
          }
        }
      } else {
        console.log("Skipping categories fetch - fresh");
      }

      // Sources
      if (nowTs - this._resourceFreshness.sources > RESOURCE_TTL) {
        const sourcesResponse = await this.get("/sources");
        console.log("Cached sources:", sourcesResponse);
        if (sourcesResponse) {
          const sources =
            sourcesResponse.sources ||
            sourcesResponse.data?.sources ||
            sourcesResponse.data ||
            sourcesResponse;
          if (Array.isArray(sources)) {
            await offlineStorage.cacheSources(sources);
            this._resourceFreshness.sources = nowTs;
          }
        }
      } else {
        console.log("Skipping sources fetch - fresh");
      }

      // Targets
      if (nowTs - this._resourceFreshness.targets > RESOURCE_TTL) {
        const targetsResponse = await this.get("/targets");
        console.log("Cached targets:", targetsResponse);
        if (targetsResponse) {
          const targets =
            targetsResponse.targets ||
            targetsResponse.data?.targets ||
            targetsResponse.data ||
            targetsResponse;
          if (Array.isArray(targets)) {
            await offlineStorage.cacheTargets(targets);
            this._resourceFreshness.targets = nowTs;
          }
        }
      } else {
        console.log("Skipping targets fetch - fresh");
      }

      // Reuse existing full transactions if available instead of refetching small slice
      let transactionsList = Array.isArray(preFetchedTransactions)
        ? preFetchedTransactions
        : (reuseLastFull && Array.isArray(this._lastFullTransactions)
            ? this._lastFullTransactions
            : null);

      if (!transactionsList) {
        try {
          // Fallback: minimal fetch only if we truly have nothing cached
          const transactionsResponse = await this.get("/transactions", { limit: 10 });
          console.log("Cached recent transactions (fallback fetch):", transactionsResponse);
          transactionsList = (transactionsResponse && (transactionsResponse.transactions || transactionsResponse.data?.transactions)) || [];
        } catch (e) {
          console.warn("Failed to fetch fallback recent transactions", e);
          transactionsList = [];
        }
      } else {
        console.log("Reusing pre-fetched full transactions list for snapshot:", transactionsList.length);
      }

      // Build snapshot (limit to 50 recent by date)
      try {
        const userId = this.getCurrentUserId();
        if (userId) {
          const key = `transactions_snapshot_user_${userId}`;
          const sortedRecent = [...transactionsList]
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
            .slice(0, 50)
            .map((tx) => ({
              id: tx.id,
              _tempId: undefined,
              _isOffline: false,
              date: tx.date,
              description: tx.description,
              amount: tx.amount,
              type: tx.type,
              category_name: tx.category_name,
              source_name: tx.source_name || tx.source || null,
              target_name: tx.target_name || tx.target || null,
              user_id: tx.user_id,
              recurring_id: tx.recurring_id || null,
            }));
          await offlineStorage.storeOfflineData(key, sortedRecent);
        }
      } catch (e) {
        console.warn("Failed to store transactions snapshot", e);
      }

      // Cache individual transactions for offline editing (limit to 25 most recent to bound storage)
      try {
        const forEditing = [...transactionsList]
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
          .slice(0, 25);
        for (const transaction of forEditing) {
          const transactionForCaching = {
            ...transaction,
            source_name: transaction.source_name || transaction.source || null,
            target_name: transaction.target_name || transaction.target || null,
          };
          await offlineStorage.cacheTransactionForEditing(transactionForCaching);
        }
        console.log("Cached individual transactions for offline editing (reuse path)");
      } catch (e) {
        console.warn("Failed caching individual transactions (reuse path)", e);
      }

      // Pre-cache dashboard/report data for Reports page (weekly, monthly, yearly)
      try {
        const now = new Date();

        // Weekly: last 7 days including today
        const weekEnd = new Date(now);
        const weekStart = new Date(now);
        weekStart.setDate(weekEnd.getDate() - 6);
        const weekParams = {
          startDate: `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`,
          endDate: `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`,
        };
        await this.get("/transactions/dashboard", weekParams);

        // Monthly: current month
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const monthParams = {
          startDate: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-${String(monthStart.getDate()).padStart(2, "0")}`,
          endDate: `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`,
        };
        await this.get("/transactions/dashboard", monthParams);

        // Yearly: current year
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31);
        const yearParams = {
          startDate: `${yearStart.getFullYear()}-01-01`,
          endDate: `${yearEnd.getFullYear()}-12-31`,
        };
        await this.get("/transactions/dashboard", yearParams);
        console.log("Pre-cached reports dashboard data for weekly/monthly/yearly");
      } catch (e) {
        console.warn("Failed to pre-cache reports data", e);
      }

      console.log("All data cached for offline use");
    } catch (error) {
      console.error("Error caching data for offline use:", error);
    }
  }

  // Return a snapshot for offline relaunch when no local queue data exists
  async getTransactionsSnapshot() {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) return [];
      const key = `transactions_snapshot_user_${userId}`;
      const rows = (await offlineStorage.getOfflineData(key)) || [];
      if (!Array.isArray(rows)) return [];
      // Newest first by date
      return rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    } catch (e) {
      return [];
    }
  }
}

// Create singleton instance
const offlineAPI = new OfflineAPI();

// Make it available globally for debugging
if (typeof window !== "undefined") {
  window.offlineAPI = offlineAPI;
}

export default offlineAPI;
