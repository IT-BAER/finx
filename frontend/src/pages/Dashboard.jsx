import { useState, useEffect, useRef } from "react";
import { transactionAPI, sharingAPI } from "../services/api.jsx";
import offlineAPI from "../services/offlineAPI.js";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import SourceCategoryBarChart from "../components/SourceCategoryBarChart.jsx";

import MultiCheckboxDropdown from "../components/MultiCheckboxDropdown.jsx";

import {
  LazyBar as Bar,
  LazyLine as Line,
  LazyPie as Pie,
} from "../components/LazyChart.jsx";
import { useTranslation } from "../hooks/useTranslation";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { motion } from "framer-motion";
import ChartLegend from "../components/ChartLegend.jsx";
import { AnimatedPage, AnimatedSection, AnimatedStagger, AnimatedItem } from "../components/AnimatedPage.jsx";

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

  // Ensure weekly dailyExpenses always contain exactly the last 7 days (fill zeros for missing days)
  const filledWeeklyDailyExpenses = (() => {
    const map = new Map();
    (weekly.dailyExpenses || []).forEach((d) => {
      const key = toYYYYMMDD(d.date);
      map.set(key, parseFloat(d.total || 0));
    });
    const arr = [];
    const start = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const key = toYYYYMMDD(day);
      arr.push({ date: key, total: map.get(key) || 0 });
    }
    return arr;
  })();

  return {
    summary: monthly.summary || { total_income: 0, total_expenses: 0, balance: 0 },
    dailyExpenses: filledWeeklyDailyExpenses,
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
  const [trendPerSourceChartData, setTrendPerSourceChartData] = useState(null);
  const [trendPerSourceLegend, setTrendPerSourceLegend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sources, setSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]); // empty = all

  // Persist dashboard filter per user
  const userKeyPart = (user?.id ?? user?.email ?? user?.uid ?? "anon").toString();
  const DASHBOARD_FILTER_STORAGE_KEY = `filters:dashboard:selectedSources:${userKeyPart}`;
  // Load saved selection on mount or when user changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DASHBOARD_FILTER_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setSelectedSources(arr);
      }
    } catch {}
  }, [DASHBOARD_FILTER_STORAGE_KEY]);
  // Save whenever selection changes
  useEffect(() => {
    try {
      localStorage.setItem(
        DASHBOARD_FILTER_STORAGE_KEY,
        JSON.stringify(selectedSources || []),
      );
    } catch {}
  }, [selectedSources, DASHBOARD_FILTER_STORAGE_KEY]);

  // Filtered data based on selected sources
  const [filteredSummary, setFilteredSummary] = useState(null);
  const [filteredDailyExpenses, setFilteredDailyExpenses] = useState([]);
  const [filteredExpenseByCategory, setFilteredExpenseByCategory] = useState([]);
  const [filteredRecentTransactions, setFilteredRecentTransactions] = useState([]);
  const isCurrentPage = useRef(true);

  const isIncomeTrackingDisabled = !!user?.income_tracking_disabled;
  // Treat "all individually selected" as no filter to avoid excluding uncategorized/unknown sources
  const shouldFilter = selectedSources.length > 0 && selectedSources.length < (sources?.length || Infinity);

  useEffect(() => {
    // Load sources for filter dropdown - only owner and shared sources
    (async () => {
      try {
        const res = await sharingAPI.getUserSources();
        // Axios wraps response: { data: { success, data: [...] } }
        const rawSources = Array.isArray(res?.data?.data) ? res.data.data : [];
        
        // Process sources to add display names for shared sources
        const processedSources = rawSources.map(source => {
          if (source.ownership_type === 'shared') {
            const ownerName = source.owner_first_name || source.owner_email || 'Unknown';
            return {
              ...source,
              displayName: `${source.name} (${ownerName})`,
              name: source.name // Keep original name for filtering
            };
          }
          return {
            ...source,
            displayName: source.name,
            name: source.name
          };
        });
        
        setSources(processedSources);
      } catch (err) {
        setSources([]);
      }
    })();
  }, []);

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
    // Single fetch of all transactions reused for derived charts (per-source + top expenses)
    (async () => {
      try {
        const all = await offlineAPI.getAllTransactions();
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = now;

        // Days labels 1..today (for per-source monthly chart)
        const dayLabels = [];
        {
          const temp = new Date(monthStart);
          while (temp <= monthEnd) {
            dayLabels.push(String(temp.getDate()));
            temp.setDate(temp.getDate() + 1);
          }
        }

        // Filter transactions by selected sources
        let filtered = all || [];
        const shouldFilterLocal = selectedSources.length > 0 && selectedSources.length < (sources?.length || Infinity);
        if (shouldFilterLocal) {
          // Convert selectedSources to strings for consistent comparison
          const selectedSourceIds = new Set(selectedSources.map(id => String(id)));
          // Also build a quick lookup of selected names (for mapping income target_name -> source)
          const selectedNamesLower = new Set(
            (sources || [])
              .filter((s) => selectedSourceIds.has(String(s.id)))
              .map((s) => String(s.name || "").trim().toLowerCase())
          );

          filtered = (all || []).filter((tx) => {
            const sid = tx.source_id != null ? String(tx.source_id) : null;
            if (sid && selectedSourceIds.has(sid)) return true;
            // For incomes, map by target_name to selected source names (server does similar fallback)
            if (String(tx.type).toLowerCase() === "income") {
              const tname = String(tx.target_name || "").trim().toLowerCase();
              if (tname && selectedNamesLower.has(tname)) return true;
            }
            return false;
          });
        }

        // =============================
        // Per-Source (Monthly) Trend
        // =============================
        // Group expenses by source_name per day index (daily totals for current month)
        const groups = new Map(); // source -> array of totals per day index
        const totalsBySource = new Map();
        const dayIndex = (d) => {
          const dd = new Date(d);
          return dd.getDate() - 1; // 0-based
        };

        (filtered || [])
          .filter((tx) => tx?.type === "expense")
          .forEach((tx) => {
            const d = new Date(tx.date);
            if (!(d >= monthStart && d <= monthEnd)) return;
            const sid = tx.source_id != null ? String(tx.source_id) : null;
            if (!sid) return;
            const idx = dayIndex(d);
            if (idx < 0 || idx >= dayLabels.length) return;
            if (!groups.has(sid)) groups.set(sid, new Array(dayLabels.length).fill(0));
            const arr = groups.get(sid);
            arr[idx] += Number(tx.amount || 0);
            totalsBySource.set(sid, (totalsBySource.get(sid) || 0) + Number(tx.amount || 0));
          });

        const sortedSources = Array.from(totalsBySource.entries()).sort((a, b) => b[1] - a[1]);
        const datasets = [];
        const palette = [
          "rgba(96, 165, 250, 1)", // blue
          "rgba(248, 113, 113, 1)", // red
          "rgba(52, 211, 153, 1)", // green
          "rgba(251, 191, 36, 1)",  // amber
          "rgba(139, 92, 246, 1)",  // purple
          "rgba(16, 185, 129, 1)",  // emerald
          "rgba(244, 114, 182, 1)", // pink
          "rgba(209, 213, 219, 1)", // gray-300
          "rgba(59, 130, 246, 1)",  // blue-500
          "rgba(234, 179, 8, 1)",   // yellow-500
        ];

        const idToLabel = (id) => {
          const sObj = (sources || []).find((s) => String(s.id) === String(id));
          return sObj ? (sObj.displayName || sObj.name || `Source ${id}`) : `Source ${id}`;
        };

        if (shouldFilterLocal) {
          // Show ALL selected sources individually (no aggregation)
          const ids = sortedSources.map(([id]) => id);
          ids.forEach((id, i) => {
            const daily = (groups.get(id) || new Array(dayLabels.length).fill(0)).slice();
            for (let k = 1; k < daily.length; k++) daily[k] += daily[k - 1];
            const cumulativeNegative = daily.map((v) => -v);
            datasets.push({
              label: idToLabel(id),
              data: cumulativeNegative,
              borderColor: palette[i % palette.length],
              backgroundColor: palette[i % palette.length].replace(", 1)", ", 0.12)"),
              borderWidth: 2,
              tension: 0.35,
              pointRadius: 0,
            });
          });
        } else {
          // All sources view: limit to top 5 and group the rest as "Other"
          const topIds = sortedSources.slice(0, 5).map(([id]) => id);
          topIds.forEach((id, i) => {
            const daily = (groups.get(id) || new Array(dayLabels.length).fill(0)).slice();
            for (let k = 1; k < daily.length; k++) daily[k] += daily[k - 1];
            const cumulativeNegative = daily.map((v) => -v);
            datasets.push({
              label: idToLabel(id),
              data: cumulativeNegative,
              borderColor: palette[i % palette.length],
              backgroundColor: palette[i % palette.length].replace(", 1)", ", 0.12)"),
              borderWidth: 2,
              tension: 0.35,
              pointRadius: 0,
            });
          });
          const others = sortedSources.slice(5).map(([id]) => id);
          if (others.length > 0) {
            const otherDaily = new Array(dayLabels.length).fill(0);
            others.forEach((id) => {
              const arr = groups.get(id) || [];
              for (let i = 0; i < dayLabels.length; i++) {
                otherDaily[i] += Number(arr[i] || 0);
              }
            });
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
        }

        const chartData = { labels: dayLabels, datasets };
        setPerSourceChartData(chartData);

        // =============================
        // Filtered Summary (Current month only)
        // =============================
        const filteredSummary = {
          total_income: 0,
          total_expenses: 0,
          balance: 0
        };

        const filteredMonthly = (filtered || []).filter((tx) => {
          const d = new Date(tx.date);
          return d >= monthStart && d <= monthEnd;
        });

        if (filteredMonthly.length > 0) {
          filteredMonthly.forEach((tx) => {
            const amount = parseFloat(tx.amount) || 0;
            if (tx.type === 'income') {
              filteredSummary.total_income += amount;
            } else if (tx.type === 'expense') {
              filteredSummary.total_expenses += amount;
            }
          });
          filteredSummary.balance = filteredSummary.total_income - filteredSummary.total_expenses;
        }
        setFilteredSummary(filteredSummary);

        // =============================
        // Filtered Daily Expenses (STRICT last 7 days)
        // =============================
        const weekEnd = new Date(now);
        weekEnd.setHours(23, 59, 59, 999);
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        // Pre-initialize map for last 7 days with zeros to ensure exactly 7 entries
        const weekMap = new Map(); // YYYY-MM-DD -> total
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart);
          d.setDate(weekStart.getDate() + i);
          weekMap.set(toYYYYMMDD(d), 0);
        }

        (filtered || [])
          .filter((tx) => tx?.type === "expense")
          .forEach((tx) => {
            const d = new Date(tx.date);
            if (d < weekStart || d > weekEnd) return; // enforce 7-day window
            const key = toYYYYMMDD(d);
            weekMap.set(key, (weekMap.get(key) || 0) + (parseFloat(tx.amount) || 0));
          });

        const filteredDailyExpenses = Array.from(weekMap.entries())
          .sort((a, b) => new Date(a[0]) - new Date(b[0]))
          .map(([date, total]) => ({ date, total }));
        setFilteredDailyExpenses(filteredDailyExpenses);

        // =============================
        // Filtered Expense by Category (Current month only)
        // =============================
        const filteredExpenseByCategory = [];
        const categoryExpenseMap = new Map();
        
        filteredMonthly
          .filter((tx) => tx?.type === "expense")
          .forEach((tx) => {
            const categoryName = tx.category_name || "Other";
            if (!categoryExpenseMap.has(categoryName)) {
              categoryExpenseMap.set(categoryName, 0);
            }
            categoryExpenseMap.set(categoryName, categoryExpenseMap.get(categoryName) + (parseFloat(tx.amount) || 0));
          });

        for (const [category_name, total] of categoryExpenseMap.entries()) {
          filteredExpenseByCategory.push({ category_name, total });
        }
        setFilteredExpenseByCategory(filteredExpenseByCategory);

        // =============================
        // Filtered Recent Transactions (Current month, top 10)
        // =============================
        const filteredRecentTransactions = filteredMonthly
          .slice()
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 10)
          .map((tx) => ({
            ...tx,
            id: tx.id || 0,
            amount: tx.amount || 0,
            category_name: tx.category_name || "",
            description: tx.description || "",
            date: tx.date || toYYYYMMDD(new Date()),
            type: tx.type || "expense",
          }));
        setFilteredRecentTransactions(filteredRecentTransactions);

        // Build legend items with current (last point) cumulative value per source
        const legendItems = datasets.map((ds) => ({
          label: ds.label,
          color: ds.borderColor,
          total: Array.isArray(ds.data) && ds.data.length > 0 ? ds.data[ds.data.length - 1] : 0,
        }));
        setPerSourceLegend(legendItems);

        // Largest 5 expenses this month from same dataset
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

        // =============================
        // Trend (last 7 days) per source with legend
        // =============================
        const trendWeekStart = new Date(now);
        trendWeekStart.setDate(now.getDate() - 6);
        trendWeekStart.setHours(0, 0, 0, 0);
        const trendWeekEnd = new Date(now);
        trendWeekEnd.setHours(23, 59, 59, 999);

        const dayKeys = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(trendWeekStart);
          d.setDate(trendWeekStart.getDate() + i);
          dayKeys.push(toYYYYMMDD(d));
        }

        const bySrcExp = new Map(); // sourceId -> number[7]
        const bySrcInc = new Map(); // sourceId -> number[7]

        // Map source name -> list of source ids from available sources
        const nameToIds = new Map();
        (sources || []).forEach((s) => {
          const nm = String(s.name || "").trim().toLowerCase();
          if (!nameToIds.has(nm)) nameToIds.set(nm, []);
          nameToIds.get(nm).push(String(s.id));
        });
        const selectedSet = new Set((selectedSources || []).map((x) => String(x)));

        (filtered || []).forEach((tx) => {
          const d = new Date(tx.date);
          if (d < trendWeekStart || d > trendWeekEnd) return;
          const key = toYYYYMMDD(d);
          const idx = dayKeys.indexOf(key);
          if (idx < 0) return;

          let sid = null;
          if (String(tx.type).toLowerCase() === 'expense') {
            sid = tx.source_id != null ? String(tx.source_id) : null;
          } else if (String(tx.type).toLowerCase() === 'income') {
            const tname = String(tx.target_name || '').trim().toLowerCase();
            const ids = nameToIds.get(tname) || [];
            if (ids.length > 0) {
              sid = shouldFilterLocal ? (ids.find((id) => selectedSet.has(id)) || ids[0]) : ids[0];
            }
          }
          if (!sid) return;

          if (String(tx.type).toLowerCase() === 'expense') {
            if (!bySrcExp.has(sid)) bySrcExp.set(sid, new Array(7).fill(0));
            const arr = bySrcExp.get(sid);
            arr[idx] += Number(tx.amount || 0);
          } else {
            if (!bySrcInc.has(sid)) bySrcInc.set(sid, new Array(7).fill(0));
            const arr = bySrcInc.get(sid);
            arr[idx] += Number(tx.amount || 0);
          }
        });

        // Build datasets per source
        const sourceTotals = [];
        const allIdsSet = new Set([...bySrcExp.keys(), ...bySrcInc.keys()]);
        allIdsSet.forEach((id) => {
          const expArr = (bySrcExp.get(id) || new Array(7).fill(0)).slice();
          const incArr = (bySrcInc.get(id) || new Array(7).fill(0)).slice();
          const totalExp = expArr.reduce((a,b)=>a+b,0);
          const totalInc = incArr.reduce((a,b)=>a+b,0);
          sourceTotals.push({ id, totalExp, totalInc });
        });
        // Sort by magnitude of contribution
        sourceTotals.sort((a,b)=> (b.totalExp + b.totalInc) - (a.totalExp + a.totalInc));

        const palette2 = [
          "rgba(96, 165, 250, 1)",
          "rgba(248, 113, 113, 1)",
          "rgba(52, 211, 153, 1)",
          "rgba(251, 191, 36, 1)",
          "rgba(139, 92, 246, 1)",
          "rgba(16, 185, 129, 1)",
          "rgba(244, 114, 182, 1)",
          "rgba(209, 213, 219, 1)",
          "rgba(59, 130, 246, 1)",
          "rgba(234, 179, 8, 1)",
        ];

        const trendDatasets = [];
        const namesForTrend = (() => {
          if (shouldFilterLocal) return sourceTotals.map((x) => x.id);
          return sourceTotals.slice(0, 5).map((x) => x.id); // All sources view: limit to top 5
        })();

        namesForTrend.forEach((id, i) => {
          const expArr = (bySrcExp.get(id) || new Array(7).fill(0)).slice();
          const incArr = (bySrcInc.get(id) || new Array(7).fill(0)).slice();
          let series = new Array(7).fill(0);
          if (isIncomeTrackingDisabled) {
            // cumulative negative expenses
            for (let k = 1; k < expArr.length; k++) expArr[k] += expArr[k - 1];
            series = expArr.map((v) => -v);
          } else {
            const net = expArr.map((v, idx) => (incArr[idx] || 0) - v);
            for (let k = 1; k < net.length; k++) net[k] += net[k - 1];
            series = net;
          }
          trendDatasets.push({
            label: (sources || []).find((s) => String(s.id) === String(id))?.displayName ||
                   (sources || []).find((s) => String(s.id) === String(id))?.name || `Source ${id}`,
            data: series,
            borderColor: palette2[i % palette2.length],
            backgroundColor: palette2[i % palette2.length].replace(", 1)", ", 0.12)"),
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          });
        });

        // Aggregate 'Other' only when not filtering and there are more than 5
        if (!shouldFilterLocal && sourceTotals.length > 5) {
          const restIds = sourceTotals.slice(5).map((x) => x.id);
          const aggExp = new Array(7).fill(0);
          const aggInc = new Array(7).fill(0);
          restIds.forEach((id) => {
            const e = bySrcExp.get(id) || [];
            const inc = bySrcInc.get(id) || [];
            for (let i = 0; i < 7; i++) {
              aggExp[i] += Number(e[i] || 0);
              aggInc[i] += Number(inc[i] || 0);
            }
          });
          let series = new Array(7).fill(0);
          if (isIncomeTrackingDisabled) {
            for (let k = 1; k < aggExp.length; k++) aggExp[k] += aggExp[k - 1];
            series = aggExp.map((v) => -v);
          } else {
            const net = aggExp.map((v, idx) => (aggInc[idx] || 0) - v);
            for (let k = 1; k < net.length; k++) net[k] += net[k - 1];
            series = net;
          }
          trendDatasets.push({
            label: "Other",
            data: series,
            borderColor: "rgba(107, 114, 128, 1)",
            backgroundColor: "rgba(107, 114, 128, 0.12)",
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          });
        }

        const trendLabels = dayKeys.map((d) => formatShortWeekday(d));
        setTrendPerSourceChartData({ labels: trendLabels, datasets: trendDatasets });
        const trendLegendItems = trendDatasets.map((ds) => ({
          label: ds.label,
          color: ds.borderColor,
          total: Array.isArray(ds.data) && ds.data.length > 0 ? ds.data[ds.data.length - 1] : 0,
        }));
        setTrendPerSourceLegend(trendLegendItems);
      } catch {}
    })();
  }, [dashboardData, selectedSources, sources]);

  const refreshDashboardData = async () => {
    try {
      const data = await loadDashboardData();
      if (!isCurrentPage.current) return;
      setDashboardData(data);
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
    maintainAspectRatio: false,
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
    layout: { padding: 16 },
    radius: "100%",
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
        clip: true,
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

  // Use filtered data if sources are selected, otherwise use dashboardData
  const trendDailyExpenses = shouldFilter && filteredDailyExpenses.length > 0 
    ? filteredDailyExpenses 
    : dashboardData?.dailyExpenses || [];

  if (trendDailyExpenses.length > 0) {
    // Process data in chronological order
    const sortedData = [...trendDailyExpenses].sort(
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
      const totalIncome = shouldFilter && filteredSummary
        ? filteredSummary.total_income
        : parseFloat(dashboardData.summary?.total_income) || 0;
      const totalExpenses = shouldFilter && filteredSummary
        ? filteredSummary.total_expenses  
        : parseFloat(dashboardData.summary?.total_expenses) || 0;
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
  <AnimatedPage>
  <div className="container mx-auto px-4 pt-4 md:pt-0 pb-4 min-h-0">
    <motion.div 
      className="flex flex-row items-center justify-between mb-8 gap-4 min-h-[3rem]"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <div className="flex items-center gap-4">
        <h1 className="display-2 leading-none">{t("dashboard")}</h1>
        <MultiCheckboxDropdown
          options={sources}
          selected={selectedSources}
          onChange={setSelectedSources}
          label={t("filterBySources")}
          allLabel={t("allSources")}
          id="dashboard-source-filter"
          useIcon={true}
        />
      </div>
      <div className="text-gray-500 dark:text-gray-400 text-base font-medium text-right whitespace-nowrap">
        {new Date().toLocaleDateString(
          language === "de" ? "de-DE" : "en-US",
          { month: "long" },
        )}
      </div>
    </motion.div>

    {/* ...existing code... */}
    {/* Source filter dropdown moved to title area */}

      {/* Summary Cards */}
      <AnimatedStagger 
        className={`grid grid-cols-1 md:grid-cols-2 ${isIncomeTrackingDisabled ? "lg:grid-cols-2" : "lg:grid-cols-4"} gap-6 mb-8`}
        staggerDelay={0.08}
        initialDelay={0}
      >
        {!isIncomeTrackingDisabled && (
          <AnimatedItem>
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
                    {formatCurrency(
                      shouldFilter && filteredSummary
                        ? filteredSummary.total_income
                        : dashboardData?.summary?.total_income || 0
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
          </AnimatedItem>
        )}

        <AnimatedItem>
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
                  {formatCurrency(
                    shouldFilter && filteredSummary
                      ? filteredSummary.total_expenses
                      : dashboardData?.summary?.total_expenses || 0
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
        </AnimatedItem>

        {!isIncomeTrackingDisabled && (
          <AnimatedItem>
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
                      shouldFilter && filteredSummary
                        ? filteredSummary.balance
                        : (dashboardData?.summary?.total_income || 0) -
                          (dashboardData?.summary?.total_expenses || 0)
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
          </AnimatedItem>
        )}

        <AnimatedItem>
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
                  {(() => {
                    // Use filtered data if sources are selected, otherwise use dashboardData
                    const dailyExpensesData = shouldFilter && filteredDailyExpenses.length > 0 
                      ? filteredDailyExpenses 
                      : dashboardData?.dailyExpenses || [];
                    
                    if (isIncomeTrackingDisabled) {
                      return dailyExpensesData.length > 0
                        ? formatCurrency(
                            dailyExpensesData.reduce(
                              (sum, item) => sum + parseFloat(item.total || 0),
                              0,
                            ) / dailyExpensesData.length,
                          )
                        : formatCurrency(0);
                    } else {
                      // For non-filtered case, use weekly expenses calculation
                      if (shouldFilter) {
                        // Calculate average from filtered 7-day series directly for consistency
                        return dailyExpensesData.length > 0
                          ? formatCurrency(
                              dailyExpensesData.reduce((sum, item) => sum + (parseFloat(item.total || 0)), 0) /
                              dailyExpensesData.length
                            )
                          : formatCurrency(0);
                      } else {
                        return dashboardData?.weeklyExpenses?.days_with_expenses > 0
                          ? formatCurrency(
                              dashboardData.weeklyExpenses.total_expenses /
                                dashboardData.weeklyExpenses.days_with_expenses,
                            )
                          : formatCurrency(0);
                      }
                    }
                  })()}
                </p>
              </div>
            </div>
          </div>
        </div>
        </AnimatedItem>
      </AnimatedStagger>

      {/* Daily Expenses Chart - Moved to top */}
      <AnimatedSection delay={0.3} scrollTriggered={false}>
      <div className="card md:h-[250px] mb-8">
        <div className="card-body h-full flex flex-col min-h-0">
          <h2 className="text-xl font-semibold mb-6">{t("dailyExpenses")}</h2>
          {(() => {
            // Use filtered data if sources are selected, otherwise use dashboardData
            const dailyExpensesData = shouldFilter && filteredDailyExpenses.length > 0 
              ? filteredDailyExpenses 
              : dashboardData?.dailyExpenses || [];
            
            return dailyExpensesData.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full flex-1"
                style={{ minHeight: 0 }}
              >
                <Bar
                  data={{
                    labels: dailyExpensesData.map((item) => formatShortWeekday(item.date)),
                    datasets: [
                      {
                        label: t("expenses"),
                        data: dailyExpensesData.map((item) => parseFloat(item.total || 0)),
                        backgroundColor: "rgba(248, 113, 113, 0.7)",
                        borderColor: "rgba(248, 113, 113, 1)",
                        borderWidth: 2,
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={dailyExpensesChartOptions}
                />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center py-8 text-gray-500"
              >
                {t("noDataAvailable")}
              </motion.div>
            );
          })()}
        </div>
      </div>
      </AnimatedSection>

      {/* Charts */}
      <AnimatedSection delay={0.4} scrollTriggered={false}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Source Spending by Category Chart */}
        <div className="card md:h-[370px] mb-8">
          <div className="card-body h-full flex flex-col min-h-0">
            <h2 className="text-xl font-semibold mb-6">{t("sourceCategoryBreakdown")}</h2>
            <SourceCategoryBarChart
              selectedSources={shouldFilter ? selectedSources : []}
              sources={sources}
            />
          </div>
        </div>
        <div className="card md:h-[370px]">
          <div className="card-body h-full flex flex-col min-h-0">
            <h2 className="text-xl font-semibold mb-6">
              {t("expensesByCategory")}
            </h2>
            {(() => {
              // Use filtered data if sources are selected, otherwise use dashboardData
              const expenseByCategoryData = shouldFilter && filteredExpenseByCategory.length > 0 
                ? filteredExpenseByCategory 
                : dashboardData?.expenseByCategory || [];
              
              return expenseByCategoryData.length > 0 ? (
                <>
                  {/* Mobile: custom legend with amounts (scrollable) */}
                  <div className="md:hidden">
                    <div className="w-full h-44">
                      <Pie
                        data={{
                          labels: expenseByCategoryData.map((item) => {
                            const name = (item.category_name || "").trim();
                            return name !== "" ? name : (t("uncategorized") || "Uncategorized");
                          }),
                          datasets: [
                            {
                              data: expenseByCategoryData.map((item) => parseFloat(item.total)),
                              radius: "85%",
                              backgroundColor: [
                                "rgba(248, 113, 113, 0.8)",
                                "rgba(96, 165, 250, 0.8)",
                                "rgba(251, 191, 36, 0.8)",
                                "rgba(139, 92, 246, 0.8)",
                                "rgba(16, 185, 129, 0.8)",
                                "rgba(244, 114, 182, 0.8)",
                                "rgba(209, 213, 219, 0.8)",
                                "rgba(139, 69, 19, 0.8)",
                              ],
                              borderColor: [
                                "rgba(248, 113, 113, 1)",
                                "rgba(96, 165, 250, 1)",
                                "rgba(251, 191, 36, 1)",
                                "rgba(139, 92, 246, 1)",
                                "rgba(16, 185, 129, 1)",
                                "rgba(244, 114, 182, 1)",
                                "rgba(209, 213, 219, 1)",
                                "rgba(139, 69, 19, 1)",
                              ],
                              borderWidth: 1,
                            },
                          ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: { padding: 8 },
                        plugins: {
                          legend: { display: false },
                          title: { display: false },
                          datalabels: {
                            color: "#fff",
                            font: { weight: "bold", size: 12 },
                            formatter: (value, context) => {
                              const total = context.dataset.data.reduce((acc, v) => acc + v, 0);
                              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                              return pct > 5 ? `${pct}%` : "";
                            },
                            anchor: "center",
                            align: "center",
                            clip: true,
                          },
                        },
                        cutout: "60%",
                      }}
                  />
                  </div>
                  <ChartLegend
                    labels={expenseByCategoryData.map((item) => {
                      const name = (item.category_name || "").trim();
                      return name !== "" ? name : (t("uncategorized") || "Uncategorized");
                    })}
                    values={expenseByCategoryData.map((item) => parseFloat(item.total))}
                    backgroundColor={[
                      "rgba(248, 113, 113, 0.8)",
                      "rgba(96, 165, 250, 0.8)",
                      "rgba(251, 191, 36, 0.8)",
                      "rgba(139, 92, 246, 0.8)",
                      "rgba(16, 185, 129, 0.8)",
                      "rgba(244, 114, 182, 0.8)",
                      "rgba(209, 213, 219, 0.8)",
                      "rgba(139, 69, 19, 0.8)",
                    ]}
                    formatCurrency={formatCurrency}
                  />
                </div>

                {/* Desktop: pie + custom right-side table legend */}
                <div className="hidden md:flex items-center gap-6 w-full flex-1 h-full">
                  <div className="flex-[2] h-full flex-1 min-w-0 overflow-hidden p-2 flex items-center justify-center" style={{ minHeight: 0 }}>
                    <Pie
                      data={{
                        labels: expenseByCategoryData.map((item) => {
                          const name = (item.category_name || "").trim();
                          return name !== "" ? name : (t("uncategorized") || "Uncategorized");
                        }),
                        datasets: [
                          {
                            data: expenseByCategoryData.map((item) => parseFloat(item.total)),
                            radius: "85%",
                            backgroundColor: [
                              "rgba(248, 113, 113, 0.8)",
                              "rgba(96, 165, 250, 0.8)",
                              "rgba(251, 191, 36, 0.8)",
                              "rgba(139, 92, 246, 0.8)",
                              "rgba(16, 185, 129, 0.8)",
                              "rgba(244, 114, 182, 0.8)",
                              "rgba(209, 213, 219, 0.8)",
                              "rgba(139, 69, 19, 0.8)",
                            ],
                            borderColor: [
                              "rgba(248, 113, 113, 1)",
                              "rgba(96, 165, 250, 1)",
                              "rgba(251, 191, 36, 1)",
                              "rgba(139, 92, 246, 1)",
                              "rgba(16, 185, 129, 1)",
                              "rgba(244, 114, 182, 1)",
                              "rgba(209, 213, 219, 1)",
                              "rgba(139, 69, 19, 1)",
                            ],
                            borderWidth: 1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: { padding: 12 },
                        radius: "100%",
                        plugins: {
                          // disable built-in legend for desktop: we render a table next to the chart
                          legend: { display: false },
                          title: { display: false },
                          datalabels: {
                            color: "#fff",
                            font: { weight: "bold", size: 12 },
                            formatter: (value, context) => {
                              const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                              return percentage > 5 ? `${percentage}%` : "";
                            },
                            anchor: "center",
                            align: "center",
                            clip: true,
                          },
                        },
                        cutout: "60%",
                      }}
                      style={{ height: "260px", width: "260px", margin: "0 auto" }}
                    />
                  </div>

                  {/* Right-side table legend */}
                  <div className="w-52 max-h-[260px] overflow-y-auto pt-1 self-center scrollbar-thin-modern">
                    <table className="w-full text-sm">
                      <tbody>
                        {expenseByCategoryData.map((item, idx) => {
                          const name = (item.category_name || "").trim() || (t("uncategorized") || "Uncategorized");
                          const amount = Number(item.total || 0);
                          const bg = [
                            "rgba(248, 113, 113, 0.8)",
                            "rgba(96, 165, 250, 0.8)",
                            "rgba(251, 191, 36, 0.8)",
                            "rgba(139, 92, 246, 0.8)",
                            "rgba(16, 185, 129, 0.8)",
                            "rgba(244, 114, 182, 0.8)",
                            "rgba(209, 213, 219, 0.8)",
                            "rgba(139, 69, 19, 0.8)",
                          ];
                          const color = bg[idx % bg.length];
                          return (
                            <tr key={`${name}-${idx}`} className="h-9">
                              <td className="align-middle pr-3">
                                <div className="flex items-center min-w-0">
                                  <span className="inline-block h-2.5 w-2.5 rounded-full mr-3 flex-shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                                  <span className="text-gray-700 dark:text-gray-300 truncate">{name}</span>
                                </div>
                              </td>
                              <td className="text-right align-middle text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                                {formatCurrency(amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
              ) : (
                <div className="text-center py-8 text-gray-500">{t("noDataAvailable")}</div>
              );
            })()}
          </div>
        </div>

        <div className="card md:h-[370px] lg:col-span-2">
          <div className="card-body h-full flex flex-col min-h-0">
            <h2 className="text-xl font-semibold mb-6">{t("balanceTrend")}</h2>
            {trendPerSourceChartData && trendPerSourceChartData.labels.length > 0 ? (
              <>
                {/* Mobile: compact chart + legend list */}
                <div className="md:hidden">
                  <div className="w-full h-44">
                    <Line data={trendPerSourceChartData} options={{ ...lineChartOptions, plugins: { ...lineChartOptions.plugins, legend: { display: false } } }} />
                  </div>
                  {trendPerSourceLegend && trendPerSourceLegend.length > 0 && (
                    <ChartLegend
                      labels={trendPerSourceLegend.map((i) => i.label)}
                      values={trendPerSourceLegend.map((i) => Math.abs(Number(i.total || 0)))}
                      backgroundColor={trendPerSourceLegend.map((i) => i.color)}
                      formatCurrency={formatCurrency}
                    />
                  )}
                </div>
                {/* Desktop: full-height chart + compact chips */}
                <div className="hidden md:flex flex-col w-full h-full flex-1 min-h-0">
                  <div className="flex-1 min-h-0 w-full">
                    <Line data={trendPerSourceChartData} options={lineChartOptions} style={{ height: "100%", width: "100%" }} />
                  </div>
                  {trendPerSourceLegend && trendPerSourceLegend.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                      {trendPerSourceLegend.map((item) => (
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
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {t("noDataAvailable")}
              </div>
            )}
          </div>
        </div>
      </div>
      </AnimatedSection>

      

    {/* Expenses by Source (This Month) */}
    <AnimatedSection delay={0.5} scrollTriggered={false}>
      <div className="card md:h-[370px] mb-8">
        <div className="card-body h-full flex flex-col min-h-0">
      <h2 className="text-xl font-semibold mb-6">{t("expensesBySource")}</h2>
  {perSourceChartData ? (
      <>
        {/* Mobile: compact chart + legend list */}
        <div className="md:hidden">
          <div className="w-full h-44">
            <Line
              data={perSourceChartData}
              options={{ ...lineChartOptions, responsive: true, maintainAspectRatio: false, plugins: { ...lineChartOptions.plugins, legend: { display: false } } }}
            />
          </div>
          {perSourceLegend && perSourceLegend.length > 0 && (
            <ChartLegend
              labels={perSourceLegend.map((i) => i.label)}
              values={perSourceLegend.map((i) => Math.abs(Number(i.total || 0)))}
              backgroundColor={perSourceLegend.map((i) => i.color)}
              formatCurrency={formatCurrency}
            />
          )}
        </div>

        {/* Desktop: full-height chart + compact chips */}
        <div className="hidden md:flex flex-col w-full h-full flex-1 min-h-0">
          <div className="flex-1 min-h-0 w-full">
            <Line data={perSourceChartData} options={lineChartOptions} style={{ height: "100%", width: "100%" }} />
          </div>
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
      </>
          ) : (
            <div className="text-center py-8 text-gray-500">{t("noDataAvailable")}</div>
          )}
        </div>
      </div>
    </AnimatedSection>

  {/* Income vs Expenses section intentionally removed from dashboard */}

      {/* Largest + Recent: side-by-side on desktop, stacked on mobile */}
      <AnimatedSection delay={0.6} scrollTriggered={false}>
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
{tx.description || tx.category_name || tx.category || (t("uncategorized") || "Uncategorized")}
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
{tx.description || tx.category_name || tx.category || (t("uncategorized") || "Uncategorized")}
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
{(() => {
            // Use filtered data if sources are selected, otherwise use dashboardData
            const recentTransactionsData = shouldFilter && filteredRecentTransactions.length > 0 
              ? filteredRecentTransactions 
              : dashboardData?.recentTransactions || [];
            
            if (recentTransactionsData.length === 0) {
              return (
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
              );
            }

            // Filter out income transactions if income tracking is disabled
            const filteredTransactions = isIncomeTrackingDisabled
              ? recentTransactionsData.filter(
                  (t) => t.type === "expense",
                )
              : recentTransactionsData;

            const displayTransactions = filteredTransactions.slice(0, 5);

            if (displayTransactions.length === 0) {
              return (
                <div className="text-center py-12">
                  <h2 className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    {t("noTransactions")}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("getStartedAddTransaction")}
                  </p>
                </div>
              );
            }

            return (
              <div>
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
{transaction.description || transaction.category_name || transaction.category || (t("uncategorized") || "Uncategorized")}
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
{transaction.description || transaction.category_name || transaction.category || (t("uncategorized") || "Uncategorized")}
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

                {/* Add transaction button */}
                <div className="text-center mt-6">
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
          })()}
        </div>
      </div>
      </div>
      </AnimatedSection>
  </div>
  </AnimatedPage>
  );
};

export default Dashboard;
