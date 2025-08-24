/**
 * Offline Storage Manager
 * Handles offline data storage and sync queue
 */

const DB_NAME = "FinXOfflineDB";
const DB_VERSION = 1;

import connectivity, { getIsOnline } from "../services/connectivity.js";

class OfflineStorage {
  constructor() {
    this.db = null;
  this.isOnline = typeof window !== "undefined" ? getIsOnline() : true;
    this.syncQueue = [];
    this.initDB();
    this.setupEventListeners();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store for cached API data
        if (!db.objectStoreNames.contains("apiCache")) {
          const apiStore = db.createObjectStore("apiCache", { keyPath: "key" });
          apiStore.createIndex("endpoint", "endpoint", { unique: false });
          apiStore.createIndex("timestamp", "timestamp", { unique: false });
        }

        // Store for offline transactions queue
        if (!db.objectStoreNames.contains("syncQueue")) {
          const syncStore = db.createObjectStore("syncQueue", {
            keyPath: "id",
            autoIncrement: true,
          });
          syncStore.createIndex("type", "type", { unique: false });
          syncStore.createIndex("timestamp", "timestamp", { unique: false });
        }

        // Store for offline data
        if (!db.objectStoreNames.contains("offlineData")) {
          const offlineStore = db.createObjectStore("offlineData", {
            keyPath: "key",
          });
          offlineStore.createIndex("type", "type", { unique: false });
        }
      };
    });
  }

  setupEventListeners() {
    // React to server connectivity changes instead of device online status
    window.addEventListener("serverConnectivityChange", (e) => {
      const nowOnline = !!(e && e.detail && e.detail.isOnline);
      this.isOnline = nowOnline;
      if (nowOnline) {
        console.log("Server reachable - triggering sync...");
        this.processSyncQueue();
      } else {
        console.log("Server unreachable - offline mode");
      }
    });
  }

  // Cache API responses
  async cacheAPIResponse(endpoint, data) {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(["apiCache"], "readwrite");
    const store = transaction.objectStore("apiCache");

    const cacheEntry = {
      key: endpoint,
      endpoint: endpoint,
      data: data,
      timestamp: Date.now(),
    };

    return store.put(cacheEntry);
  }

  // Cache categories for offline use
  async cacheCategories(categories) {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(["offlineData"], "readwrite");
    const store = transaction.objectStore("offlineData");

    const entry = {
      key: "cached_categories",
      type: "categories",
      data: categories,
      timestamp: Date.now(),
    };

    return store.put(entry);
  }

  // Get cached categories
  async getCachedCategories() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["offlineData"], "readonly");
      const store = transaction.objectStore("offlineData");
      const request = store.get("cached_categories");

      request.onsuccess = () => {
        const result = request.result;
        if (result && this.isCacheValid(result.timestamp)) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Cache sources for offline use
  async cacheSources(sources) {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(["offlineData"], "readwrite");
    const store = transaction.objectStore("offlineData");

    const entry = {
      key: "cached_sources",
      type: "sources",
      data: sources,
      timestamp: Date.now(),
    };

    return store.put(entry);
  }

  // Get cached sources
  async getCachedSources() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["offlineData"], "readonly");
      const store = transaction.objectStore("offlineData");
      const request = store.get("cached_sources");

      request.onsuccess = () => {
        const result = request.result;
        if (result && this.isCacheValid(result.timestamp)) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Cache targets for offline use
  async cacheTargets(targets) {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(["offlineData"], "readwrite");
    const store = transaction.objectStore("offlineData");

    const entry = {
      key: "cached_targets",
      type: "targets",
      data: targets,
      timestamp: Date.now(),
    };

    return store.put(entry);
  }

  // Get cached targets
  async getCachedTargets() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["offlineData"], "readonly");
      const store = transaction.objectStore("offlineData");
      const request = store.get("cached_targets");

      request.onsuccess = () => {
        const result = request.result;
        if (result && this.isCacheValid(result.timestamp)) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Cache specific transaction data for offline editing
  async cacheTransactionForEditing(transaction) {
    if (!this.db) await this.initDB();

    const transactionStore = this.db.transaction(["offlineData"], "readwrite");
    const store = transactionStore.objectStore("offlineData");

    // Create a key specifically for cached transactions for editing
    const key = `cached_transaction_${transaction.id}`;
    const entry = {
      key: key,
      type: "cached_transaction",
      data: transaction,
      timestamp: Date.now(),
    };

    return store.put(entry);
  }

  // Get cached transaction for editing
  async getCachedTransactionForEditing(transactionId) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["offlineData"], "readonly");
      const store = transaction.objectStore("offlineData");
      const key = `cached_transaction_${transactionId}`;
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result && this.isCacheValid(result.timestamp)) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Clear cached transactions for editing
  async clearCachedTransactionsForEditing() {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(["offlineData"], "readwrite");
    const store = transaction.objectStore("offlineData");
    const index = store.index("type");
    const range = IDBKeyRange.only("cached_transaction");

    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get cached API response
  async getCachedAPIResponse(endpoint) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["apiCache"], "readonly");
      const store = transaction.objectStore("apiCache");
      const request = store.get(endpoint);

      request.onsuccess = () => {
        const result = request.result;
        console.log("Retrieving cached data for:", endpoint, result);
        if (result && this.isCacheValid(result.timestamp)) {
          console.log("Using valid cached data for:", endpoint);
          resolve(result.data);
        } else {
          console.log("No valid cached data for:", endpoint);
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Check if cache is still valid (24 hours)
  isCacheValid(timestamp) {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return Date.now() - timestamp < maxAge;
  }

  // Add item to sync queue (with nextAttempt for exponential backoff)
  async addToSyncQueue(type, method, endpoint, data) {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(["syncQueue"], "readwrite");
    const store = transaction.objectStore("syncQueue");

    const queueItem = {
      type: type, // 'transaction', 'category', etc.
      method: method, // 'POST', 'PUT', 'DELETE'
      endpoint: endpoint,
      data: data,
      timestamp: Date.now(),
      retries: 0,
      nextAttempt: Date.now(), // immediate attempt when processing
    };

    return new Promise((resolve, reject) => {
      const request = store.add(queueItem);
      request.onsuccess = () => {
        console.log("Added to sync queue:", queueItem);
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get all items from sync queue
  async getSyncQueue() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["syncQueue"], "readonly");
      const store = transaction.objectStore("syncQueue");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Remove item from sync queue
  async removeFromSyncQueue(id) {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(["syncQueue"], "readwrite");
    const store = transaction.objectStore("syncQueue");
    return store.delete(id);
  }

  // Process sync queue when online with retry/backoff logic
  async processSyncQueue() {
    console.log("processSyncQueue called, isOnline:", this.isOnline);
    if (!this.isOnline) return;

    if (this.syncInProgress) {
      console.log("Sync already in progress, skipping...");
      return;
    }
    this.syncInProgress = true;

    try {
      const now = Date.now();
      const queue = await this.getSyncQueue();
      console.log(
        `Processing ${queue.length} items in sync queue (filtered by due time)`,
      );

      if (!queue || queue.length === 0) {
        console.log("Sync queue is empty - nothing to sync");
        return;
      }

      let hasTransactionUpdates = false;

      for (const item of queue) {
        // Skip items not due yet
        if (item.nextAttempt && item.nextAttempt > now) {
          continue;
        }

        try {
          console.log("Attempting to sync item:", item);
          await this.syncItem(item);
          await this.removeFromSyncQueue(item.id);
          console.log("Synced item successfully:", item.type);

          if (item.type === "transaction") {
            hasTransactionUpdates = true;
          }
        } catch (error) {
          console.error("Failed to sync item:", item.id, error);

          // Retry/backoff strategy
          const MAX_RETRIES = 5;
          const retries = (item.retries || 0) + 1;
          if (retries > MAX_RETRIES) {
            console.warn(
              `Giving up on sync item ${item.id} after ${retries} retries`,
            );
            // Remove from queue to avoid infinite loop; optionally persist to failed store for debugging
            await this.removeFromSyncQueue(item.id);
          } else {
            // Exponential backoff in minutes
            const delayMinutes = Math.pow(2, retries); // 2,4,8,16...
            const nextAttempt = Date.now() + delayMinutes * 60 * 1000;
            // Update item in place with increased retries and nextAttempt
            await new Promise((resolve, reject) => {
              const tx = this.db.transaction(["syncQueue"], "readwrite");
              const store = tx.objectStore("syncQueue");
              const req = store.get(item.id);
              req.onsuccess = () => {
                const obj = req.result;
                if (obj) {
                  obj.retries = retries;
                  obj.nextAttempt = nextAttempt;
                  const putReq = store.put(obj);
                  putReq.onsuccess = () => resolve();
                  putReq.onerror = () => reject(putReq.error);
                } else {
                  resolve();
                }
              };
              req.onerror = () => reject(req.error);
            });
            console.log(
              `Scheduled retry #${retries} for item ${item.id} at ${new Date(nextAttempt).toISOString()}`,
            );
          }
        }
      }

      if (hasTransactionUpdates) {
        console.log("Dispatching transaction sync events...");
        window.dispatchEvent(new CustomEvent("transactionsSynced"));
        window.dispatchEvent(new CustomEvent("dataRefreshNeeded"));
      }
    } finally {
      this.syncInProgress = false;
      console.log("Sync process completed");
    }
  }

  // Sync individual item (fetch + robust handling)
  async syncItem(item) {
    if (!this.db) await this.initDB();
    const token = localStorage.getItem("token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const resp = await fetch(item.endpoint, {
      method: item.method,
      headers,
      body: item.data ? JSON.stringify(item.data) : undefined,
    });

    if (!resp.ok) {
      throw new Error(`Sync failed: ${resp.status}`);
    }

    const result = await resp.json();

    // Post-sync cleanup and caching updates
    // CREATE (POST) -> remove local temp transaction if tempId present
    if (
      item.method === "POST" &&
      item.endpoint.includes("/transactions") &&
      item.data &&
      item.data._tempId
    ) {
      const tempId = item.data._tempId;
      const userId = this.getCurrentUserId();
      if (userId) {
        const key = `transactions_user_${userId}`;
        const localTransactions = (await this.getOfflineData(key)) || [];
        const filtered = localTransactions.filter(
          (t) => !(t._tempId === tempId || t.id === tempId),
        );
        if (filtered.length < localTransactions.length) {
          await this.storeOfflineData(key, filtered);
        }
      }
    }

    // UPDATE (PUT/PATCH) -> update cached transaction
    if (
      (item.method === "PUT" || item.method === "PATCH") &&
      item.endpoint.includes("/transactions/") &&
      item.data
    ) {
      const transactionId = item.endpoint.split("/").pop();
      if (transactionId) {
        const cached = await this.getCachedTransactionForEditing(transactionId);
        if (cached) {
          const updated = {
            ...cached,
            ...(result.transaction || {}),
            source_name:
              result.transaction?.source_name ||
              result.transaction?.source ||
              cached.source ||
              null,
            target_name:
              result.transaction?.target_name ||
              result.transaction?.target ||
              cached.target ||
              null,
          };
          await this.cacheTransactionForEditing(updated);
        }

        // Also update the local transactions list and clear the _isOffline flag
        const userId = this.getCurrentUserId();
        if (userId) {
          const key = `transactions_user_${userId}`;
          const localTransactions = (await this.getOfflineData(key)) || [];
          const numId = parseInt(transactionId, 10);
          const idx = localTransactions.findIndex(
            (t) => t.id === numId || t._tempId === numId,
          );
          if (idx !== -1) {
            const merged = {
              ...localTransactions[idx],
              ...(result.transaction || {}),
              _isOffline: false,
              source_name:
                result.transaction?.source_name ||
                localTransactions[idx].source_name ||
                localTransactions[idx].source ||
                null,
              target_name:
                result.transaction?.target_name ||
                localTransactions[idx].target_name ||
                localTransactions[idx].target ||
                null,
            };
            localTransactions[idx] = merged;
            await this.storeOfflineData(key, localTransactions);
          }
        }

        // Notify UI to refresh
        try {
          window.dispatchEvent(new CustomEvent("transactionsSynced"));
          window.dispatchEvent(new CustomEvent("dataRefreshNeeded"));
        } catch (e) {}
      }
    }

    // DELETE -> cleanup local storage and cached transaction
    if (item.method === "DELETE" && item.endpoint.includes("/transactions/")) {
      const transactionId = item.endpoint.split("/").pop();
      if (transactionId) {
        const userId = this.getCurrentUserId();
        if (userId) {
          const key = `transactions_user_${userId}`;
          const localTransactions = (await this.getOfflineData(key)) || [];
          const filtered = localTransactions.filter(
            (t) =>
              t.id !== transactionId &&
              t._tempId !== transactionId &&
              !t._isDeleted,
          );
          await this.storeOfflineData(key, filtered);
        }
        const cacheKey = `cached_transaction_${transactionId}`;
        const tx = this.db.transaction(["offlineData"], "readwrite");
        const store = tx.objectStore("offlineData");
        store.delete(cacheKey);
      }
    }

    return result;
  }

  // Get current user ID from token
  getCurrentUserId() {
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("getCurrentUserId: No token found");
      return null;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      console.log("getCurrentUserId: Token payload:", payload);

      // Try different common field names for user ID
      const userId =
        payload.userId || payload.user_id || payload.sub || payload.id;
      console.log("getCurrentUserId: Extracted user ID:", userId);

      return userId;
    } catch (error) {
      console.log("getCurrentUserId: Error parsing token:", error);
      return null;
    }
  }

  // Store offline data
  async storeOfflineData(key, data) {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(["offlineData"], "readwrite");
    const store = transaction.objectStore("offlineData");

    const entry = {
      key: key,
      type: key.split("_")[0], // e.g., 'transactions_user_123' -> 'transactions'
      data: data,
      timestamp: Date.now(),
    };

    return store.put(entry);
  }

  // Get offline data
  async getOfflineData(key) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["offlineData"], "readonly");
      const store = transaction.objectStore("offlineData");
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Clear old cache entries
  async clearOldCache() {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(["apiCache"], "readwrite");
    const store = transaction.objectStore("apiCache");
    const index = store.index("timestamp");

    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
    const range = IDBKeyRange.upperBound(cutoff);

    return (index.openCursor(range).onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    });
  }

  // Get sync queue count
  async getSyncQueueCount() {
    const queue = await this.getSyncQueue();
    return queue.length;
  }

  // Clear all items from sync queue
  async clearSyncQueue() {
    if (!this.db) await this.initDB();

    const transaction = this.db.transaction(["syncQueue"], "readwrite");
    const store = transaction.objectStore("syncQueue");

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => {
        console.log("Sync queue cleared");
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get all storage keys for debugging
  async getAllStorageKeys() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["offlineData"], "readonly");
      const store = transaction.objectStore("offlineData");
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Create singleton instance
const offlineStorage = new OfflineStorage();

export default offlineStorage;
