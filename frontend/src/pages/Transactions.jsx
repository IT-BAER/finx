import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import offlineAPI from "../services/offlineAPI.js";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "../hooks/useTranslation";
import { useAuth } from "../contexts/AuthContext";
import Button from "../components/Button";
import Icon from "../components/Icon.jsx";
import { motion, AnimatePresence } from "framer-motion";
import { motionTheme } from "../utils/motionTheme";
import useOfflineAPI from "../hooks/useOfflineAPI.js";
import Input from "../components/Input.jsx";
import { AnimatedPage, AnimatedSection } from "../components/AnimatedPage";
import { useInfiniteTransactions, useDeleteTransaction } from "../hooks/useQueries";

const Transactions = () => {
  const navigate = useNavigate();
  const { isDarkMode, language, user } = useAuth();
  const { t, formatDate, formatCurrency } = useTranslation();
  const isCurrentPage = useRef(true);
  const observer = useRef();
  const mobileSentinelRef = useRef();
  // Track IDs we've already rendered to avoid duplicates when appending
  const seenKeysRef = useRef(new Set());
  // Track IDs that have already been animated (so we don't re-animate on re-renders)
  const animatedIdsRef = useRef(new Set());
  // Track IDs that should animate in (newly loaded)
  const [newlyLoadedIds, setNewlyLoadedIds] = useState(new Set());
  
  // React Query mutation for delete
  const deleteTransactionMutation = useDeleteTransaction();

  // Helper function to get display source and target for transactions
  // For income transactions, we need to swap them for correct semantic display
  const getDisplaySourceTarget = (transaction) => {
    if (transaction.type === "income") {
      return {
        displaySource: transaction.target_name || transaction.target,
        displayTarget: transaction.source_name || transaction.source,
      };
    } else {
      return {
        displaySource: transaction.source_name || transaction.source,
        displayTarget: transaction.target_name || transaction.target,
      };
    }
  };

  // State for infinite scrolling
  const [rawTransactions, setRawTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  // Keep a server-side offset that counts only online (server) items
  const [serverOffset, setServerOffset] = useState(0);
  // Page size depends on device: 20 desktop, 10 mobile
  const [pageSize, setPageSize] = useState(20);

  // Search state (URL-powered) with tiny debounce
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = useMemo(() => searchParams.get("q") || "", []);
  const [searchInput, setSearchInput] = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ);
  const debounceTimerRef = useRef(null);

  // Process transactions with permission flags
  const transactions = useMemo(() => {
    if (!rawTransactions) return [];

    return rawTransactions.map((tx) => {
      // Use authenticated user from context as the single source of truth
      const currentUserId = user?.id ?? null;

      // Normalize owner id from backend fields
      const ownerId = tx.owner_user_id ?? tx.user_id ?? tx.ownerId ?? null;
      const isOwner =
        ownerId != null &&
        currentUserId != null &&
        Number(ownerId) === Number(currentUserId);

      // Backend can_edit is authoritative for shared items, but owner must always be editable
      let canEdit;
      if (tx._isOffline) {
        canEdit = true;
      } else if (isOwner) {
        canEdit = true; // owner can always edit own transactions
      } else if (typeof tx.can_edit === "boolean") {
        canEdit = tx.can_edit;
      } else {
        canEdit = false; // shared unknown -> safest default is read-only
      }

      return { ...tx, readOnly: !canEdit };
    });
  }, [rawTransactions, user]);

  // Debounce the search input and sync to URL param
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchInput);
      const q = searchInput.trim();
      const next = new URLSearchParams(searchParams);
      if (q) next.set("q", q);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    }, 150);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchInput]);

  const isSearching = debouncedQuery.trim().length > 0;

  // When search query changes, trigger a server-side search
  useEffect(() => {
    // Reset pagination state and reload with search query
    setServerOffset(0);
    seenKeysRef.current = new Set();
    animatedIdsRef.current = new Set();
    setNewlyLoadedIds(new Set());
    if (debouncedQuery.trim()) {
      // Server-side search with higher limit for better results
      loadTransactions(0, false, 50, debouncedQuery.trim());
    } else {
      // No search query - load normal paginated results
      loadTransactions(0, false, pageSize);
    }
  }, [debouncedQuery, pageSize]);

  // Build a lightweight search index and filter across columns
  const filteredTransactions = useMemo(() => {
    // Normalizer: case-insensitive and accent/diacritic-insensitive
    const normalize = (s) =>
      (s || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        // Remove combining diacritical marks (covers umlauts and many accents)
        .replace(/[\u0300-\u036f]/g, "");

    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return transactions;

    const tokens = q
      .split(/\s+/)
      .map((s) => normalize(s))
      .filter(Boolean);
    if (tokens.length === 0) return transactions;

    return transactions.filter((tx) => {
      // Join all searchable fields
      const dateStr = normalize(formatDate(tx.date));
      const rawDate = normalize(
        typeof tx.date === "string" ? tx.date.slice(0, 10) : "",
      );
      const desc = normalize(tx.description);
      const cat = normalize(tx.category_name || tx.category);
      const source = normalize(tx.source_name || tx.source);
      const target = normalize(tx.target_name || tx.target);
      const amountRaw = normalize(tx.amount);
      let amountPretty = "";
      try {
        amountPretty = normalize(
          `${tx.type === "income" ? "+" : "-"}${formatCurrency(
            parseFloat(tx.amount || 0),
          )}`,
        );
      } catch (e) {}
      const typeStr = normalize(tx.type);
      const recurring = tx.recurring_id ? "recurring" : "";

      const hay = `${dateStr} ${rawDate} ${desc} ${cat} ${source} ${target} ${amountRaw} ${amountPretty} ${typeStr} ${recurring}`;

      // Every token must match (AND semantics)
      for (const t of tokens) {
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [transactions, debouncedQuery, formatDate, formatCurrency]);

  // Load transactions with pagination parameters
  const loadTransactions = async (
    offsetValue = 0,
    append = false,
    overrideLimit = null,
    searchQuery = null,
  ) => {
    try {
      if (!append) {
        setLoading(true);
      }
      const requestedLimit = overrideLimit ?? pageSize;
  const params = { limit: requestedLimit, offset: offsetValue, pageOnly: true };
  // Add search query to server request if provided
  if (searchQuery) {
    params.q = searchQuery;
  }
  const data = await offlineAPI.getAllTransactions(params);
      // We always treat `data` as a single page possibly containing both online and local (offline) items.
      const pageItems = Array.isArray(data) ? data : [];

      // Determine how many were actually returned by server (ignore local when deciding hasMore/offset)
      const onlineCount = pageItems.filter((tx) => tx._dataSource !== "local").length;

      // Helper to compute a stable unique key
      const getKey = (tx) =>
        tx?._tempId != null ? `tmp:${tx._tempId}` : `id:${tx?.id}`;

      if (!append) {
        // If we got no items (e.g., offline with no snapshot), keep the current list
        if (!pageItems || pageItems.length === 0) {
          setHasMore(false);
        } else {
          // Reset seen keys and list on fresh load
          seenKeysRef.current = new Set();
          const uniqueFirstPage = [];
          for (const tx of pageItems) {
            const k = getKey(tx);
            if (!seenKeysRef.current.has(k)) {
              seenKeysRef.current.add(k);
              uniqueFirstPage.push(tx);
            }
          }
          // Only replace list if we actually have content
          if (uniqueFirstPage.length > 0) {
            setRawTransactions(uniqueFirstPage);
          } else {
            setHasMore(false);
          }
        }
      } else {
        // Append only unseen items
        const toAppend = [];
        const newIds = new Set();
        for (const tx of pageItems) {
          const k = getKey(tx);
          if (!seenKeysRef.current.has(k)) {
            seenKeysRef.current.add(k);
            toAppend.push(tx);
            // Track the ID for animation (only if not already animated)
            const txId = tx.id || tx._tempId;
            if (!animatedIdsRef.current.has(txId)) {
              newIds.add(txId);
            }
          }
        }
        if (toAppend.length > 0) {
          setRawTransactions((prev) => [...prev, ...toAppend]);
          // Set newly loaded IDs for animation (merge with existing)
          setNewlyLoadedIds((prev) => new Set([...prev, ...newIds]));
        }
      }

      // Update server offset and hasMore based on online items only
  setServerOffset(offsetValue + onlineCount);
  setHasMore(isOnline && onlineCount === requestedLimit);
    } catch (err) {
      setError("Failed to load transactions");
      console.error("Error loading transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  // Get online/offline state
  const { isOnline } = useOfflineAPI();

  // Load more transactions when scrolling (only when online)
  const loadMore = useCallback(() => {
    if (!isOnline) return; // disable infinite loading while offline
    if (isSearching) return; // disable infinite loading while searching
    if (hasMore && !loading) {
      loadTransactions(serverOffset, true, pageSize).then(() => {
        try {
          const swiper = document.querySelector('.swiper');
          // Trigger a microtask to allow DOM to update, then request autoHeight update via event
          queueMicrotask(() => {
            const evt = new CustomEvent('finxUpdateAutoHeight');
            window.dispatchEvent(evt);
          });
        } catch (e) {}
      });
    }
  }, [hasMore, loading, serverOffset, isOnline, pageSize, isSearching]);

  // Set up intersection observer for infinite scrolling
  // Use a single sentinel element (mobile) or the last row (desktop).
  const lastTransactionRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      // Determine scroll container (swipeable container on mobile) and use it as root when available
      const swipeableRoot = (() => {
        try {
          const el = document.querySelector(".swipeable-container");
          if (el) {
            const style = window.getComputedStyle(el);
            // If the container can scroll (not overflow: visible), use it as root
            if (
              style.overflow === "auto" ||
              style.overflow === "scroll" ||
              style.overflowY === "auto" ||
              style.overflowY === "scroll"
            ) {
              return el;
            }
          }
        } catch (e) {
          // ignore
        }
        return null;
      })();

      // Use a slightly larger rootMargin to pre-load before the user reaches the end
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && hasMore) {
            loadMore();
          }
        },
        {
          root: swipeableRoot,
          rootMargin: "0px 0px 200px 0px",
          threshold: 0.1,
        },
      );

      if (node) observer.current.observe(node);
    },
    [loading, hasMore, loadMore],
  );

  // Initial load and react to online/offline state: when offline, load cached items and disable further infinite loads
  useEffect(() => {
    // Set page size by device once on mount or when viewport changes meaningfully
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    const size = isMobile ? 10 : 20;
    setPageSize(size);
    // Reset offset and load first page
  // Always attempt to load; internal guards keep current list if empty
  loadTransactions(0, false, size);
  if (!isOnline) setHasMore(false);
    setServerOffset(0);
  }, [isOnline]);

  // Set up visibility change listener for background data refresh and other event listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isCurrentPage.current) {
        // Refresh first page when page becomes visible. If offline and fetch yields nothing, keep current list.
        setServerOffset(0);
        loadTransactions(0, false, pageSize);
      }
    };

    // Set up custom event listeners for transaction updates
    const handleTransactionAdded = () => {
      // Reload first page when a transaction is added
      setServerOffset(0);
      loadTransactions(0, false, pageSize);
    };

    const handleTransactionUpdated = () => {
      // Reload first page when a transaction is updated
      setServerOffset(0);
      loadTransactions(0, false, pageSize);
    };

    const handleTransactionDeleted = () => {
      // Reload first page when a transaction is deleted
      setServerOffset(0);
      loadTransactions(0, false, pageSize);
    };

    // Listen for when transactions are synced from offline to online
    const handleTransactionsSynced = () => {
      // Reload first page when transactions are synced
      setServerOffset(0);
      loadTransactions(0, false, pageSize);
    };

    // Listen for when app comes back online
    const handleAppBackOnline = () => {
      // Reload first page when app comes back online
      setServerOffset(0);
      loadTransactions(0, false, pageSize);
    };

    // Listen for general data refresh needs
  const handleDataRefreshNeeded = () => {
      // Reload first page when data refresh is needed. If offline and fetch yields nothing, keep current list.
      setServerOffset(0);
      loadTransactions(0, false, pageSize);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("transactionAdded", handleTransactionAdded);
    window.addEventListener("transactionUpdated", handleTransactionUpdated);
    window.addEventListener("transactionDeleted", handleTransactionDeleted);
    window.addEventListener("transactionsSynced", handleTransactionsSynced);
    window.addEventListener("appBackOnline", handleAppBackOnline);
    window.addEventListener("dataRefreshNeeded", handleDataRefreshNeeded);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("transactionAdded", handleTransactionAdded);
      window.removeEventListener(
        "transactionUpdated",
        handleTransactionUpdated,
      );
      window.removeEventListener(
        "transactionDeleted",
        handleTransactionDeleted,
      );
      window.removeEventListener(
        "transactionsSynced",
        handleTransactionsSynced,
      );
      window.removeEventListener("appBackOnline", handleAppBackOnline);
      window.removeEventListener("dataRefreshNeeded", handleDataRefreshNeeded);
    };
  }, [pageSize]);

  // Ensure the mobile sentinel uses the same observer logic as the lastTransactionRef (mobile only)
  useEffect(() => {
    if (loading) return;

    const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    if (!isMobile) return; // Do not override desktop observer

    // If mobile sentinel exists and is visible, observe it with same options
    const node = mobileSentinelRef.current;
    if (!node) return;
    const visible = !!(node.offsetParent !== null);
    if (!visible) return; // Hidden via CSS (e.g., md:hidden)

    // Determine swipeable root for mobile containers
    const swipeableRoot = (() => {
      try {
        const el = document.querySelector(".swipeable-container");
        if (el) {
          const style = window.getComputedStyle(el);
          if (
            style.overflow === "auto" ||
            style.overflow === "scroll" ||
            style.overflowY === "auto" ||
            style.overflowY === "scroll"
          ) {
            return el;
          }
        }
      } catch (e) {}
      return null;
    })();

    // Create a dedicated observer for the mobile sentinel so desktop row observer remains intact
    const mobileObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) {
          loadMore();
        }
      },
      { root: swipeableRoot, rootMargin: "0px 0px 200px 0px", threshold: 0.1 },
    );
    mobileObserver.observe(node);

    return () => mobileObserver.disconnect();
  }, [loading, hasMore, loadMore]);

  const handleDelete = async (id) => {
    if (window.confirm(t("deleteConfirmation"))) {
      try {
        const result = await deleteTransactionMutation.mutateAsync(id);
        if (result?.queued) {
          window.toastWithHaptic.info(t("changesQueuedOffline"));
        } else if (result) {
          window.toastWithHaptic.success(t("transactionDeleted"));
        }
        // Note: The mutation hook dispatches transactionDeleted event automatically
      } catch (err) {
        console.error("Error deleting transaction:", err);
        window.toastWithHaptic?.error(
          t("failedToDeleteTransaction") || "Failed to delete transaction",
        );
      }
    }
  };

  // Group transactions by date
  const groupTransactionsByDate = (transactions) => {
    const toDateKey = (value) => {
      if (!value) return "nodate";
      if (typeof value === "string") {
        // Prefer YYYY-MM-DD if present
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
        const t = value.indexOf("T");
        if (t > 0 && /^\d{4}-\d{2}-\d{2}/.test(value.slice(0, 10))) {
          return value.slice(0, 10);
        }
      }
      // Fallback: convert to Date and use UTC components to avoid tz drift
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) return "nodate";
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const grouped = {};
    transactions.forEach((transaction) => {
      const key = toDateKey(transaction.date);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(transaction);
    });
    return grouped;
  };

  if (loading && rawTransactions.length === 0) {
    return (
      <div className="container mx-auto px-4 pt-4 pb-4 sm:py-4">
        <div className="flex justify-center items-center h-64">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 pt-4 pb-4 sm:py-4">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  // Group transactions by date for mobile view
  const groupedTransactions = groupTransactionsByDate(filteredTransactions);

  return (
  <AnimatedPage>
  <div className="container mx-auto px-4 pt-4 md:pt-0 pb-4 min-h-0">
      <motion.div 
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 min-h-[3rem]"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h1 className="display-2 leading-none">{t("transactions")}</h1>
        <div className="relative w-full sm:w-72" role="search">
          <Icon
            src="/icons/search.svg"
            size="sm"
            variant="strong"
            aria-hidden={true}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-70"
          />
          <Input
            type="search"
            id="tx-search"
            name="q"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("search") || "Search"}
            className={`form-input-with-prefix pr-10 h-10 rounded-xl bg-[var(--surface)] border border-[color-mix(in_srgb,var(--accent)_10%,transparent)]
              focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_40%,transparent)] focus:border-transparent`}
            aria-label={t("searchTransactions") || "Search transactions"}
            autoComplete="off"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm rounded-full px-2 py-1 text-[var(--muted-text)] hover:text-[var(--text)] focus:outline-none"
              aria-label={t("clear") || "Clear"}
            >
              ×
            </button>
          )}
        </div>
      </motion.div>

      <AnimatedSection delay={0.2}>
      {isSearching && filteredTransactions.length === 0 ? (
        <div className="card">
          <div className="card-body py-10 text-center">
            <Icon src="/icons/search.svg" size="lg" variant="default" aria-hidden={true} className="mx-auto opacity-60" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-200">
              {t("noResults") || "No matching transactions"}
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              {t("tryDifferentSearch") || "Try a different keyword or clear the search."}
            </p>
          </div>
        </div>
      ) : transactions.length > 0 ? (
        <>
          {/* Mobile view - Grouped by date */}
          <div className="md:hidden space-y-6 overflow-hidden">
            <AnimatePresence mode="popLayout">
            {Object.entries(groupedTransactions)
              .sort((a, b) => (b[0] || '').localeCompare(a[0] || ''))
              .map(([dateKey, dateTransactions], index) => (
                <motion.div 
                  key={dateKey} 
                  className="card overflow-hidden"
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: motionTheme.easings.emphasizedDecelerate }}
                >
                  <div className="card-body p-4">
                    <h2 className="text-lg font-semibold mb-3">
                      {formatDate(dateTransactions[0]?.date || dateKey)}
                    </h2>
                    <div className="space-y-4">
                      <AnimatePresence mode="popLayout">
                      {dateTransactions.map((transaction, idx) => {
                        const txId = transaction.id || transaction._tempId;
                        const shouldAnimate = newlyLoadedIds.has(txId) && !animatedIdsRef.current.has(txId);
                        return (
                        <motion.div
                          key={transaction.id}
                          layout
                          initial={shouldAnimate || isSearching ? { opacity: 0, y: 20 } : false}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={shouldAnimate ? { 
                            duration: 0.35, 
                            delay: idx * 0.05,
                            ease: motionTheme.easings.emphasizedDecelerate 
                          } : { duration: 0.2, ease: motionTheme.easings.emphasizedDecelerate }}
                          onAnimationComplete={() => {
                            if (shouldAnimate) {
                              animatedIdsRef.current.add(txId);
                            }
                          }}
                          className={`border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0 last:pb-0`}
                          onClick={(e) => {
                            if (transaction.readOnly) {
                              e.preventDefault();
                              return;
                            }
                            navigate(`/edit-transaction/${transaction.id}`);
                          }}
                          role="button"
                          aria-disabled={transaction.readOnly}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 relative">
                              <div className="font-medium text-gray-900 dark:text-gray-200 truncate">
{transaction.description || transaction.category_name || transaction.category || (t("uncategorized") || "Uncategorized")}
                              </div>
                              {(transaction.source_name ||
                                transaction.source) &&
                              (transaction.target_name ||
                                transaction.target) ? (
                                <div
                                  className="truncate mt-1"
                                  style={{
                                    fontSize: "0.8rem",
                                    color: "rgb(79, 91, 111)",
                                  }}
                                >
                                  {(() => {
                                    const { displaySource, displayTarget } = getDisplaySourceTarget(transaction);
                                    return (
                                      <>
                                        <span className="dark:text-[rgb(153,165,190)]">
                                          {displaySource}
                                        </span>
                                        <span className="mx-1 dark:text-[rgb(153,165,190)]">
                                          →
                                        </span>
                                        <span className="dark:text-[rgb(153,165,190)]">
                                          {displayTarget}
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>
                              ) : transaction.source_name ||
                                transaction.source ? (
                                <div
                                  className="truncate mt-1"
                                  style={{
                                    fontSize: "0.8rem",
                                    color: "rgb(79, 91, 111)",
                                  }}
                                >
                                  <span className="dark:text-[rgb(153,165,190)]">
                                    {t("source")}:{" "}
                                    {getDisplaySourceTarget(transaction).displaySource}
                                  </span>
                                </div>
                              ) : transaction.target_name ||
                                transaction.target ? (
                                <div
                                  className="truncate mt-1"
                                  style={{
                                    fontSize: "0.8rem",
                                    color: "rgb(79, 91, 111)",
                                  }}
                                >
                                  <span className="dark:text-[rgb(153,165,190)]">
                                    {t("target")}:{" "}
                                    {getDisplaySourceTarget(transaction).displayTarget}
                                  </span>
                                </div>
                              ) : null}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="badge badge-primary text-xs">
                                  {transaction.category_name ||
                                    transaction.category}
                                </span>
                                {transaction.recurring_id && (
                                  <Icon
                                    src="/icons/recurring.svg"
                                    size="sm"
                                    variant="accent"
                                    alt={t("recurring") || "Recurring"}
                                    className="ml-2"
                                  />
                                )}
                                {transaction._isOffline && (
                                  <div className="flex items-center text-xs text-amber-600 dark:text-amber-400">
                                    <svg
                                      className="w-3 h-3 mr-1"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    <span className="font-medium">Offline</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div
                              className={`font-medium whitespace-nowrap ml-2 ${
                                transaction.type === "income"
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {transaction.type === "income" ? "+" : "-"}
                              {formatCurrency(parseFloat(transaction.amount))}
                            </div>
                          </div>
                        </motion.div>
                      );
                      })}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {/* Mobile sentinel for infinite scroll - observed by IntersectionObserver */}
            <div
              ref={mobileSentinelRef}
              aria-hidden="true"
              className="w-full h-1"
            />
            {loading && (
              <div className="flex justify-center py-4">
                <div className="spinner"></div>
              </div>
            )}
          </div>

          {/* Desktop view - Table */}
          <div className="hidden md:block card overflow-hidden">
            <div className="card-body">
              <div className="overflow-x-auto overflow-y-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-6 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                          {t("date")}
                        </span>
                      </th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                          {t("description")}
                        </span>
                      </th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                          {t("category")}
                        </span>
                      </th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                          {t("amount")}
                        </span>
                      </th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                          {t("actions")}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <AnimatePresence mode="popLayout">
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredTransactions.map((transaction, index) => {
                      const txId = transaction.id || transaction._tempId;
                      const shouldAnimate = newlyLoadedIds.has(txId) && !animatedIdsRef.current.has(txId);
                      return (
                      <motion.tr
                        key={transaction.id}
                        ref={
                          index === filteredTransactions.length - 1 && !isSearching
                            ? lastTransactionRef
                            : null
                        }
                        layout
                        initial={shouldAnimate || isSearching ? { opacity: 0, y: 15 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={shouldAnimate ? { 
                          duration: 0.3, 
                          delay: (index % pageSize) * 0.03,
                          ease: motionTheme.easings.emphasizedDecelerate 
                        } : { duration: 0.2, ease: motionTheme.easings.emphasizedDecelerate }}
                        onAnimationComplete={() => {
                          if (shouldAnimate) {
                            animatedIdsRef.current.add(txId);
                          }
                        }}
                        className={`table-row`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                          {formatDate(transaction.date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-200 md:table-cell break-words max-w-xs">
                          <div className="flex items-center gap-2">
<span>{transaction.description || transaction.category_name || transaction.category || (t("uncategorized") || "Uncategorized")}</span>
                            {transaction._isOffline && (
                              <div className="flex items-center text-xs text-amber-600 dark:text-amber-400">
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                          {(transaction.source_name || transaction.source) &&
                          (transaction.target_name || transaction.target) ? (
                            <>
                              <div
                                className="mt-1"
                                style={{
                                  fontSize: "0.8rem",
                                  color: "rgb(79, 91, 111)",
                                }}
                              >
                                {(() => {
                                  const { displaySource, displayTarget } = getDisplaySourceTarget(transaction);
                                  return (
                                    <>
                                      <span className="dark:text-[rgb(153,165,190)]">
                                        {displaySource}
                                      </span>
                                      <span className="mx-1 dark:text-[rgb(153,165,190)]">
                                        →
                                      </span>
                                      <span className="dark:text-[rgb(153,165,190)]">
                                        {displayTarget}
                                      </span>
                                    </>
                                  );
                                })()}
                              </div>
                              {transaction.recurring_id && (
                                <Icon
                                  src="/icons/recurring.svg"
                                  size="sm"
                                  variant="accent"
                                  alt={t("recurring") || "Recurring"}
                                  className="ml-1"
                                />
                              )}
                            </>
                          ) : transaction.source_name || transaction.source ? (
                            <div
                              className="mt-1"
                              style={{
                                fontSize: "0.8rem",
                                color: "rgb(79, 91, 111)",
                              }}
                            >
                              <span className="dark:text-[rgb(153,165,190)]">
                                {t("source")}:{" "}
                                {getDisplaySourceTarget(transaction).displaySource}
                              </span>
                            </div>
                          ) : transaction.target_name || transaction.target ? (
                            <div
                              className="mt-1"
                              style={{
                                fontSize: "0.8rem",
                                color: "rgb(79, 91, 111)",
                              }}
                            >
                              <span className="dark:text-[rgb(153,165,190)]">
                                {t("target")}:{" "}
                                {getDisplaySourceTarget(transaction).displayTarget}
                              </span>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                          <span className="badge badge-primary">
                            {transaction.category_name || transaction.category}
                          </span>
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                            transaction.type === "income"
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {formatCurrency(parseFloat(transaction.amount))}
                        </td>
<td className="px-6 py-4 text-right align-middle">
  <div className="flex justify-end items-center gap-2">
    <div className="flex items-center justify-center h-8 w-8">
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.96 }}
        transition={motionTheme.springs.press}
        className="rounded-full"
      >
        <Link
          to={
            transaction.readOnly
              ? "#"
              : `/edit-transaction/${transaction.id}`
          }
          onClick={(e) => {
            if (transaction.readOnly) e.preventDefault();
          }}
          aria-disabled={transaction.readOnly}
          tabIndex={transaction.readOnly ? -1 : 0}
          className={`table-action-button flex items-center justify-center h-8 w-8 rounded-full ${
            transaction.readOnly
              ? "text-gray-400 cursor-not-allowed pointer-events-none"
              : "text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
          }`}
        >
          <Icon
            src="/icons/edit.svg"
            size="sm"
            variant={transaction.readOnly ? "default" : "accent"}
            alt={t("edit") || "Edit"}
            className={`icon-sm ${transaction.readOnly ? "icon-disabled" : "icon-tint-accent"}`}
          />
        </Link>
      </motion.div>
    </div>
    <div className="flex items-center justify-center h-8 w-8">
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.96 }}
        transition={motionTheme.springs.press}
        className="rounded-full"
      >
        <button
          onClick={(e) => {
            if (transaction.readOnly) {
              e.preventDefault();
              return;
            }
            handleDelete(transaction.id);
          }}
          disabled={transaction.readOnly}
          aria-disabled={transaction.readOnly}
          className={`table-action-button flex items-center justify-center h-8 w-8 rounded-full ${
            transaction.readOnly
              ? "text-gray-400 cursor-not-allowed"
              : "text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
          }`}
        >
          <Icon
            src="/icons/trash.svg"
            size="sm"
            variant={transaction.readOnly ? "default" : "danger"}
            alt={t("delete") || "Delete"}
            className={`icon-sm ${transaction.readOnly ? "icon-disabled" : "icon-tint-danger"}`}
          />
        </button>
      </motion.div>
    </div>
  </div>
</td>
                      </motion.tr>
                    );
                    })}
                  </tbody>
                  </AnimatePresence>
                </table>
              </div>
              {loading && (
                <div className="flex justify-center py-4">
                  <div className="spinner"></div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="card text-center py-16">
          <div className="card-body">
            <Icon
              src="/icons/chart.svg"
              size="lg"
              variant="default"
              aria-hidden={true}
              className="mx-auto opacity-60"
            />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-200">
              {t("noTransactions")}
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              {t("getStartedAddTransaction")}
            </p>
            <div className="mt-6">
              <Button
                variant="primary"
                onClick={() => navigate("/add-transaction")}
              >
                {t("addTransaction")}
              </Button>
            </div>
          </div>
        </div>
      )}
      </AnimatedSection>
    </div>
  </AnimatedPage>
  );
};

export default Transactions;
