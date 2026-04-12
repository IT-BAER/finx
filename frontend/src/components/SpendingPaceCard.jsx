import { useState, useEffect } from "react";
import { transactionAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import Card from "./Card";

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
      gradient: "linear-gradient(90deg, #ef4444, #f97316)",
      iconGradient: "linear-gradient(135deg, #ef4444, #dc2626)",
      textColor: "text-red-600 dark:text-red-400",
      icon: "↑↑",
      barColor: "#ef4444",
    },
    slightly_fast: {
      gradient: "linear-gradient(90deg, #f59e0b, #fbbf24)",
      iconGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
      textColor: "text-amber-600 dark:text-amber-400",
      icon: "↑",
      barColor: "#f59e0b",
    },
    normal: {
      gradient: "linear-gradient(90deg, #10b981, #34d399)",
      iconGradient: "linear-gradient(135deg, #10b981, #059669)",
      textColor: "text-emerald-600 dark:text-emerald-400",
      icon: "→",
      barColor: "#10b981",
    },
    slightly_slow: {
      gradient: "linear-gradient(90deg, #3b82f6, #60a5fa)",
      iconGradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
      textColor: "text-blue-600 dark:text-blue-400",
      icon: "↓",
      barColor: "#3b82f6",
    },
    slow: {
      gradient: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
      iconGradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
      textColor: "text-blue-600 dark:text-blue-400",
      icon: "↓↓",
      barColor: "#3b82f6",
    },
  };

  if (loading) {
    return (
      <Card variant="insight-card" className={className}>
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="insight-skeleton w-11 h-11" />
            <div className="flex-1 space-y-2">
              <div className="insight-skeleton h-3 w-28" />
              <div className="insight-skeleton h-5 w-48" />
            </div>
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

  if (!data || data.prevMonthTotal === 0) {
    return (
      <Card variant="insight-card" className={className}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="p-5 h-full flex flex-col">
          <div className="flex items-start gap-3.5">
            <div className="insight-icon" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-400 mt-0.5">
              {t("spendingPace") || "Spending Pace"}
            </p>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">No previous month data</p>
          </div>
        </div>
      </Card>
    );
  }

  const status = data.status || "normal";
  const config = paceConfig[status] || paceConfig.normal;
  const pacePercent = data.pacePercent || 0;
  const absPace = Math.abs(pacePercent);

  let paceMessage;
  if (status === "fast" || status === "slightly_fast") {
    paceMessage = `${absPace}% ${t("fasterThanUsual") || "faster than usual"}`;
  } else if (status === "slow" || status === "slightly_slow") {
    paceMessage = `${absPace}% ${t("slowerThanUsual") || "slower than usual"}`;
  } else {
    paceMessage = t("onTrack") || "On track with last month";
  }

  // Comparison bar: current vs previous daily average
  const maxDaily = Math.max(data.currentDailyAvg || 0, data.prevDailyAvg || 1);
  const currentBarPct = maxDaily > 0 ? Math.round(((data.currentDailyAvg || 0) / maxDaily) * 100) : 0;
  const prevBarPct = maxDaily > 0 ? Math.round(((data.prevDailyAvg || 0) / maxDaily) * 100) : 0;

  return (
    <Card variant="insight-card" className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="p-5">
        <div className="flex items-center gap-3.5 mb-4">
          <div className="insight-icon" style={{ background: config.iconGradient }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-400">
              {t("spendingPace") || "Spending Pace"}
            </p>
            <p className={`text-sm font-semibold ${config.textColor}`}>
              {config.icon} {paceMessage}
            </p>
          </div>
          {/* Projected badge */}
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-gray-400 dark:text-gray-400">{t("projected") || "Projected"}</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white insight-value">
              {formatCurrency(data.projectedTotal)}
            </p>
          </div>
        </div>

        {/* Comparison bars */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-gray-500 dark:text-gray-400">{t("thisMonth") || "This month"}</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(data.currentDailyAvg)}/{t("perDay") || "day"}</span>
            </div>
            <div className="progress-bar-track" style={{ height: "10px" }}>
              <div className="progress-bar-fill" style={{ width: `${currentBarPct}%`, background: config.gradient }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-gray-500 dark:text-gray-400">{t("lastMonth") || "Last month"}</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(data.prevDailyAvg)}/{t("perDay") || "day"}</span>
            </div>
            <div className="progress-bar-track" style={{ height: "10px" }}>
              <div className="progress-bar-fill" style={{ width: `${prevBarPct}%`, background: "rgba(156,163,175,0.4)" }} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
