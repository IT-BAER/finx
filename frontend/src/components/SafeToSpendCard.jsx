import { useState, useEffect } from "react";
import { transactionAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import { AnimatedItem } from "./AnimatedPage.jsx";

import Card from "./Card";
/**
 * SafeToSpendCard - Shows how much money is "safe" to spend for the rest of the month
 * Color-coded: green (healthy), yellow (caution), red (overspent)
 */
export default function SafeToSpendCard({ className = "" }) {
  const { t, formatCurrency } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await transactionAPI.getSafeToSpend();
        if (!cancelled) {
          setData(response.data?.data || response.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch safe to spend:", err);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Color and status config
  const statusConfig = {
    healthy: {
      border: "rgba(34, 197, 94, 0.5)",
      bg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-500",
      amountColor: "text-green-600 dark:text-green-400",
      label: t("safeToSpendHealthy") || "Looking good!",
    },
    caution: {
      border: "rgba(234, 179, 8, 0.5)",
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      iconColor: "text-yellow-500",
      amountColor: "text-yellow-600 dark:text-yellow-400",
      label: t("safeToSpendCaution") || "Spend carefully",
    },
    overspent: {
      border: "rgba(239, 68, 68, 0.5)",
      bg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-500",
      amountColor: "text-red-600 dark:text-red-400",
      label: t("safeToSpendOverspent") || "Over budget",
    },
  };

  if (loading) {
    return (
      <AnimatedItem className={className}>
        <Card style={{ borderColor: "rgba(34, 197, 94, 0.5)" }}>
          <div className="card-body">
            <div className="animate-pulse">
              <div className="flex items-center mb-4">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 mr-4">
                  <div className="w-6 h-6 bg-green-200 dark:bg-green-800 rounded" />
                </div>
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32" />
              </div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-36" />
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

  const status = statusConfig[data?.status] || statusConfig.healthy;
  const safeToSpend = data?.safeToSpend || 0;
  const dailyBudget = data?.dailyBudget || 0;
  const daysRemaining = data?.daysRemaining || 1;
  const monthlyIncome = data?.monthlyIncome || 0;
  const monthlyExpenses = data?.monthlyExpenses || 0;
  const upcomingRecurringExpenses = data?.upcomingRecurringExpenses || 0;

  // Progress bar - how much of income has been spent
  const spentPercent = monthlyIncome > 0
    ? Math.min(100, Math.round(((monthlyExpenses + upcomingRecurringExpenses) / monthlyIncome) * 100))
    : 0;

  return (
    <AnimatedItem className={className}>
      <Card style={{ borderColor: status.border }}>
        <div className="card-body">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${status.bg} mr-4`}>
                <svg
                  className={`w-6 h-6 ${status.iconColor}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t("safeToSpend") || "Safe to Spend"}
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {status.label}
                </p>
              </div>
            </div>
          </div>

          {/* Main amount */}
          <div className="mb-4">
            <p className={`text-3xl font-bold ${status.amountColor}`}>
              {formatCurrency(Math.abs(safeToSpend))}
              {safeToSpend < 0 && <span className="text-sm font-normal ml-1">({t("overBudget") || "over budget"})</span>}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {formatCurrency(dailyBudget)} / {t("perDay") || "per day"} • {daysRemaining} {t("daysLeft") || "days left"}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{t("spent") || "Spent"}: {formatCurrency(monthlyExpenses)}</span>
              <span>{t("income") || "Income"}: {formatCurrency(monthlyIncome)}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  spentPercent > 90 ? 'bg-red-500' : spentPercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${spentPercent}%` }}
              />
            </div>
          </div>

          {/* Upcoming recurring */}
          {upcomingRecurringExpenses > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t("upcomingRecurring") || "Upcoming bills"}: {formatCurrency(upcomingRecurringExpenses)} {t("thisMonth") || "this month"}
            </p>
          )}
        </div>
      </Card>
    </AnimatedItem>
  );
}
