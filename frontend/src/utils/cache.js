// Enhanced in-memory cache for API responses with LRU eviction
class SimpleCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.timeouts = new Map();
    this.maxSize = maxSize;
  }

  // Set a value in the cache with an optional TTL (time to live) in milliseconds
  set(key, value, ttl = 5 * 60 * 1000) {
    // Default 5 minutes
    // If cache is at max size, remove the least recently used item
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.remove(firstKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });

    // Clear any existing timeout for this key
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
    }

    // Set a timeout to automatically remove the entry after TTL
    if (ttl > 0) {
      const timeout = setTimeout(() => {
        this.cache.delete(key);
        this.timeouts.delete(key);
      }, ttl);

      this.timeouts.set(key, timeout);
    }
  }

  // Get a value from the cache if it exists and hasn't expired
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Move to end to mark as recently used
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  // Check if a key exists in the cache
  has(key) {
    return this.cache.has(key);
  }

  // Remove a specific key from the cache
  remove(key) {
    this.cache.delete(key);

    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
    }
  }

  // Clear all entries from the cache
  clear() {
    this.cache.clear();

    // Clear all timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Create a singleton instance
const cache = new SimpleCache();

export default cache;

// Helper functions for common cache operations
export const cacheKeys = {
  CATEGORIES: "categories",
  SOURCES: "sources",
  TARGETS: "targets",
  DASHBOARD_DATA: "dashboard_data",
  REPORT_DATA: "report_data",
  // Prefetch cache keys
  PREFETCH_DASHBOARD: "prefetch_dashboard",
  PREFETCH_TRANSACTIONS: "prefetch_transactions",
  PREFETCH_REPORTS: "prefetch_reports",
  PREFETCH_SETTINGS: "prefetch_settings",
};

export const getCachedData = (key) => {
  return cache.get(key);
};

export const setCachedData = (key, data, ttl) => {
  cache.set(key, data, ttl);
};

export const clearCache = () => {
  cache.clear();
};

export const clearCacheKey = (key) => {
  cache.remove(key);
};
