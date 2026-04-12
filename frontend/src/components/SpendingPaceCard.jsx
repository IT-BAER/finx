import { useState, useEffect } from "react";
import { transactionAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import { AnimatedItem } from "./AnimatedPage.jsx";

import Card from "./Card";
/**
 * SpendingPaceCard - Compares current month spending rate vs last month
 * Shows if spending faster/slower than usual
 */
export default function SpendingPaceCard({ className = "" }) {
  const { t, formatCurrency } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await transactionAPI.getSpendingPace();
        if (!cancelled) {
          setData(response.data?.data || response.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch spending pace:", err);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  const paceConfig = {
    fast: {
      border: "rgba(239, 68, 68, 0.5)",
      bg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-500",
      textColor: "text-red-600 dark:text-red-400",
      icon: "↑↑",
    },
    slightly_fast: {
      border: "rgba(245, 158, 11, 0.5)",
      bg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-500",
      textColor: "text-amber-600 dark:text-amber-400",
      icon: "↑",
    },
    normal: {
      border: "rgba(34, 197, 94, 0.5)",
      bg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-500",
      textColor: "text-green-600 dark:text-green-400",
      icon: "→",
    },
    slightly_slow: {
      border: "rgba(59, 130, 246, 0.5)",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-500",
      textColor: "text-blue-600 dark:text-blue-400",
      icon: "↓",
    },
    slow: {
      border: "rgba(59, 130, 246, 0.5)",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-500",
      textColor: "text-blue-600 dark:text-blue-400",
      icon: "↓↓",
    },
  };

  if (loading) {
    return (
      <AnimatedItem className={className}>
        <Card style={{ borderColor: "rgba(245, 158, 11, 0.5)" }}>
          <div className="card-body">
            <div className="animate-pulse">
              <div className="flex items-center mb-3">
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30 mr-4">
                  <div className="w-6 h-6 bg-amber-200 dark:bg-amber-800 rounded" />
                </div>
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32" />
              </div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48" />
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

  // Don't show if no spending data from last month
  if (!data || data.prevMonthTotal === 0) return null;

  const status = data.status || "normal";
  const config = paceConfig[status] || paceConfig.normal;
  const pacePercent = data.pacePercent || 0;
  const absPace = Math.abs(pacePercent);

  // Build the pace message
  let paceMessage;
  if (status === "fast" || status === "slightly_fast") {
    paceMessage = `${absPace}% ${t("fasterThanUsual") || "faster than usual"}`;
  } else if (status === "slow" || status === "slightly_slow") {
    paceMessage = `${absPace}% ${t("slowerThanUsual") || "slower than usual"}`;
  } else {
    paceMessage = t("onTrack") || "On track with last month";
  }

  return (
    <AnimatedItem className={className}>
      <Card style={{ borderColor: config.border }}>
        <div className="card-body">
          <div className="flex items-center">
            <div className={`p-3 rounded-full ${config.bg} mr-4 shrink-0`}>
              <svg
                className={`w-6 h-6 ${config.iconColor}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t("spendingPace") || "Spending Pace"}
              </h3>
              <p className={`text-sm font-semibold ${config.textColor}`}>
                {config.icon} {paceMessage}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {formatCurrency(data.currentDailyAvg)}/{t("perDay") || "day"} vs {formatCurrency(data.prevDailyAvg)}/{t("perDay") || "day"} {t("lastMonth") || "last month"}
              </p>
            </div>
            {/* Projected total */}
            <div className="text-right shrink-0 ml-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {t("projected") || "Projected"}
              </p>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {formatCurrency(data.projectedTotal)}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </AnimatedItem>
  );
}
