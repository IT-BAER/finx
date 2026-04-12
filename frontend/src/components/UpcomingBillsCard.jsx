import { useState, useEffect } from "react";
import { recurringTransactionAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import { motion } from "framer-motion";
import Card from "./Card";

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
        if (!cancelled) setLoading(false);
      }
    };
    fetchUpcomingBills();
    return () => { cancelled = true; };
  }, [days, limit]);

  const formatRelativeDate = (daysUntil) => {
    if (daysUntil === 0) return t("today") || "Today";
    if (daysUntil === 1) return t("tomorrow") || "Tomorrow";
    return `${t("inDays")?.replace("{days}", daysUntil) || `in ${daysUntil} days`}`;
  };

  if (loading) {
    return (
      <Card variant="insight-card" className={className}>
        <div className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="insight-skeleton w-11 h-11" />
            <div className="flex-1 space-y-2">
              <div className="insight-skeleton h-3 w-28" />
              <div className="insight-skeleton h-3 w-16" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="insight-skeleton h-10 w-full" />
            <div className="insight-skeleton h-10 w-full" />
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="insight-card" className={className}>
        <div className="p-5">
          <p className="text-sm text-red-500">{t("errorLoading") || "Error loading data"}</p>
        </div>
      </Card>
    );
  }

  const bills = data?.bills || [];
  const totalExpenses = data?.totalExpenses || 0;
  const totalCount = data?.totalCount || 0;

  return (
    <Card variant="insight-card" className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="p-5 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3.5">
            <div className="insight-icon" style={{ background: "linear-gradient(135deg, #f97316, #f59e0b)" }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-400">
                {t("upcomingBills") || "Upcoming Bills"}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-400">
                {totalExpenses > 0
                  ? `${formatCurrency(totalExpenses)} ${t("totalDue") || "due"}`
                  : (t("nextDays")?.replace("{days}", days) || `Next ${days} days`)}
              </p>
            </div>
          </div>
        </div>

        {/* Bills horizontal strip */}
        {bills.length > 0 ? (
          <div className="flex-1 flex items-center gap-2 overflow-x-auto">
            {bills.map((bill, index) => (
              <motion.div
                key={bill.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + index * 0.04 }}
                className="flex-1 min-w-0 flex flex-col items-center justify-center rounded-lg py-2 px-2 bg-gray-50/60 dark:bg-gray-800/40"
              >
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wide">
                  {formatRelativeDate(bill.days_until)}
                </span>
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate max-w-full mt-0.5">
                  {bill.title}
                </span>
                <span className={`text-xs font-bold mt-0.5 ${
                  bill.type === "expense" ? "text-red-500 dark:text-red-400" : "text-emerald-500 dark:text-emerald-400"
                }`}>
                  {bill.type === "expense" ? "-" : "+"}{formatCurrency(bill.amount)}
                </span>
              </motion.div>
            ))}
            {totalCount > bills.length && (
              <div className="shrink-0 flex items-center justify-center w-8 text-[10px] text-gray-400 dark:text-gray-400 font-medium">
                +{totalCount - bills.length}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {t("noBillsDue") || "No bills due"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">
                {t("noBillsSubtext") || "You're all caught up!"}
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
