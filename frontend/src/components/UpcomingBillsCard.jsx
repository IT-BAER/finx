import { useState, useEffect } from "react";
import { recurringTransactionAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import { motion } from "framer-motion";
import { AnimatedItem } from "./AnimatedPage.jsx";

import Card from "./Card";
/**
 * UpcomingBillsCard - Shows upcoming recurring transactions for the next N days
 * Displays: List of upcoming bills with due dates, total expenses due
 */
export default function UpcomingBillsCard({ days = 7, limit = 5, className = "" }) {
  const { t, formatCurrency, formatDate } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    
    const fetchUpcomingBills = async () => {
      try {
        setLoading(true);
        const response = await recurringTransactionAPI.getUpcomingBills({ days, limit });
        if (!cancelled) {
          setData(response.data?.data || response.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch upcoming bills:", err);
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchUpcomingBills();
    
    return () => { cancelled = true; };
  }, [days, limit]);

  // Format relative date (Today, Tomorrow, in X days)
  const formatRelativeDate = (daysUntil) => {
    if (daysUntil === 0) return t("today") || "Today";
    if (daysUntil === 1) return t("tomorrow") || "Tomorrow";
    return `${t("inDays")?.replace("{days}", daysUntil) || `in ${daysUntil} days`}`;
  };

  if (loading) {
    return (
      <AnimatedItem className={className}>
        <Card style={{ borderColor: "rgba(249, 115, 22, 0.5)" }}>
          <div className="card-body">
            <div className="animate-pulse">
              <div className="flex items-center mb-4">
                <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30 mr-4">
                  <div className="w-6 h-6 bg-orange-200 dark:bg-orange-800 rounded" />
                </div>
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32" />
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
              </div>
            </div>
          </div>
        </Card>
      </AnimatedItem>
    );
  }

  if (error) {
    return (
      <AnimatedItem className={className}>
        <Card style={{ borderColor: "rgba(239, 68, 68, 0.5)" }}>
          <div className="card-body">
            <div className="text-sm text-red-500">{t("errorLoading") || "Error loading data"}</div>
          </div>
        </Card>
      </AnimatedItem>
    );
  }

  const bills = data?.bills || [];
  const totalExpenses = data?.totalExpenses || 0;
  const totalCount = data?.totalCount || 0;

  return (
    <AnimatedItem className={className}>
      <Card style={{ borderColor: "rgba(249, 115, 22, 0.5)" }}>
        <div className="card-body">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30 mr-4">
                <svg
                  className="w-6 h-6 text-orange-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t("upcomingBills") || "Upcoming Bills"}
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {t("nextDays")?.replace("{days}", days) || `Next ${days} days`}
                </p>
              </div>
            </div>
            {totalExpenses > 0 && (
              <div className="text-right">
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(totalExpenses)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {t("totalDue") || "Total due"}
                </p>
              </div>
            )}
          </div>

          {/* Bills list */}
          {bills.length > 0 ? (
            <div className="space-y-3">
              {bills.map((bill, index) => (
                <motion.div
                  key={bill.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {bill.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatRelativeDate(bill.days_until)} • {formatDate(bill.due_date)}
                    </p>
                  </div>
                  <div className={`text-sm font-semibold ml-4 ${
                    bill.type === 'expense' 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {bill.type === 'expense' ? '-' : '+'}{formatCurrency(bill.amount)}
                  </div>
                </motion.div>
              ))}
              
              {/* Show "and X more" if there are more bills */}
              {totalCount > bills.length && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-2">
                  {t("andMore")?.replace("{count}", totalCount - bills.length) || 
                    `and ${totalCount - bills.length} more`}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <svg
                className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("noBillsDue") || "No bills due"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {t("noBillsSubtext") || "You're all caught up!"}
              </p>
            </div>
          )}
        </div>
      </Card>
    </AnimatedItem>
  );
}
