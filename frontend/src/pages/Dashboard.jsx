import { useState, useEffect, useRef } from "react";
import { transactionAPI } from "../services/api.jsx";
import offlineAPI from "../services/offlineAPI.js";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";

import {
  LazyBar as Bar,
  LazyLine as Line,
  LazyPie as Pie,
} from "../components/LazyChart.jsx";
import { useTranslation } from "../hooks/useTranslation";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { motion } from "framer-motion";

// Helper function to get YYYY-MM-DD from a date object in local timezone
const parseLocalDate = (value) => {
  if (typeof value === "string" && /\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.split("-").map((v) => parseInt(v, 10));
    return new Date(y, m - 1, d);
  }
  return new Date(value);
};

const toYYYYMMDD = (date) => {
  const d = parseLocalDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

async function loadDashboardData() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  const weekStartStr = toYYYYMMDD(weekStart);
  const weekEndStr = toYYYYMMDD(now);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = toYYYYMMDD(monthStart);
  const monthEndStr = toYYYYMMDD(now);

  // Previous month (full)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);
  const prevMonthStartStr = toYYYYMMDD(prevMonthStart);
  const prevMonthEndStr = toYYYYMMDD(prevMonthEnd);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const isTablet =
    typeof window !== "undefined" &&
    window.innerWidth >= 768 &&
    window.innerWidth < 1024;
  const monthsToFetch = isMobile ? 3 : isTablet ? 6 : 12;
  const ivsStart = new Date(
    now.getFullYear(),
    now.getMonth() - (monthsToFetch - 1),
    1,
  );
  const ivsEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const ivsStartStr = toYYYYMMDD(ivsStart);
  const ivsEndStr = toYYYYMMDD(ivsEnd);

  const [weeklyRes, monthlyRes, ivsRes, prevMonthlyRes] = await Promise.all([
    transactionAPI.getDashboardData({ startDate: weekStartStr, endDate: weekEndStr }),
    transactionAPI.getDashboardData({ startDate: monthStartStr, endDate: monthEndStr }),
    transactionAPI.getDashboardData({ startDate: ivsStartStr, endDate: ivsEndStr }),
    transactionAPI.getDashboardData({ startDate: prevMonthStartStr, endDate: prevMonthEndStr }),
  ]);

  const weekly = weeklyRes.data?.data || weeklyRes.data;
  const monthly = monthlyRes.data?.data || monthlyRes.data;
  const ivs = ivsRes.data?.data || ivsRes.data;
  const prevMonthly = prevMonthlyRes.data?.data || prevMonthlyRes.data;

  const incomeByDate = (ivs.incomeByDate || []).map((d) => ({
    ...d,
    total: parseFloat(d.total || 0),
  }));
  const expensesByDate = (ivs.dailyExpenses || []).map((d) => ({
    ...d,
    total: parseFloat(d.total || 0),
  }));

  return {
    summary: monthly.summary || { total_income: 0, total_expenses: 0, balance: 0 },
    dailyExpenses: (weekly.dailyExpenses || []).map((d) => ({
      date: d.date,
      total: parseFloat(d.total || 0),
    })),
    // Use monthly expense by category to reflect entire current month
    expenseByCategory: monthly.expenseByCategory || [],
    weeklyExpenses: weekly.weeklyExpenses || { total_expenses: 0, days_with_expenses: 0 },
    incomeByDate: incomeByDate,
    // Use monthly recent transactions to align with 'current month' expectations
    recentTransactions: (monthly.recentTransactions || weekly.recentTransactions || []).map((tx) => ({
      ...tx,
      id: tx.id || 0,
      amount: tx.amount || 0,
      category_name: tx.category_name || "",
      description: tx.description || "",
      date: tx.date || toYYYYMMDD(new Date()),
      type: tx.type || "expense",
    })),
    incomeVsExpensesData: {
      incomeByDate: incomeByDate,
      dailyExpenses: expensesByDate,
    },
    // For comparisons
    prevMonthDailyExpenses: (prevMonthly?.dailyExpenses || []).map((d) => ({
      date: d.date,
      total: parseFloat(d.total || 0),
    })),
  };
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { t, language, formatCurrency, formatDate } = useTranslation();
  const { user } = useAuth();
  const { dark } = useTheme();

  const [dashboardData, setDashboardData] = useState(null);
  const [topExpenses, setTopExpenses] = useState([]);
  const [perSourceChartData, setPerSourceChartData] = useState(null);
  const [perSourceLegend, setPerSourceLegend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // removed prefetch indicator
  const isCurrentPage = useRef(true);

  const isIncomeTrackingDisabled = !!user?.income_tracking_disabled;

  const loadDashboardDataWrapper = async () => {
    try {
      setLoading(true);
      const data = await loadDashboardData();
      if (!isCurrentPage.current) return;
      setDashboardData(data);
    } catch (err) {
      if (!isCurrentPage.current) return;
      setError("Failed to load dashboard data");
      console.error("Error loading dashboard data:", err);
    } finally {
      if (!isCurrentPage.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    isCurrentPage.current = true;
    loadDashboardDataWrapper();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshDashboardData();
      }
    };
    const handleDataRefresh = () => refreshDashboardData();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("dataRefreshNeeded", handleDataRefresh);

    return () => {
      isCurrentPage.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("dataRefreshNeeded", handleDataRefresh);
    };
  }, []);

  // Derive extra insights after data loads
  useEffect(() => {
    if (!dashboardData) return;

  // Build per-source cumulative line chart for current month (expenses only), like balance trend but per source
    (async () => {
      try {
        const all = await offlineAPI.getAllTransactions();
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = now;

        // Days labels 1..today
        const dayLabels = [];
        {
          const temp = new Date(monthStart);
          while (temp <= monthEnd) {
            dayLabels.push(String(temp.getDate()));
            temp.setDate(temp.getDate() + 1);
          }
        }

  // Group expenses by source_name per day index (daily totals)
        const groups = new Map(); // source -> array of totals per day index
        const totalsBySource = new Map();
        const dayIndex = (d) => {
          const dd = new Date(d);
          return dd.getDate() - 1; // 0-based
        };

        (all || [])
          .filter((tx) => tx?.type === "expense")
          .forEach((tx) => {
            const d = new Date(tx.date);
            if (!(d >= monthStart && d <= monthEnd)) return;
            const srcName = (tx.source_name || "Other").trim() || "Other";
            const idx = dayIndex(d);
            if (idx < 0 || idx >= dayLabels.length) return;
            if (!groups.has(srcName)) groups.set(srcName, new Array(dayLabels.length).fill(0));
            const arr = groups.get(srcName);
            arr[idx] += Number(tx.amount || 0);
            totalsBySource.set(srcName, (totalsBySource.get(srcName) || 0) + Number(tx.amount || 0));
          });

        // Limit to top 5 sources by total; collapse others into "Other"
        const sortedSources = Array.from(totalsBySource.entries()).sort((a, b) => b[1] - a[1]);
        const topSources = sortedSources.slice(0, 5).map(([name]) => name);
        const datasets = [];
        const palette = [
          "rgba(96, 165, 250, 1)", // blue
          "rgba(248, 113, 113, 1)", // red
          "rgba(52, 211, 153, 1)", // green
          "rgba(251, 191, 36, 1)",  // amber
          "rgba(139, 92, 246, 1)",  // purple
        ];

        topSources.forEach((name, i) => {
          const daily = (groups.get(name) || new Array(dayLabels.length).fill(0)).slice();
          // Convert to cumulative then invert to show decremental trend
          for (let k = 1; k < daily.length; k++) daily[k] += daily[k - 1];
          const cumulativeNegative = daily.map((v) => -v);
          datasets.push({
            label: name,
            data: cumulativeNegative,
            borderColor: palette[i % palette.length],
            backgroundColor: palette[i % palette.length].replace(", 1)", ", 0.12)"),
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          });
        });

        // Aggregate remaining sources into "Other" if any
        const others = sortedSources.slice(5).map(([name]) => name);
        if (others.length > 0) {
          const otherDaily = new Array(dayLabels.length).fill(0);
          others.forEach((name) => {
            const arr = groups.get(name) || [];
            for (let i = 0; i < dayLabels.length; i++) {
              otherDaily[i] += Number(arr[i] || 0);
            }
          });
          // Convert to cumulative and invert to decremental
          for (let k = 1; k < otherDaily.length; k++) otherDaily[k] += otherDaily[k - 1];
          const otherCumulativeNegative = otherDaily.map((v) => -v);
          datasets.push({
            label: "Other",
            data: otherCumulativeNegative,
            borderColor: "rgba(107, 114, 128, 1)", // gray-500
            backgroundColor: "rgba(107, 114, 128, 0.12)",
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          });
        }

        const chartData = { labels: dayLabels, datasets };
        setPerSourceChartData(chartData);
        // Build legend items with current (last point) cumulative value per source
        const legendItems = datasets.map((ds) => ({
          label: ds.label,
          color: ds.borderColor,
          total: Array.isArray(ds.data) && ds.data.length > 0 ? ds.data[ds.data.length - 1] : 0,
        }));
        setPerSourceLegend(legendItems);
      } catch {}
    })();

    // Largest 5 expenses this month from local/all transactions
    (async () => {
      try {
        const all = await offlineAPI.getAllTransactions();
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = now;
        const top = (all || [])
          .filter((tx) => tx?.type === "expense")
          .filter((tx) => {
            const d = new Date(tx.date);
            return d >= start && d <= end;
          })
          .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
          .slice(0, 5);
        setTopExpenses(top);
      } catch {}
    })();
  }, [dashboardData]);

  const refreshDashboardData = async () => {
    try {
      const { getIsOnline } = await import("../services/connectivity.js");
      if (getIsOnline()) {
        const data = await loadDashboardData();
        if (!isCurrentPage.current) return;
        setDashboardData(data);
      }
    } catch (err) {
      console.error("Error refreshing dashboard data:", err);
    }
  };

  // Helper function to format date as short weekday based on language
  const formatShortWeekday = (date) => {
    const dateObj = new Date(date);
    const weekday = dateObj.toLocaleDateString(
      language === "de" ? "de-DE" : "en-US",
      { weekday: "short" },
    );
    // Remove period if it exists (for German dates like "Mo." -> "Mo")
    return weekday.replace(/\.$/, "");
  };

  // Helper function to get week number
  const getWeekNumber = (date) => {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  };

  // Income vs Expenses chart removed from dashboard

  const dailyExpensesChartOptions = {
    responsive: true,
    animation: {
      duration: 0, // Disable animation to prevent datalabels from jumping
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
          },
        },
      },
    },
    scales: {
      y: {
        display: false, // Hide y-axis to make bars wider and maintain consistency
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          color: "#6b7280",
          callback: function (value) {
            return formatCurrency(value);
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "#6b7280",
        },
      },
    },
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
    legend: {
        position: "right",
        labels: {
      // Brighten labels in dark mode for better contrast
      color: dark ? "#ffffff" : "#374151",
          font: {
            size: 12,
            weight: "600",
          },
          usePointStyle: true,
          boxWidth: 12,
          padding: 15,
        },
        // Custom legend rendering to place percentages in colored squares
        onHover: function (event, legendItem, legend) {
          // This is just to prevent default hover behavior if needed
        },
      },
      title: {
        display: false,
      },
      datalabels: {
        color: "#fff",
        font: {
          weight: "bold",
          size: 12,
        },
        formatter: (value, context) => {
          // Calculate total for percentage
          const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
          // Calculate percentage
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
          // Only show percentage if it's above 5% to avoid clutter
          return percentage > 5 ? `${percentage}%` : "";
        },
        anchor: "center",
        align: "center",
      },
    },
    cutout: "60%",
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
          },
        },
      },
      datalabels: {
        display: false,
      },
    },
    scales: {
      y: {
        display: true, // Show y-axis for better context
        beginAtZero: false,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          color: "#6b7280",
          callback: function (value) {
            return formatCurrency(value);
          },
          stepSize: function (context) {
            // Dynamically calculate step size based on data range to reduce number of ticks
            const chart = context.chart;
            const min = chart.scales.y.min;
            const max = chart.scales.y.max;
            const range = max - min;
            // Aim for 4-5 ticks by rounding to nice numbers
            const roughStep = range / 4;
            // Round to nearest significant value (10, 50, 100, 500, 1000, etc.)
            const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
            const normalized = roughStep / magnitude;
            let niceStep;
            if (normalized < 1.5) {
              niceStep = 1 * magnitude;
            } else if (normalized < 3) {
              niceStep = 2 * magnitude;
            } else if (normalized < 7.5) {
              niceStep = 5 * magnitude;
            } else {
              niceStep = 10 * magnitude;
            }
            return niceStep;
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "#6b7280",
        },
      },
    },
    interaction: {
      mode: "nearest",
      axis: "x",
      intersect: false,
    },
    tension: 0.4, // Smoother curves
  };

  if (loading) {
    return (
  <div className="container mx-auto px-4 pt-4 md:pt-0 pb-4">
        <div className="flex justify-center items-center h-64">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
  <div className="container mx-auto px-4 pt-4 md:pt-0 pb-4">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  // Income vs Expenses data and chart removed

  // Process trend data to show actual balance or expenses trend based on income tracking setting
  let trendLabels = [];
  let trendValues = [];
  let trendLabel = t("balanceTrend");

  if (dashboardData?.dailyExpenses) {
    // Process data in chronological order
    const sortedData = [...dashboardData.dailyExpenses].sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );

    trendLabels = sortedData.map((item) => formatShortWeekday(item.date));

    if (isIncomeTrackingDisabled) {
      // Show cumulative expenses trend when income tracking is disabled
      trendLabel = t("expensesTrend");
      // Calculate cumulative expenses
      const cumulativeExpenses = [];
      let runningTotal = 0;
      sortedData.forEach((item) => {
        runningTotal += parseFloat(item.total || 0);
        cumulativeExpenses.push(runningTotal);
      });
      trendValues = cumulativeExpenses;
    } else {
      // Show balance trend when income tracking is enabled
      // Calculate cumulative balance based on daily expenses with improved accuracy
      const totalIncome = parseFloat(dashboardData.summary?.total_income) || 0;
      const totalExpenses =
        parseFloat(dashboardData.summary?.total_expenses) || 0;
      const finalBalance = totalIncome - totalExpenses;

      // Calculate running balance with improved algorithm
      const balanceValues = [];
      // Calculate initial balance at the start of the period
      let initialBalance = finalBalance;
      for (let i = sortedData.length - 1; i >= 0; i--) {
        initialBalance += parseFloat(sortedData[i].total || 0);
      }

      // Work forwards through the data to calculate balance at end of each day
      let currentBalance = initialBalance;
      balanceValues.push(currentBalance); // Balance at start of period

      // Work forwards through the data (chronological order)
      for (let i = 0; i < sortedData.length; i++) {
        // Subtract this day's expenses to get the balance at the end of the day
        currentBalance -= parseFloat(sortedData[i].total || 0);
        // Add that balance to the array
        balanceValues.push(currentBalance);
      }

      trendValues = balanceValues;
    }
  }

  const trendData = {
    labels: trendLabels,
    datasets: [
      {
        label: trendLabel,
        data: trendValues,
        fill: false,
        borderColor: isIncomeTrackingDisabled
          ? "rgba(248, 113, 113, 1)"
          : "rgba(96, 165, 250, 1)",
        backgroundColor: isIncomeTrackingDisabled
          ? "rgba(248, 113, 113, 0.1)"
          : "rgba(96, 165, 250, 0.1)",
        tension: 0.4,
        pointBackgroundColor: isIncomeTrackingDisabled
          ? "rgba(248, 113, 113, 1)"
          : "rgba(96, 165, 250, 1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: isIncomeTrackingDisabled
          ? "rgba(248, 113, 113, 1)"
          : "rgba(96, 165, 250, 1)",
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };

  // monthCompareData removed; replaced by perSourceChartData

  return (
  <div className="container mx-auto px-4 pt-4 md:pt-0 pb-4 min-h-0">

      <div className="flex flex-row items-center justify-between mb-8 gap-4">
        <h1 className="display-2">{t("dashboard")}</h1>
        <div className="text-gray-500 dark:text-gray-400 text-base font-medium text-right whitespace-nowrap">
          {new Date().toLocaleDateString(
            language === "de" ? "de-DE" : "en-US",
            { month: "long" },
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 ${isIncomeTrackingDisabled ? "lg:grid-cols-2" : "lg:grid-cols-4"} gap-6 mb-8`}
      >
        {!isIncomeTrackingDisabled && (
          <div
            className="card"
            style={{ borderColor: "rgba(52, 211, 153, 0.5)" }}
          >
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 mr-4">
                  <svg
                    className="w-6 h-6 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t("totalIncome")}
                  </h2>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(dashboardData?.summary?.total_income || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          className="card"
          style={{ borderColor: "rgba(248, 113, 113, 0.5)" }}
        >
          <div className="card-body">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30 mr-4">
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t("totalExpenses")}
                </h2>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(dashboardData?.summary?.total_expenses || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {!isIncomeTrackingDisabled && (
          <div
            className="card"
            style={{ borderColor: "rgba(168, 85, 247, 0.5)" }}
          >
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 mr-4">
                  <svg
                    className="w-6 h-6 text-purple-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t("netSavings")}
                  </h2>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(
                      (dashboardData?.summary?.total_income || 0) -
                        (dashboardData?.summary?.total_expenses || 0),
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          className="card"
          style={{ borderColor: "rgba(249, 115, 22, 0.5)" }}
        >
          <div className="card-body">
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  ></path>
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {isIncomeTrackingDisabled
                    ? "Ø " + t("dailyExpenses")
                    : "Ø " + t("dailyExpenses")}
                </h2>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {isIncomeTrackingDisabled
                    ? dashboardData?.dailyExpenses?.length > 0
                      ? formatCurrency(
                          dashboardData.dailyExpenses.reduce(
                            (sum, item) => sum + parseFloat(item.total || 0),
                            0,
                          ) / dashboardData.dailyExpenses.length,
                        )
                      : formatCurrency(0)
                    : dashboardData?.weeklyExpenses?.days_with_expenses > 0
                      ? formatCurrency(
                          dashboardData.weeklyExpenses.total_expenses /
                            dashboardData.weeklyExpenses.days_with_expenses,
                        )
                      : formatCurrency(0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Expenses Chart - Moved to top */}
      <div className="card mb-8">
        <div className="card-body">
          <h2 className="text-xl font-semibold mb-6">{t("dailyExpenses")}</h2>
          {dashboardData?.dailyExpenses ? (
            <div className="w-full" style={{ height: "auto", minHeight: 0 }}>
              <Bar
                data={{
                  labels: dashboardData.dailyExpenses.map((item) =>
                    formatShortWeekday(item.date),
                  ),
                  datasets: [
                    {
                      label: t("expenses"),
                      data: dashboardData.dailyExpenses.map((item) =>
                        parseFloat(item.total),
                      ),
                      backgroundColor: "rgba(248, 113, 113, 0.7)",
                      borderColor: "rgba(248, 113, 113, 1)",
                      borderWidth: 2,
                      borderRadius: 6,
                    },
                  ],
                }}
                options={{
                  ...dailyExpensesChartOptions,
                  maintainAspectRatio: false,
                  plugins: {
                    ...dailyExpensesChartOptions.plugins,
                    datalabels: {
                      anchor: "center",
                      align: "center",
                      formatter: (value) =>
                        value !== 0 ? formatCurrency(value) : "",
                      color: "#FFFFFF",
                      font: {
                        weight: "bold",
                        size: 10,
                      },
                      display: (context) =>
                        context.dataset.data[context.dataIndex] !== 0,
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {t("noDataAvailable")}
            </div>
          )}
          {dashboardData?.dailyExpenses && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ø {t("dailyExpenses")}:{" "}
                <span className="font-semibold">
                  {formatCurrency(
                    dashboardData.dailyExpenses.reduce(
                      (sum, item) => sum + parseFloat(item.total),
                      0,
                    ) / dashboardData.dailyExpenses.length,
                  )}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="card">
          <div className="card-body">
            <h2 className="text-xl font-semibold mb-6">
              {t("expensesByCategory")}
            </h2>
            {dashboardData?.expenseByCategory ? (
              <div className="w-full" style={{ height: "auto", minHeight: 0 }}>
                <Pie
                  data={{
                    labels: dashboardData.expenseByCategory.map((item) => {
                      const name = (item.category_name || "").trim();
                      return name !== "" ? name : (t("uncategorized") || "Uncategorized");
                    }),
                    datasets: [
                      {
                        data: dashboardData.expenseByCategory.map((item) =>
                          parseFloat(item.total),
                        ),
                        backgroundColor: [
                          "rgba(255, 99, 132, 0.7)",
                          "rgba(54, 162, 235, 0.7)",
                          "rgba(255, 205, 86, 0.7)",
                          "rgba(75, 192, 192, 0.7)",
                          "rgba(153, 102, 255, 0.7)",
                          "rgba(255, 159, 64, 0.7)",
                          "rgba(199, 199, 199, 0.7)",
                          "rgba(83, 102, 255, 0.7)",
                        ],
                        borderColor: [
                          "rgba(255, 99, 132, 1)",
                          "rgba(54, 162, 235, 1)",
                          "rgba(255, 205, 86, 1)",
                          "rgba(75, 192, 192, 1)",
                          "rgba(153, 102, 255, 1)",
                          "rgba(255, 159, 64, 1)",
                          "rgba(199, 199, 199, 1)",
                          "rgba(83, 102, 255, 1)",
                        ],
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={pieChartOptions}
                />
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {t("noDataAvailable")}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 className="text-xl font-semibold mb-6">{t("balanceTrend")}</h2>
            {trendData.labels.length > 0 ? (
              <div className="w-full" style={{ height: "auto", minHeight: 0 }}>
                <Line data={trendData} options={lineChartOptions} />
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {t("noDataAvailable")}
              </div>
            )}
          </div>
        </div>
      </div>

      

    {/* Expenses by Source (This Month) */}
      <div className="card mb-8">
        <div className="card-body">
      <h2 className="text-xl font-semibold mb-6">{t("expensesBySource")}</h2>
      {perSourceChartData ? (
            <div className="w-full" style={{ height: "auto", minHeight: 0 }}>
              <Line data={perSourceChartData} options={lineChartOptions} />
              {perSourceLegend && perSourceLegend.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                  {perSourceLegend.map((item) => (
                    <div key={item.label} className="flex items-center space-x-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {item.label}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">• {formatCurrency(Number(item.total || 0))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">{t("noDataAvailable")}</div>
          )}
        </div>
      </div>

  {/* Income vs Expenses section intentionally removed from dashboard */}

      {/* Largest + Recent: side-by-side on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="card">
          <div className="card-body">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">{t("largestExpenses")}</h2>
          </div>
          {topExpenses && topExpenses.length > 0 ? (
            <div className="overflow-x-auto md:overflow-x-visible" style={{ touchAction: "pan-y" }}>
              {/* Mobile view - Card layout */}
              <div className="md:hidden space-y-4">
                {topExpenses.map((tx) => (
                  <div
                    key={tx.id}
                    className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-gray-200 truncate">
                          {tx.description || "N/A"}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(tx.date)}
                        </div>
                        {tx.category_name && (
                          <div className="text-sm">
                            <span className="badge badge-primary">{tx.category_name}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-red-600 dark:text-red-400 font-medium whitespace-nowrap ml-2">
                        -{formatCurrency(Number(tx.amount || 0))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop view - Table */}
              <div className="hidden md:block">
                <table className="table w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t("date")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t("description")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t("category")}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t("amount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {topExpenses.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                          {formatDate(tx.date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200 max-w-xs truncate">
                          {tx.description || "N/A"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                          {tx.category_name ? (
                            <span className="badge badge-primary">{tx.category_name}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-red-600 dark:text-red-400">
                          -{formatCurrency(Number(tx.amount || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                ></path>
              </svg>
              <h2 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-200">
                {t("noTransactions")}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("getStartedAddTransaction")}
              </p>
              <div className="mt-6">
                <Button
                  variant="primary"
                  onClick={() => navigate("/add-transaction")}
                  haptic="tap"
                  aria-label={t("addTransaction")}
                >
                  {t("addTransaction")}
                </Button>
              </div>
            </div>
          )}
  </div>
  </div>

  {/* Recent Transactions */}
  <div className="card">
        <div className="card-body">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">{t("recentTransactions")}</h2>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 800, damping: 30 }}
            >
              <a
                href="/transactions"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
              >
                {t("viewAll")}
              </a>
            </motion.div>
          </div>
          {dashboardData?.recentTransactions ? (
            (() => {
              // Filter out income transactions if income tracking is disabled
              const filteredTransactions = isIncomeTrackingDisabled
                ? dashboardData.recentTransactions.filter(
                    (t) => t.type === "expense",
                  )
                : dashboardData.recentTransactions;

              const displayTransactions = filteredTransactions.slice(0, 5);

              return displayTransactions.length > 0 ? (
                <div
                  className="overflow-x-auto md:overflow-x-visible"
                  style={{ touchAction: "pan-y" }}
                >
                  {/* Mobile view - Card layout */}
                  <div className="md:hidden space-y-4">
                    {displayTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0 last:pb-0"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-gray-200 truncate">
                              {transaction.description || "N/A"}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(transaction.date)}
                            </div>
                            <div className="text-sm">
                              <span className="badge badge-primary">
                                {transaction.category_name}
                              </span>
                            </div>
                          </div>
                          <div
                            className={`font-medium whitespace-nowrap ml-2 ${transaction.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                          >
                            {transaction.type === "income" ? "+" : "-"}
                            {formatCurrency(parseFloat(transaction.amount))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop view - Table */}
                  <div className="hidden md:block">
                    <table className="table w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("date")}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("description")}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("category")}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("amount")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {displayTransactions.map((transaction) => (
                          <tr
                            key={transaction.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                              {formatDate(transaction.date)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200 max-w-xs truncate">
                              {transaction.description || "N/A"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                              <span className="badge badge-primary">
                                {transaction.category_name}
                              </span>
                            </td>
                            <td
                              className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${transaction.type === "income" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                            >
                              {transaction.type === "income" ? "+" : "-"}
                              {formatCurrency(parseFloat(transaction.amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    ></path>
                  </svg>
                  <h2 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-200">
                    {t("noTransactions")}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t("getStartedAddTransaction")}
                  </p>
                  <div className="mt-6">
                    <Button
                      variant="primary"
                      onClick={() => navigate("/add-transaction")}
                      haptic="tap"
                      aria-label={t("addTransaction")}
                    >
                      {t("addTransaction")}
                    </Button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                ></path>
              </svg>
              <h2 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-200">
                {t("noTransactions")}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("getStartedAddTransaction")}
              </p>
              <div className="mt-6">
                <Button
                  variant="primary"
                  onClick={() => navigate("/add-transaction")}
                  haptic="tap"
                >
                  {t("addTransaction")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};

export default Dashboard;
