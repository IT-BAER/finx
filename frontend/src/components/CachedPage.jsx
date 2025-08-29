import React, { memo, useMemo, useEffect } from "react";
import { useUICache } from "../contexts/UICacheContext.jsx";
/**
 * CachedPage
 * - memoizes static UI parts and stores a reference in the in-memory UICacheContext
 * - optionally asks the service worker to cache UI routes/resources via cacheUIRoutes
 *
 * Props:
 * - children: page markup (React nodes)
 * - dynamicProps: array/object used as dependency to determine when to re-render
 * - cacheKey: optional string key to store the cached element in UICacheContext
 * - preloadUrls: optional array of URLs (strings) to request the SW to cache (UI assets/routes)
 */
const CachedPage = memo(
  ({ children, dynamicProps, cacheKey, preloadUrls = [] }) => {
    const { cacheUIElement } = useUICache();

    // Memoize the rendered children; updating only when dynamicProps changes.
    const memoizedChildren = useMemo(() => children, [dynamicProps, children]);

    useEffect(() => {
      // Store the memoized element in the in-memory UI cache so other components can reuse it.
      if (cacheKey && typeof cacheUIElement === "function") {
        try {
          cacheUIElement(cacheKey, memoizedChildren);
        } catch (err) {
          // non-fatal
          console.warn(
            "CachedPage: failed to cache UI element in UICacheContext",
            err,
          );
        }
      }

      // Preloading functionality removed temporarily
    }, [cacheKey, JSON.stringify(preloadUrls)]);

    return memoizedChildren;
  },
);

export default CachedPage;
