import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import offlineAPI from "../services/offlineAPI.js";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "../hooks/useTranslation";
import { useAuth } from "../contexts/AuthContext";
import Button from "../components/Button";
import Icon from "../components/Icon.jsx";
import { motion } from "framer-motion";
import { motionTheme } from "../utils/motionTheme";
import useOfflineAPI from "../hooks/useOfflineAPI.js";

const Transactions = () => {
  const navigate = useNavigate();
  const { isDarkMode, language, user } = useAuth();
  const { t, formatDate, formatCurrency } = useTranslation();
  const isCurrentPage = useRef(true);
  const observer = useRef();
  const mobileSentinelRef = useRef();

  // State for infinite scrolling
  const [rawTransactions, setRawTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20; // Number of transactions to load per request

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

  // Load transactions with pagination parameters
  const loadTransactions = async (
    offsetValue = 0,
    append = false,
    overrideLimit = null,
  ) => {
    try {
      if (!append) {
        setLoading(true);
      }
      const requestedLimit = overrideLimit ?? limit;
      const params = { limit: requestedLimit, offset: offsetValue };
      const data = await offlineAPI.getAllTransactions(params);

      // Handle two possible behaviors from offlineAPI.getAllTransactions:
      // 1) It respects params and returns at most `requestedLimit` items (server-side paging)
      // 2) It returns a full dataset (client-side pagination required)
      let displayed = [];
      const total = Array.isArray(data) ? data.length : 0;

      if (total > requestedLimit) {
        // offlineAPI returned a full dataset; paginate client-side
        const page = data.slice(offsetValue, offsetValue + requestedLimit);
        displayed = page;
        if (append) {
          setRawTransactions((prev) => [...prev, ...page]);
        } else {
          setRawTransactions(page);
        }
        setHasMore(offsetValue + page.length < total);
        setOffset(offsetValue + page.length);
      } else {
        // Server respected limit (or total <= requestedLimit)
        displayed = append ? data : data.slice(0, requestedLimit);
        if (append) {
          setRawTransactions((prev) => [...prev, ...displayed]);
        } else {
          setRawTransactions(displayed);
        }
        setHasMore(total === requestedLimit);
        setOffset(offsetValue + displayed.length);
      }
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
    if (hasMore && !loading) {
      loadTransactions(offset, true);
    }
  }, [hasMore, loading, offset, isOnline]);

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
    const initialLimit =
      typeof window !== "undefined" && window.innerWidth <= 768 ? 10 : null;
    if (!isOnline) {
      // Load only cached items and disable further server loads
      loadTransactions(0, false, initialLimit);
      setHasMore(false);
    } else {
      // Normal online initial load
      loadTransactions(0, false, initialLimit);
    }
  }, [isOnline]);

  // Set up visibility change listener for background data refresh and other event listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isCurrentPage.current) {
        // Refresh data when page becomes visible
        loadTransactions();
      }
    };

    // Set up custom event listeners for transaction updates
    const handleTransactionAdded = () => {
      // Reload first page when a transaction is added
      loadTransactions(0, false);
    };

    const handleTransactionUpdated = () => {
      // Reload first page when a transaction is updated
      loadTransactions(0, false);
    };

    const handleTransactionDeleted = () => {
      // Reload first page when a transaction is deleted
      loadTransactions(0, false);
    };

    // Listen for when transactions are synced from offline to online
    const handleTransactionsSynced = () => {
      // Reload first page when transactions are synced
      loadTransactions(0, false);
    };

    // Listen for when app comes back online
    const handleAppBackOnline = () => {
      // Reload first page when app comes back online
      loadTransactions(0, false);
    };

    // Listen for general data refresh needs
    const handleDataRefreshNeeded = () => {
      // Reload first page when data refresh is needed
      loadTransactions(0, false);
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
  }, []);

  // Ensure the mobile sentinel uses the same observer logic as the lastTransactionRef
  useEffect(() => {
    if (loading) return;
    // If mobile sentinel exists, observe it with same options
    const node = mobileSentinelRef.current;
    if (!node) return;

    if (observer.current) observer.current.disconnect();

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

    observer.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) {
          loadMore();
        }
      },
      { root: swipeableRoot, rootMargin: "0px 0px 200px 0px", threshold: 0.1 },
    );
    observer.current.observe(node);

    return () => observer.current?.disconnect();
  }, [loading, hasMore, loadMore]);

  const handleDelete = async (id) => {
    if (window.confirm(t("deleteConfirmation"))) {
      try {
        const result = await offlineAPI.deleteTransaction(id);
        if (result.queued) {
          window.toastWithHaptic.info(t("changesQueuedOffline"));
        } else if (result) {
          window.toastWithHaptic.success(t("transactionDeleted"));
        }
        // Dispatch a custom event to notify the Transactions page to refresh
        window.dispatchEvent(new CustomEvent("transactionDeleted"));
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
    const grouped = {};
    transactions.forEach((transaction) => {
      // Normalize date to YYYY-MM-DD format to handle both ISO strings and simple dates
      const date = transaction.date
        ? String(transaction.date).substring(0, 10)
        : "nodate";
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(transaction);
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
  const groupedTransactions = groupTransactionsByDate(transactions);

  return (
    <div className="container mx-auto px-4 pt-6 pb-4 min-h-0">
      <div className="flex justify-between items-center mb-8">
        <h1 className="display-2">{t("transactions")}</h1>
      </div>

      {transactions.length > 0 ? (
        <>
          {/* Mobile view - Grouped by date */}
          <div className="md:hidden space-y-6">
            {Object.entries(groupedTransactions).map(
              ([date, dateTransactions], index) => (
                <div key={date} className="card">
                  <div className="card-body p-4">
                    <h2 className="text-lg font-semibold mb-3">
                      {formatDate(date)}
                    </h2>
                    <div className="space-y-4">
                      {dateTransactions.map((transaction, idx) => (
                        <motion.div
                          key={transaction.id}
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
                          transition={motionTheme.springs.press}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 relative">
                              <div className="font-medium text-gray-900 dark:text-gray-200 truncate">
                                {transaction.description || "N/A"}
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
                                  <span className="dark:text-[rgb(153,165,190)]">
                                    {transaction.source_name ||
                                      transaction.source}
                                  </span>
                                  <span className="mx-1 dark:text-[rgb(153,165,190)]">
                                    →
                                  </span>
                                  <span className="dark:text-[rgb(153,165,190)]">
                                    {transaction.target_name ||
                                      transaction.target}
                                  </span>
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
                                    {transaction.source_name ||
                                      transaction.source}
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
                                    {transaction.target_name ||
                                      transaction.target}
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
                      ))}
                    </div>
                  </div>
                </div>
              ),
            )}
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
          <div className="hidden md:block card">
            <div className="card-body">
              <div className="overflow-x-auto">
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
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {transactions.map((transaction, index) => (
                      <tr
                        key={transaction.id}
                        ref={
                          index === transactions.length - 1
                            ? lastTransactionRef
                            : null
                        }
                        className={`table-row`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                          {formatDate(transaction.date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-200 md:table-cell break-words max-w-xs">
                          <div className="flex items-center gap-2">
                            <span>{transaction.description || "N/A"}</span>
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
                                <span className="dark:text-[rgb(153,165,190)]">
                                  {transaction.source_name ||
                                    transaction.source}
                                </span>
                                <span className="mx-1 dark:text-[rgb(153,165,190)]">
                                  →
                                </span>
                                <span className="dark:text-[rgb(153,165,190)]">
                                  {transaction.target_name ||
                                    transaction.target}
                                </span>
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
                                {transaction.source_name || transaction.source}
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
                                {transaction.target_name || transaction.target}
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
                      </tr>
                    ))}
                  </tbody>
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
    </div>
  );
};

export default Transactions;
