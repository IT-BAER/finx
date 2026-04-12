import { useState, useEffect } from "react";
import { categoryAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import { motion } from "framer-motion";
import Card from "./Card";

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

  const statusGradient = (status) => {
    switch (status) {
      case "overspent": return { bar: "linear-gradient(90deg, #ef4444, #f97316)", text: "text-red-600 dark:text-red-400", dot: "#ef4444" };
      case "caution": return { bar: "linear-gradient(90deg, #f59e0b, #fbbf24)", text: "text-amber-600 dark:text-amber-400", dot: "#f59e0b" };
      default: return { bar: "linear-gradient(90deg, #10b981, #34d399)", text: "text-emerald-600 dark:text-emerald-400", dot: "#10b981" };
    }
  };

  if (loading) {
    return (
      <Card variant="insight-card" className={className}>
        <div className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="insight-skeleton w-11 h-11" />
            <div className="flex-1 space-y-2">
              <div className="insight-skeleton h-3 w-28" />
              <div className="insight-skeleton h-3 w-20" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="insight-skeleton h-8 w-full" />
            <div className="insight-skeleton h-8 w-full" />
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

  const budgets = data?.budgets || [];
  if (budgets.length === 0) return null;

  const totalBudget = data?.totalBudget || 0;
  const totalSpent = data?.totalSpent || 0;
  const totalPercent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <Card variant="insight-card" className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3.5">
            <div className="insight-icon" style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t("budgetProgress") || "Budget Progress"}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)} ({totalPercent}%)
              </p>
            </div>
          </div>
        </div>

        {/* Budget bars */}
        <div className="space-y-3">
          {budgets.map((budget, i) => {
            const colors = statusGradient(budget.status);
            const barWidth = Math.min(100, budget.percent);

            return (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.04 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors.dot }} />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {budget.name}
                    </span>
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap ml-2 ${colors.text}`}>
                    {formatCurrency(budget.spent)} / {formatCurrency(budget.budget_limit)}
                  </span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${barWidth}%`, background: colors.bar }} />
                </div>
                {budget.status === "overspent" && (
                  <p className="text-[11px] text-red-500 mt-0.5">
                    {formatCurrency(budget.spent - budget.budget_limit)} {t("overBudget") || "over budget"}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
