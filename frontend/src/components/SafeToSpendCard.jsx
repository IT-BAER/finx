import { useState, useEffect } from "react";
import { transactionAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import Card from "./Card";

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

  const statusConfig = {
    healthy: {
      gradient: "linear-gradient(90deg, #10b981, #34d399)",
      iconGradient: "linear-gradient(135deg, #10b981, #059669)",
      label: t("safeToSpendHealthy") || "Looking good!",
      ringColor: "#10b981",
    },
    caution: {
      gradient: "linear-gradient(90deg, #f59e0b, #fbbf24)",
      iconGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
      label: t("safeToSpendCaution") || "Spend carefully",
      ringColor: "#f59e0b",
    },
    overspent: {
      gradient: "linear-gradient(90deg, #ef4444, #f97316)",
      iconGradient: "linear-gradient(135deg, #ef4444, #dc2626)",
      label: t("safeToSpendOverspent") || "Over budget",
      ringColor: "#ef4444",
    },
  };

  if (loading) {
    return (
      <Card variant="insight-card" className={className}>
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="insight-skeleton w-11 h-11" />
            <div className="flex-1 space-y-2">
              <div className="insight-skeleton h-3 w-24" />
              <div className="insight-skeleton h-7 w-36" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="insight-skeleton h-[6px] w-full rounded-full" />
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

  const status = statusConfig[data?.status] || statusConfig.healthy;
  const safeToSpend = data?.safeToSpend || 0;
  const dailyBudget = data?.dailyBudget || 0;
  const daysRemaining = data?.daysRemaining || 1;
  const monthlyIncome = data?.monthlyIncome || 0;
  const monthlyExpenses = data?.monthlyExpenses || 0;
  const upcomingRecurringExpenses = data?.upcomingRecurringExpenses || 0;

  const spentPercent = monthlyIncome > 0
    ? Math.min(100, Math.round(((monthlyExpenses + upcomingRecurringExpenses) / monthlyIncome) * 100))
    : 0;

  const ringRadius = 28;
  const circumference = 2 * Math.PI * ringRadius;
  const ringOffset = circumference - (spentPercent / 100) * circumference;

  return (
    <Card variant="insight-card" className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div className="insight-icon mt-0.5" style={{ background: status.iconGradient }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-400 mb-0.5">
                {t("safeToSpend") || "Safe to Spend"}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white insight-value">
                {formatCurrency(Math.abs(safeToSpend))}
                {safeToSpend < 0 && (
                  <span className="text-xs font-normal text-red-500 ml-1.5">({t("overBudget") || "over"})</span>
                )}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">
                {formatCurrency(dailyBudget)}/{t("perDay") || "day"} · {daysRemaining} {t("daysLeft") || "days left"}
              </p>
            </div>
          </div>

          <div className="shrink-0 relative flex items-center justify-center" style={{ width: 68, height: 68 }}>
            <svg width="68" height="68" className="transform -rotate-90">
              <circle cx="34" cy="34" r={ringRadius} fill="none" strokeWidth="5"
                className="stroke-gray-200 dark:stroke-gray-700" />
              <circle cx="34" cy="34" r={ringRadius} fill="none" strokeWidth="5"
                stroke={status.ringColor} strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={ringOffset}
                className="progress-ring-circle" />
            </svg>
            <span className="absolute text-xs font-bold text-gray-600 dark:text-gray-300">{spentPercent}%</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-400 mb-1.5">
            <span>{t("spent") || "Spent"}: {formatCurrency(monthlyExpenses)}</span>
            <span>{t("income") || "Income"}: {formatCurrency(monthlyIncome)}</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${spentPercent}%`, background: status.gradient }} />
          </div>
        </div>

        {upcomingRecurringExpenses > 0 && (
          <p className="text-[11px] text-gray-400 dark:text-gray-400 mt-1.5">
            {t("upcomingRecurring") || "Upcoming bills"}: {formatCurrency(upcomingRecurringExpenses)} {t("thisMonth") || "this month"}
          </p>
        )}

        <div className="mt-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ background: `${status.ringColor}15`, color: status.ringColor }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.ringColor }} />
            {status.label}
          </span>
        </div>
      </div>
    </Card>
  );
}
