// Data prefetching utility for adjacent pages during swipe navigation
import {
  transactionAPI,
  categoryAPI,
  sourceAPI,
  targetAPI,
} from "../services/api.jsx";
import { getCachedData, setCachedData } from "./cache.js";
import {
  showPrefetchSuccess,
  showPrefetchError,
} from "./prefetchNotifications.js";

// Define data requirements for each swipeable page
const PAGE_DATA_REQUIREMENTS = {
  "/dashboard": {
    key: "dashboard",
    fetcher: async () => {
      // Get last 7 days data for dashboard
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 6);

      const startDateStr = sevenDaysAgo.toISOString().split("T")[0];
      const endDateStr = now.toISOString().split("T")[0];

      // Determine months to fetch based on screen size
      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
      const monthsToFetch = isMobile ? 3 : isTablet ? 6 : 12;

      const startDateForIncomeChart = new Date(
        now.getFullYear(),
        now.getMonth() - (monthsToFetch - 1),
        1,
      );
      const endDateForIncomeChart = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      );

      // Fetch dashboard data, monthly data, and transactions in parallel
      const [dashboardRes, incomeVsExpensesRes, allTransactionsRes] =
        await Promise.all([
          transactionAPI.getDashboardData({
            startDate: startDateStr,
            endDate: endDateStr,
          }),
          transactionAPI.getDashboardData({
            startDate: startDateForIncomeChart.toISOString().split("T")[0],
            endDate: endDateForIncomeChart.toISOString().split("T")[0],
          }),
          transactionAPI.getAll(),
        ]);

      return {
        ...dashboardRes.data.data,
        incomeVsExpensesData: incomeVsExpensesRes.data.data,
        recentTransactions: allTransactionsRes.data.transactions.slice(0, 5),
      };
    },
  },

  "/transactions": {
    key: "transactions",
    fetcher: async () => {
      // Fetch transactions list
      const transactionsRes = await transactionAPI.getAll();
      return transactionsRes.data.transactions || [];
    },
  },

  "/reports": {
    key: "reports",
    fetcher: async () => {
      // Get current date for reports
      const now = new Date();

      // Get weekly data (last 7 days)
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 6);
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const weekEndStr = now.toISOString().split("T")[0];

      // Get monthly data (current month)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const monthStartStr = monthStart.toISOString().split("T")[0];
      const monthEndStr = monthEnd.toISOString().split("T")[0];

      // Get yearly data (current year)
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearEnd = new Date(now.getFullYear(), 11, 31);
      const yearStartStr = yearStart.toISOString().split("T")[0];
      const yearEndStr = yearEnd.toISOString().split("T")[0];

      // Fetch all report data in parallel
      const [weeklyRes, monthlyRes, yearlyRes] = await Promise.all([
        transactionAPI.getReportData({
          startDate: weekStartStr,
          endDate: weekEndStr,
        }),
        transactionAPI.getReportData({
          startDate: monthStartStr,
          endDate: monthEndStr,
        }),
        transactionAPI.getReportData({
          startDate: yearStartStr,
          endDate: yearEndStr,
        }),
      ]);

      return {
        weekly: weeklyRes.data,
        monthly: monthlyRes.data,
        yearly: yearlyRes.data,
      };
    },
  },

  "/settings": {
    key: "settings",
    fetcher: async () => {
      // Settings page doesn't need much data prefetching
      // Just ensure user data and basic categories are available
      const [categoriesRes, sourcesRes, targetsRes] = await Promise.all([
        categoryAPI.getAll(),
        sourceAPI.getAll(),
        targetAPI.getAll(),
      ]);

      return {
        categories: categoriesRes.data,
        sources: sourcesRes.data,
        targets: targetsRes.data,
      };
    },
  },
};

// Cache for prefetch promises to avoid duplicate requests
const prefetchPromises = new Map();

