// Custom hook for accessing prefetched data
import { useState, useEffect, useRef, useCallback } from "react";
import { getPrefetchedData } from "../utils/dataPrefetcher.js";
import { showPrefetchHit } from "../utils/prefetchNotifications.js";
import { useLocation } from "react-router-dom";

export const usePrefetchedData = (fallbackFetcher) => {
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      try {
        if (isCancelled) return;

        setLoading(true);
        setError(null);

        // First, try to get prefetched data
        const prefetchedData = getPrefetchedData(location.pathname);

        if (prefetchedData && !isCancelled) {
          // Use prefetched data immediately
          setData(prefetchedData);
          setLoading(false);
          return;
        }

        // If no prefetched data available, fall back to normal fetching
        if (fallbackFetcher && !isCancelled) {
          const fetchedData = await fallbackFetcher();

          if (!isCancelled) {
            setData(fetchedData);
          }
        }

        if (!isCancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Error loading data:", err);
          setError(err);
          setLoading(false);
        }
      }
    };

    loadData();

    // Cleanup function
    return () => {
      isCancelled = true;
    };
  }, [location.pathname]); // Removed fallbackFetcher from dependencies to prevent loops

  // Simple refresh function
  const refreshData = useCallback(async () => {
    if (!fallbackFetcher) return;

    try {
      setLoading(true);
      setError(null);
      const freshData = await fallbackFetcher();
      setData(freshData);
      setLoading(false);
    } catch (err) {
      console.error("Error refreshing data:", err);
      setError(err);
      setLoading(false);
    }
  }, []); // Empty dependencies to prevent recreation

  return {
    data,
    loading,
    error,
    refreshData,
    hasPrefetchedData: false, // Simplified for now
    isPrefetched: false, // Simplified for now
  };
};
