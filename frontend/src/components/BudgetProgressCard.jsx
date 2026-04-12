import { useState, useEffect } from "react";
import { categoryAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import { AnimatedItem } from "./AnimatedPage.jsx";

import Card from "./Card";
/**
 * BudgetProgressCard - Shows spending progress for categories with budget limits
 * Green (<80%), Yellow (80-100%), Red (>100%)
 */
export default function BudgetProgressCard({ className = "" }) {
  const { t, formatCurrency } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await categoryAPI.getBudgetProgress();
        if (!cancelled) {
          setData(response.data?.data || response.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch budget progress:", err);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  const statusColor = (status) => {
    switch (status) {
      case "overspent": return { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" };
      case "caution": return { bar: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400" };
      default: return { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
    }
  };

  if (loading) {
    return (
      <AnimatedItem className={className}>
        <Card style={{ borderColor: "rgba(139, 92, 246, 0.5)" }}>
          <div className="card-body">
            <div className="animate-pulse">
              <div className="flex items-center mb-4">
                <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-900/30 mr-4">
                  <div className="w-6 h-6 bg-violet-200 dark:bg-violet-800 rounded" />
                </div>
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-36" />
              </div>
              <div className="space-y-3">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
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

  const budgets = data?.budgets || [];
  if (budgets.length === 0) return null;

  const totalBudget = data?.totalBudget || 0;
  const totalSpent = data?.totalSpent || 0;
  const totalPercent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <AnimatedItem className={className}>
      <Card style={{ borderColor: "rgba(139, 92, 246, 0.5)" }}>
        <div className="card-body">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-900/30 mr-4">
                <svg
                  className="w-6 h-6 text-violet-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t("budgetProgress") || "Budget Progress"}
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)} ({totalPercent}%)
                </p>
              </div>
            </div>
          </div>

          {/* Budget bars */}
          <div className="space-y-3">
            {budgets.map((budget) => {
              const colors = statusColor(budget.status);
              const barWidth = Math.min(100, budget.percent);

              return (
                <div key={budget.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate mr-2">
                      {budget.name}
                    </span>
                    <span className={`text-xs font-medium whitespace-nowrap ${colors.text}`}>
                      {formatCurrency(budget.spent)} / {formatCurrency(budget.budget_limit)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${colors.bar}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  {budget.status === "overspent" && (
                    <p className="text-xs text-red-500 mt-0.5">
                      {formatCurrency(budget.spent - budget.budget_limit)} {t("overBudget") || "over budget"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </AnimatedItem>
  );
}
