import React, { createContext, useContext, useMemo, useEffect } from "react";

const UICacheContext = createContext();

export const useUICache = () => useContext(UICacheContext);

const STORAGE_KEY = "finx_ui_cache_meta_v1";

/**
 * UICacheProvider
 * - In-memory cache for pre-rendered UI elements (pages/components) for fast navigation.
 * - Persists light metadata (which pages were cached) to localStorage so the app can
 *   know which UI entries were cached across reloads. We avoid serializing DOM/React
 *   elements to storage; actual DOM nodes remain in-memory only.
 */
export const UICacheProvider = ({ children }) => {
  // In-memory cache structure
  const cache = useMemo(
    () => ({
      pages: {}, // key -> element (DOM/React node) (in-memory only)
      components: {}, // optional component fragments
      meta: {}, // persisted metadata: { [key]: true }
    }),
    [],
  );

  // Hydrate metadata from localStorage on mount (do not try to restore DOM nodes)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          cache.meta = { ...cache.meta, ...parsed };
        }
      }
    } catch (err) {
      // ignore parse errors
      console.warn("UICache: failed to read metadata from localStorage", err);
    }
  }, []);

  // Internal write-through for metadata
  const persistMeta = (meta) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
    } catch (err) {
      console.warn("UICache: failed to persist metadata", err);
    }
  };

  // Add UI elements to in-memory cache and record metadata (if key is provided)
  const cacheUIElement = (key, element) => {
    if (!key) return;
    cache.pages[key] = element;
    cache.meta[key] = true;
    persistMeta(cache.meta);
  };

  // Get cached UI element (in-memory only). Returns undefined if not mounted.
  const getCachedUIElement = (key) => {
    return cache.pages[key];
  };

  // Clears cache entry (in-memory + metadata)
  const clearCacheEntry = (key) => {
    if (!key) return;
    delete cache.pages[key];
    if (cache.meta[key]) {
      delete cache.meta[key];
      persistMeta(cache.meta);
    }
  };

  // Clear all UI caches (in-memory + persisted meta)
  const clearAllCache = () => {
    cache.pages = {};
    cache.components = {};
    cache.meta = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn("UICache: failed to remove metadata", err);
    }
  };

  return (
    <UICacheContext.Provider
      value={{
        cacheUIElement,
        getCachedUIElement,
        clearCacheEntry,
        clearAllCache,
        hasCachedKey: (key) => !!cache.meta[key],
      }}
    >
      {children}
    </UICacheContext.Provider>
  );
};
