/**
 * Cache Service - Redis with in-memory LRU fallback
 * Provides a unified caching interface for dashboard summaries and other expensive queries
 * 
 * Features:
 * - Redis primary cache (if available)
 * - In-memory LRU fallback (no external dependencies)
 * - Automatic cache invalidation by key patterns
 * - TTL support
 */

const logger = require("../utils/logger");

// In-memory LRU cache implementation
class LRUCache {
    constructor(maxSize = 500) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.ttlMap = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return null;

        // Check TTL
        const expiry = this.ttlMap.get(key);
        if (expiry && Date.now() > expiry) {
            this.delete(key);
            return null;
        }

        // Move to end (most recently used)
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value, ttlMs = null) {
        // Delete first to update position
        if (this.cache.has(key)) {
            this.cache.delete(key);
            this.ttlMap.delete(key);
        }

        // Evict oldest if at capacity
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.delete(oldestKey);
        }

        this.cache.set(key, value);
        if (ttlMs) {
            this.ttlMap.set(key, Date.now() + ttlMs);
        }
    }

    delete(key) {
        this.cache.delete(key);
        this.ttlMap.delete(key);
    }

    clear() {
        this.cache.clear();
        this.ttlMap.clear();
    }

    // Delete keys matching a pattern (simple glob support)
    invalidatePattern(pattern) {
        let count = 0;
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.delete(key);
                count++;
            }
        }
        return count;
    }

    size() {
        return this.cache.size;
    }
}

// Redis client (lazy loaded)
let redisClient = null;
let redisAvailable = false;
let redisCheckDone = false;

// In-memory fallback
const memoryCache = new LRUCache(500);

/**
 * Initialize Redis connection (lazy, non-blocking)
 */
async function initRedis() {
    if (redisCheckDone) return redisAvailable;
    redisCheckDone = true;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        logger.info("REDIS_URL not set, using in-memory cache");
        return false;
    }

    try {
        // Dynamic import to avoid requiring redis as a dependency
        const Redis = require("ioredis");
        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 1000,
            enableReadyCheck: true,
            lazyConnect: true,
        });

        // Set up event handlers
        redisClient.on("error", (err) => {
            logger.error("Redis connection error:", err.message);
            redisAvailable = false;
        });

        redisClient.on("connect", () => {
            logger.info("Redis connected");
            redisAvailable = true;
        });

        redisClient.on("ready", () => {
            redisAvailable = true;
        });

        // Try to connect with timeout
        await Promise.race([
            redisClient.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Redis connection timeout")), 5000)),
        ]);

        redisAvailable = true;
        logger.info("Redis cache initialized");
        return true;
    } catch (error) {
        logger.warn(`Redis not available (${error.message}), using in-memory cache`);
        redisClient = null;
        return false;
    }
}

/**
 * Get a value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Cached value or null
 */
async function get(key) {
    await initRedis();

    if (redisAvailable && redisClient) {
        try {
            const value = await redisClient.get(key);
            if (value) {
                return JSON.parse(value);
            }
            return null;
        } catch (error) {
            logger.warn(`Redis get error for ${key}:`, error.message);
            // Fall through to memory cache
        }
    }

    return memoryCache.get(key);
}

/**
 * Set a value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds (default 60)
 */
async function set(key, value, ttlSeconds = 60) {
    await initRedis();

    // Always set in memory cache for fast reads
    memoryCache.set(key, value, ttlSeconds * 1000);

    if (redisAvailable && redisClient) {
        try {
            await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
        } catch (error) {
            logger.warn(`Redis set error for ${key}:`, error.message);
        }
    }
}

/**
 * Delete a specific key
 * @param {string} key - Cache key
 */
async function del(key) {
    memoryCache.delete(key);

    if (redisAvailable && redisClient) {
        try {
            await redisClient.del(key);
        } catch (error) {
            logger.warn(`Redis del error for ${key}:`, error.message);
        }
    }
}

/**
 * Invalidate all keys matching a pattern
 * @param {string} pattern - Pattern with * wildcards (e.g., "dashboard:123:*")
 * @returns {Promise<number>} - Number of keys invalidated
 */
async function invalidatePattern(pattern) {
    let count = memoryCache.invalidatePattern(pattern);

    if (redisAvailable && redisClient) {
        try {
            // Use SCAN for safe pattern matching (doesn't block)
            const stream = redisClient.scanStream({ match: pattern, count: 100 });
            const keysToDelete = [];

            for await (const keys of stream) {
                keysToDelete.push(...keys);
            }

            if (keysToDelete.length > 0) {
                await redisClient.unlink(...keysToDelete);
                count += keysToDelete.length;
            }
        } catch (error) {
            logger.warn(`Redis invalidatePattern error for ${pattern}:`, error.message);
        }
    }

    return count;
}

/**
 * Invalidate all cache entries for a user
 * @param {number} userId - User ID
 */
async function invalidateUser(userId) {
    return invalidatePattern(`*:${userId}:*`);
}

/**
 * Invalidate dashboard cache for a user
 * @param {number} userId - User ID
 */
async function invalidateDashboard(userId) {
    return invalidatePattern(`dashboard:${userId}:*`);
}

/**
 * Generate a cache key for dashboard data
 * @param {number} userId - User ID
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @param {string} viewMode - View mode
 * @returns {string} - Cache key
 */
function dashboardKey(userId, startDate, endDate, viewMode = "monthly") {
    return `dashboard:${userId}:${startDate}:${endDate}:${viewMode}`;
}

/**
 * Get cache statistics
 * @returns {object} - Stats object
 */
function stats() {
    return {
        memorySize: memoryCache.size(),
        redisAvailable,
        type: redisAvailable ? "redis+memory" : "memory",
    };
}

/**
 * Clear all cache (use sparingly)
 */
async function clear() {
    memoryCache.clear();

    if (redisAvailable && redisClient) {
        try {
            // Only clear finx-related keys, not entire Redis
            await invalidatePattern("dashboard:*");
            await invalidatePattern("report:*");
        } catch (error) {
            logger.warn("Redis clear error:", error.message);
        }
    }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
    if (redisClient) {
        try {
            await redisClient.quit();
            logger.info("Redis connection closed");
        } catch (error) {
            logger.warn("Redis shutdown error:", error.message);
        }
    }
}

module.exports = {
    get,
    set,
    del,
    invalidatePattern,
    invalidateUser,
    invalidateDashboard,
    dashboardKey,
    stats,
    clear,
    shutdown,
    initRedis,
};
