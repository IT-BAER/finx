import { useState, useEffect, useMemo } from "react";
import { transactionAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import Card from "./Card";

export default function NetWorthCard({ className = "" }) {
  const { t, formatCurrency } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchNetWorth = async () => {
      try {
        setLoading(true);
        const response = await transactionAPI.getNetWorth();
        if (!cancelled) {
          setData(response.data?.data || response.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch net worth:", err);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchNetWorth();
    return () => { cancelled = true; };
  }, []);

  // Sparkline path from trend data (wider for the new layout)
  const sparklinePath = useMemo(() => {
    if (!data?.trend || data.trend.length < 2) return null;
    const values = data.trend.map(t => t.netWorth);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 120;
    const height = 40;
    const padding = 2;
    const points = values.map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  }, [data?.trend]);

  // Area fill path (enclose sparkline below)
  const areaPath = useMemo(() => {
    if (!sparklinePath || !data?.trend) return null;
    const values = data.trend.map(t => t.netWorth);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 120;
    const height = 40;
    const padding = 2;
    const points = values.map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    });
    return `M ${padding},${height} L ${points.join(" L ")} L ${width - padding},${height} Z`;
  }, [sparklinePath, data?.trend]);

  const trendInfo = useMemo(() => {
    if (!data?.change) return { direction: "neutral", color: "text-gray-500", stroke: "#9ca3af", fill: "rgba(156,163,175,0.1)" };
    const amount = data.change.amount || 0;
    if (amount > 0) return { direction: "up", color: "text-emerald-500", stroke: "#10b981", fill: "rgba(16,185,129,0.1)" };
    if (amount < 0) return { direction: "down", color: "text-red-500", stroke: "#ef4444", fill: "rgba(239,68,68,0.1)" };
    return { direction: "neutral", color: "text-gray-500", stroke: "#9ca3af", fill: "rgba(156,163,175,0.1)" };
  }, [data?.change]);

  if (loading) {
    return (
      <Card variant="insight-card" className={className}>
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="insight-skeleton w-11 h-11" />
            <div className="flex-1 space-y-2">
              <div className="insight-skeleton h-3 w-20" />
              <div className="insight-skeleton h-7 w-32" />
            </div>
            <div className="insight-skeleton w-[120px] h-10 rounded-xl" />
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

  const netWorth = data?.netWorth || 0;
  const changeAmount = data?.change?.amount || 0;
  const changePercent = data?.change?.percent || 0;

  return (
    <Card variant="insight-card" className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="p-5">
        <div className="flex items-start gap-3.5">
          {/* Left: icon + values */}
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="insight-icon mt-0.5" style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-400 mb-0.5">
                {t("netWorth") || "Net Worth"}
              </p>
              <p className={`text-2xl font-bold insight-value ${netWorth >= 0 ? "text-gray-900 dark:text-white" : "text-red-600 dark:text-red-400"}`}>
                {formatCurrency(netWorth)}
              </p>
              {changeAmount !== 0 && (
                <div className={`flex items-center gap-1 text-xs font-medium mt-0.5 ${trendInfo.color}`}>
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${trendInfo.direction === "up" ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-red-100 dark:bg-red-900/40"}`}>
                    {trendInfo.direction === "up" ? "↑" : "↓"}
                  </span>
                  <span>{formatCurrency(Math.abs(changeAmount))}</span>
                  <span className="text-gray-400">({changePercent > 0 ? "+" : ""}{changePercent.toFixed(1)}%)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sparkline — fixed height, not flex-stretched */}
        {sparklinePath && (
          <div className="mt-3 opacity-90" style={{ height: 40 }}>
            <svg width="100%" height="100%" viewBox="0 0 120 40" preserveAspectRatio="none" className="overflow-visible">
              <defs>
                <linearGradient id="nw-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={trendInfo.stroke} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={trendInfo.stroke} stopOpacity="0" />
                </linearGradient>
              </defs>
              {areaPath && <path d={areaPath} fill="url(#nw-area)" />}
              <path d={sparklinePath} fill="none" stroke={trendInfo.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        )}
      </div>
    </Card>
  );
}
