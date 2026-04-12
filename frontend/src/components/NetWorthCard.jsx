import { useState, useEffect, useMemo } from "react";
import { transactionAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import { motion } from "framer-motion";
import { AnimatedItem } from "./AnimatedPage.jsx";

import Card from "./Card";
/**
 * NetWorthCard - Displays all-time net worth with sparkline trend
 * Shows: Total net worth, change vs last month, 6-month trend sparkline
 */
export default function NetWorthCard({ className = "" }) {
  const { t, formatCurrency, formatNumber } = useTranslation();
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
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchNetWorth();
    
    return () => { cancelled = true; };
  }, []);

  // Generate sparkline SVG path from trend data
  const sparklinePath = useMemo(() => {
    if (!data?.trend || data.trend.length < 2) return null;
    
    const values = data.trend.map(t => t.netWorth);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    
    // SVG dimensions
    const width = 80;
    const height = 24;
    const padding = 2;
    
    const points = values.map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    });
    
    return `M ${points.join(" L ")}`;
  }, [data?.trend]);

  // Determine trend direction and color
  const trendInfo = useMemo(() => {
    if (!data?.change) return { direction: "neutral", color: "text-gray-500" };
    
    const amount = data.change.amount || 0;
    if (amount > 0) {
      return { direction: "up", color: "text-green-500", bgColor: "stroke-green-500" };
    } else if (amount < 0) {
      return { direction: "down", color: "text-red-500", bgColor: "stroke-red-500" };
    }
    return { direction: "neutral", color: "text-gray-500", bgColor: "stroke-gray-400" };
  }, [data?.change]);

  if (loading) {
    return (
      <AnimatedItem className={className}>
        <Card style={{ borderColor: "rgba(59, 130, 246, 0.5)" }}>
          <div className="card-body">
            <div className="flex items-center animate-pulse">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 mr-4">
                <div className="w-6 h-6 bg-blue-200 dark:bg-blue-800 rounded" />
              </div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2" />
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32" />
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

  const netWorth = data?.netWorth || 0;
  const changeAmount = data?.change?.amount || 0;
  const changePercent = data?.change?.percent || 0;

  return (
    <AnimatedItem className={className}>
      <Card style={{ borderColor: "rgba(59, 130, 246, 0.5)" }}>
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 mr-4">
                <svg
                  className="w-6 h-6 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
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
                  {t("netWorth") || "Net Worth"}
                </h3>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`text-2xl font-bold ${netWorth >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {formatCurrency(netWorth)}
                </motion.p>
                {/* Change indicator */}
                {changeAmount !== 0 && (
                  <div className={`flex items-center text-xs ${trendInfo.color}`}>
                    {trendInfo.direction === "up" ? (
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span>
                      {formatCurrency(Math.abs(changeAmount))} ({changePercent > 0 ? "+" : ""}{formatNumber(changePercent, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Sparkline */}
            {sparklinePath && (
              <div className="ml-4">
                <svg width="80" height="24" className="opacity-80">
                  <path
                    d={sparklinePath}
                    fill="none"
                    className={trendInfo.bgColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>
      </Card>
    </AnimatedItem>
  );
}