// Prefetch data for a specific page
export const prefetchPageData = async (pagePath) => {
  const requirement = PAGE_DATA_REQUIREMENTS[pagePath];
  if (!requirement) {
    console.warn(`No data requirements defined for page: ${pagePath}`);
    return null;
  }

  const cacheKey = `prefetch_${requirement.key}`;

  // Check if data is already cached
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  // Check if we're already fetching this data
  if (prefetchPromises.has(cacheKey)) {
    return prefetchPromises.get(cacheKey);
  }

  // Start fetching data
  const fetchPromise = requirement
    .fetcher()
    .then((data) => {
      // Cache the data for 3 minutes (shorter TTL for prefetched data)
      setCachedData(cacheKey, data, 3 * 60 * 1000);
      prefetchPromises.delete(cacheKey);

      // Show success notification in development
      if (process.env.NODE_ENV === "development") {
        showPrefetchSuccess(pagePath);
      }

      return data;
    })
    .catch((error) => {
      console.warn(`Failed to prefetch data for ${pagePath}:`, error);
      prefetchPromises.delete(cacheKey);

      // Show error notification in development
      if (process.env.NODE_ENV === "development") {
        showPrefetchError(pagePath, error);
      }

      return null;
    });

  prefetchPromises.set(cacheKey, fetchPromise);
  return fetchPromise;
};

// Prefetch data for adjacent pages based on current page
export const prefetchAdjacentPages = (currentPagePath, swipeableRoutes) => {
  const currentIndex = swipeableRoutes.findIndex(
    (route) => route.path === currentPagePath,
  );
  if (currentIndex === -1) return;

  const adjacentPages = [];

  // Add previous page
  if (currentIndex > 0) {
    adjacentPages.push(swipeableRoutes[currentIndex - 1].path);
  }

  // Add next page
  if (currentIndex < swipeableRoutes.length - 1) {
    adjacentPages.push(swipeableRoutes[currentIndex + 1].path);
  }

  // Only prefetch if we have adjacent pages and we're not already prefetching
  if (adjacentPages.length === 0) return;

  // Use requestIdleCallback for better performance if available
  const prefetchWhenIdle = () => {
    adjacentPages.forEach((pagePath, index) => {
      // Stagger prefetch requests to avoid overwhelming the server
      setTimeout(() => {
        prefetchPageData(pagePath).catch((err) => {
          console.warn(`Failed to prefetch ${pagePath}:`, err);
        });
      }, index * 150); // Reduced delay for faster prefetching
    });
  };

  // Use requestIdleCallback if available, otherwise use setTimeout
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(prefetchWhenIdle, { timeout: 1000 });
  } else {
    setTimeout(prefetchWhenIdle, 300); // Reduced delay
  }
};

// Get prefetched data for a page
export const getPrefetchedData = (pagePath) => {
  const requirement = PAGE_DATA_REQUIREMENTS[pagePath];
  if (!requirement) return null;

  const cacheKey = `prefetch_${requirement.key}`;
  return getCachedData(cacheKey);
};

// Clear prefetch cache
export const clearPrefetchCache = () => {
  Object.values(PAGE_DATA_REQUIREMENTS).forEach((requirement) => {
    const cacheKey = `prefetch_${requirement.key}`;
    setCachedData(cacheKey, null, 0); // Set TTL to 0 to immediately expire
  });
  prefetchPromises.clear();
};

// Preload critical data that's needed across multiple pages
export const preloadCriticalData = async () => {
  try {
    // Use requestIdleCallback to preload when the browser is idle
    const preloadWhenIdle = async () => {
      // Preload categories, sources, and targets as they're used across multiple pages
      await Promise.all([
        categoryAPI.getAll(),
        sourceAPI.getAll(),
        targetAPI.getAll(),
      ]);
      console.log("Critical data preloaded successfully");
    };

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(preloadWhenIdle, { timeout: 2000 });
    } else {
      setTimeout(preloadWhenIdle, 1000);
    }
  } catch (error) {
    console.warn("Failed to preload critical data:", error);
  }
};

// Utility to check if a page has prefetched data available
export const hasPrefetchedData = (pagePath) => {
  const requirement = PAGE_DATA_REQUIREMENTS[pagePath];
  if (!requirement) return false;

  const cacheKey = `prefetch_${requirement.key}`;
  return !!getCachedData(cacheKey);
};

// Utility to get cache statistics for debugging
export const getPrefetchStats = () => {
  const stats = {};
  Object.entries(PAGE_DATA_REQUIREMENTS).forEach(([path, requirement]) => {
    const cacheKey = `prefetch_${requirement.key}`;
    stats[path] = {
      cached: !!getCachedData(cacheKey),
      fetching: prefetchPromises.has(cacheKey),
    };
  });
  return stats;
};
