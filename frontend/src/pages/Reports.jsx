import { useState, useEffect, useRef } from "react";
import {
  LazyBar as Bar,
  LazyLine as Line,
  LazyPie as Pie,
} from "../components/LazyChart.jsx";
import { useTranslation } from "../hooks/useTranslation";
import DateRangeToggle from "../components/DateRangeToggle.jsx";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext.jsx";
import offlineAPI from "../services/offlineAPI.js";
import MultiCheckboxDropdown from "../components/MultiCheckboxDropdown.jsx";
import { transactionAPI, sharingAPI } from "../services/api.jsx";
import { motion } from "framer-motion";
import ChartLegend from "../components/ChartLegend.jsx";
import SourceCategoryBarChart from "../components/SourceCategoryBarChart.jsx";
import PerSourceExpensesTrend from "../components/PerSourceExpensesTrend.jsx";
import PerSourceBalanceTrend from "../components/PerSourceBalanceTrend.jsx";
import DailyExpensesChart from "../components/DailyExpensesChart.jsx";
import SummaryCards from "../components/SummaryCards.jsx";

// Helper function to process filtered transactions into API-like format
const processFilteredTransactions = (transactions, timeRange, startDate, endDate) => {
  // Group expenses by date
  const dailyExpenses = new Map();
  const incomeByDate = new Map();
  const expenseByCategory = new Map();

  transactions.forEach((tx) => {
    const date = tx.date;
    const amount = parseFloat(tx.amount) || 0;

    if (tx.type === 'expense') {
      // Daily expenses
      if (!dailyExpenses.has(date)) {
        dailyExpenses.set(date, 0);
      }
      dailyExpenses.set(date, dailyExpenses.get(date) + amount);

      // Expense by category
      const category = tx.category_name || 'Uncategorized';
      if (!expenseByCategory.has(category)) {
        expenseByCategory.set(category, 0);
      }
      expenseByCategory.set(category, expenseByCategory.get(category) + amount);
    } else if (tx.type === 'income') {
      // Income by date
      if (!incomeByDate.has(date)) {
        incomeByDate.set(date, 0);
      }
      incomeByDate.set(date, incomeByDate.get(date) + amount);
    }
  });

  // Convert to API format
  const dailyExpensesData = Array.from(dailyExpenses.entries()).map(([date, total]) => ({
    date,
    total: total.toString()
  }));

  console.log('processFilteredTransactions result:', {
    dailyExpensesCount: dailyExpensesData.length,
    dateRange: dailyExpensesData.map(d => d.date),
    timeRange
  });

  const incomeByDateData = Array.from(incomeByDate.entries()).map(([date, total]) => ({
    date,
    total: total.toString()
  }));

  const expenseByCategoryData = Array.from(expenseByCategory.entries()).map(([category_name, total]) => ({
    category_name,
    total: total.toString()
  }));

  // Calculate summary
  const totalExpenses = Array.from(dailyExpenses.values()).reduce((sum, val) => sum + val, 0);
  const totalIncome = Array.from(incomeByDate.values()).reduce((sum, val) => sum + val, 0);

  return {
    dailyExpenses: dailyExpensesData,
    incomeByDate: incomeByDateData,
    expenseByCategory: expenseByCategoryData,
    summary: {
      total_expenses: totalExpenses,
      total_income: totalIncome,
      balance: totalIncome - totalExpenses
    }
  };
};

// Helper function to return empty report data
const getEmptyReportData = () => ({
  dailyExpenses: [],
  incomeByDate: [],
  expenseByCategory: [],
  summary: {
    total_expenses: 0,
    total_income: 0,
    balance: 0
  }
});

const Reports = () => {
  // Hooks that provide user/theme/i18n must be called before using their values
  const { isIncomeTrackingDisabled, user } = useAuth();
  const { t, formatCurrency, formatDate, language } = useTranslation();
  const { dark } = useTheme();

  const [sources, setSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]); // empty = all

  // Persist reports filter per user
  const userKeyPart = (user?.id ?? user?.email ?? user?.uid ?? "anon").toString();
  const REPORTS_FILTER_STORAGE_KEY = `filters:reports:selectedSources:${userKeyPart}`;
  // Load saved selection on mount or when user changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(REPORTS_FILTER_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setSelectedSources(arr);
      }
    } catch { }
  }, [REPORTS_FILTER_STORAGE_KEY]);
  // Save whenever selection changes
  useEffect(() => {
    try {
      localStorage.setItem(
        REPORTS_FILTER_STORAGE_KEY,
        JSON.stringify(selectedSources || []),
      );
    } catch { }
  }, [selectedSources, REPORTS_FILTER_STORAGE_KEY]);

  useEffect(() => {
    // Load sources for filter dropdown - only owner and shared sources
    (async () => {
      try {
        const res = await sharingAPI.getUserSources();
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
  const [timeRange, setTimeRange] = useState("weekly");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeRangeDates, setTimeRangeDates] = useState(() => {
    const now = new Date();
    return {
      weekly: now,
      monthly: now,
      yearly: now,
    };
  });
  const [reportData, setReportData] = useState(null);
  const [dailyExpensesData, setDailyExpensesData] = useState(null);
  const [sourceShareData, setSourceShareData] = useState(null);
  const [trendPerSourceChartData, setTrendPerSourceChartData] = useState(null);
  const [trendPerSourceLegend, setTrendPerSourceLegend] = useState(null);
  const [topExpenses, setTopExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isCurrentPage = useRef(true);
  const [refreshTick, setRefreshTick] = useState(0);
  // Treat "all individually selected" as no filter to avoid excluding uncategorized/unknown sources
  const shouldFilter = selectedSources.length > 0 && selectedSources.length < (sources?.length || Infinity);

  useEffect(() => {
    // Set up visibility change listener for background data refresh
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isCurrentPage.current) {
        // Trigger a full rebuild of processed charts on resume
        setRefreshTick((x) => x + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Listen for global data refresh events
    const handleDataRefresh = () => {
      // Trigger a full rebuild of processed charts on data refresh events
      setRefreshTick((x) => x + 1);
    };
    window.addEventListener("dataRefreshNeeded", handleDataRefresh);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("dataRefreshNeeded", handleDataRefresh);
    };
  }, [timeRange, currentDate, t, formatDate]);

  const processReportData = (transactions, timeRange, startDate, endDate) => {
    // This is a placeholder. In a real application, you would have a robust function here to process the data.
    // For now, we'll just return the raw data.
    return {
      reportData: {
        summary: {
          total_income: 0,
          total_expenses: 0,
        },
        category: {
          labels: [],
          datasets: [
            {
              data: [],
            },
          ],
        },
        trend: {
          labels: [],
          datasets: [
            {
              data: [],
            },
          ],
        },
        monthly: {
          labels: [],
          datasets: [{ data: [] }, { data: [] }],
        },
      },
      dailyExpensesData: [],
    };
  };

  // Function to refresh data in the background - only when online
  const refreshReportsData = async () => {
    // Avoid setting raw API payloads which would blank charts; instead, trigger full reload
    setRefreshTick((x) => x + 1);
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

  // Function to get date range for API call
  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (timeRange === "weekly") {
      // Last 7 days including today (exactly 7 days)
      end.setDate(currentDate.getDate());
      start.setDate(currentDate.getDate() - 6);
    } else if (timeRange === "monthly") {
      // Set to start and end of month
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else if (timeRange === "yearly") {
      // Set to start and end of year
      start.setMonth(0);
      start.setDate(1);
      end.setMonth(11);
      end.setDate(31);
    }

    // Use consistent date formatting to avoid timezone issues
    // Format as YYYY-MM-DD in local time
    const startDateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const endDateStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    return {
      startDate: startDateStr,
      endDate: endDateStr,
    };
  };

  // Function to handle previous button click
  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (timeRange === "weekly") {
      newDate.setDate(newDate.getDate() - 7);
    } else if (timeRange === "monthly") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (timeRange === "yearly") {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setCurrentDate(newDate);
    setTimeRangeDates((prev) => ({
      ...prev,
      [timeRange]: newDate,
    }));
  };

  // Function to handle next button click
  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (timeRange === "weekly") {
      newDate.setDate(newDate.getDate() + 7);
    } else if (timeRange === "monthly") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (timeRange === "yearly") {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setCurrentDate(newDate);
    setTimeRangeDates((prev) => ({
      ...prev,
      [timeRange]: newDate,
    }));
  };

  // Function to get formatted date range for display
  const getFormattedDateRange = () => {
    const { startDate, endDate } = getDateRange();
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Format dates based on language and time range
    const locale = language === "de" ? "de-DE" : "en-US";

    if (timeRange === "monthly") {
      // Show month name and year (e.g., "Aug. 2025")
      const monthOptions = { month: "short", year: "numeric" };
      return start.toLocaleDateString(locale, monthOptions);
    } else if (timeRange === "yearly") {
      // Show just the year (e.g., "2025")
      return start.getFullYear().toString();
    } else {
      // Show full date range for weekly (e.g., "28.07.2025 - 03.08.2025")
      const options = { day: "2-digit", month: "2-digit", year: "numeric" };
      return `${start.toLocaleDateString(locale, options)} - ${end.toLocaleDateString(locale, options)}`;
    }
  };

  useEffect(() => {
    const loadReportData = async () => {
      try {
        if (!reportData) setLoading(true);
        // Fetch real data from the API
        const { startDate, endDate } = getDateRange();
        let res;

        // If sources are selected, we need to filter data differently
        if (shouldFilter) {
          // Get individual transactions and filter by sources
          try {
            const all = await offlineAPI.getAllTransactions();
            if (Array.isArray(all) && all.length > 0) {
              const start = new Date(startDate);
              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999);

              // Filter by date range first
              let filtered = all.filter((tx) => {
                if (!tx) return false;
                const d = new Date(tx.date);
                return d >= start && d <= end;
              });

              // Apply source filtering: expenses by source_id; incomes by target_name mapped to selected source names (case-insensitive)
              const selectedIdSet = new Set(selectedSources.map((id) => String(id)));
              const selectedNameSet = new Set(
                (sources || [])
                  .filter((s) => selectedIdSet.has(String(s.id)))
                  .map((s) => String(s.name || "").trim().toLowerCase())
              );
              filtered = filtered.filter((tx) => {
                const typ = String(tx.type || '').toLowerCase();
                if (typ === 'expense' || typ === 'income') {
                  // For BOTH Income and Expense, the User's Account is in source_id
                  // (Because AddTransaction swaps them for Income)
                  const sourceId = String(tx.source_id || tx.source || '');
                  return selectedIdSet.has(sourceId);
                }
                return false;
              });

              // Process filtered transactions to create API-like response structure
              res = { data: { data: processFilteredTransactions(filtered, timeRange, startDate, endDate) } };
            } else {
              // No transactions available, create empty response
              res = { data: { data: getEmptyReportData() } };
            }
          } catch (e) {
            console.warn("Reports: error processing filtered transactions", e?.message || e);
            if (!reportData) setLoading(false);
            return;
          }
        } else {
          // No source filtering, use regular API call
          try {
            res = await transactionAPI.getReportData({ startDate, endDate });
          } catch (e) {
            // If offline and no cached API response is available via service, keep previous state
            console.warn("Reports: using existing state due to offline/no cache", e?.message || e);
            if (!reportData) setLoading(false);
            return;
          }
        }

        // Process income vs expenses data based on time range
        let incomeExpensesLabels = [];
        let incomeData = [];
        let expensesData = [];

        if (timeRange === "weekly") {
          // For weekly, show daily income vs expenses for exactly 7 days including today
          const rawDailyExpenses = res.data.data.dailyExpenses || [];
          const dailyIncomeData = res.data.data.incomeByDate || [];

          // Fill last 7 days between startDate and endDate (inclusive)
          const dailyMap = new Map((rawDailyExpenses || []).map((d) => [d.date, parseFloat(d.total || 0)]));
          const filledDailyExpenses = (() => {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const out = [];
            const cur = new Date(start);
            while (cur <= end) {
              const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
              out.push({ date: key, total: dailyMap.get(key) || 0 });
              cur.setDate(cur.getDate() + 1);
            }
            return out;
          })();
          const dailyExpensesData = filledDailyExpenses;

          // Create a map of income by date for quick lookup with proper timezone handling
          const incomeByDateMap = {};
          dailyIncomeData.forEach((item) => {
            // Convert item.date to local time for consistent comparison
            const itemDate = new Date(item.date);
            // Convert to local date by adjusting for timezone offset
            const itemLocalDate = new Date(
              itemDate.getTime() - itemDate.getTimezoneOffset() * 60000,
            );
            const dateKey = `${itemLocalDate.getFullYear()}-${String(itemLocalDate.getMonth() + 1).padStart(2, "0")}-${String(itemLocalDate.getDate()).padStart(2, "0")}`;
            incomeByDateMap[dateKey] = parseFloat(item.total || 0);
          });

          incomeExpensesLabels = dailyExpensesData.map((item) =>
            formatShortWeekday(item.date),
          );
          incomeData = dailyExpensesData.map(
            (item) => incomeByDateMap[item.date] || 0,
          );
          expensesData = dailyExpensesData.map((item) =>
            parseFloat(item.total || 0),
          );
        } else if (timeRange === "monthly") {
          // For monthly, show weekly income vs expenses
          const dailyExpensesData = res.data.data.dailyExpenses || [];
          const dailyIncomeData = res.data.data.incomeByDate || [];

          // Create a map of income by date for quick lookup with proper timezone handling
          const incomeByDateMap = {};
          dailyIncomeData.forEach((item) => {
            // Convert item.date to local time for consistent comparison
            const itemDate = new Date(item.date);
            // Convert to local date by adjusting for timezone offset
            const itemLocalDate = new Date(
              itemDate.getTime() - itemDate.getTimezoneOffset() * 60000,
            );
            const dateKey = `${itemLocalDate.getFullYear()}-${String(itemLocalDate.getMonth() + 1).padStart(2, "0")}-${String(itemLocalDate.getDate()).padStart(2, "0")}`;
            incomeByDateMap[dateKey] = parseFloat(item.total || 0);
          });

          // Group by week (7 days) but ensure all data from the month is included
          const weeklyExpensesData = [];
          const weeklyIncomeData = [];
          // Use the same startDate that was used for the API call
          const dailyMonthStart = new Date(startDate);
          const dailyMonthEnd = new Date(endDate);
          // Set to end of day
          dailyMonthEnd.setHours(23, 59, 59, 999);

          // Create proper weeks for the month
          // Start from the beginning of the month and create weeks
          let currentWeekStart = new Date(dailyMonthStart);
          // Adjust to start of the week (Monday)
          const day = currentWeekStart.getDay();
          const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1);
          currentWeekStart.setDate(diff);

          // Keep track of which dates we've already included to avoid duplicates
          const includedExpenseDates = new Set();
          const includedIncomeDates = new Set();

          while (currentWeekStart <= dailyMonthEnd) {
            // Set to start of week (Monday)
            const weekStart = new Date(currentWeekStart);

            // End of week (Sunday)
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            // Set to end of day
            weekEnd.setHours(23, 59, 59, 999);

            // Filter expense data for this week, ensuring it's within the month
            // Ensure consistent date handling
            const weekExpensesData = dailyExpensesData.filter((item) => {
              // Convert item.date to local time for consistent comparison
              const itemDate = new Date(item.date);
              // Convert to local date by adjusting for timezone offset
              const itemLocalDate = new Date(
                itemDate.getTime() - itemDate.getTimezoneOffset() * 60000,
              );
              // Include data that is in this week AND in this month
              const isInWeekAndMonth =
                itemLocalDate >= weekStart &&
                itemLocalDate <= weekEnd &&
                itemLocalDate >= dailyMonthStart &&
                itemLocalDate <= dailyMonthEnd;
              // Check if we've already included this date
              const dateKey = item.date;
              if (isInWeekAndMonth && !includedExpenseDates.has(dateKey)) {
                includedExpenseDates.add(dateKey);
                return true;
              }
              return false;
            });

            // Filter income data for this week, ensuring it's within the month
            // Ensure consistent date handling
            const weekIncomeData = dailyIncomeData.filter((item) => {
              // Convert item.date to local time for consistent comparison
              const itemDate = new Date(item.date);
              // Convert to local date by adjusting for timezone offset
              const itemLocalDate = new Date(
                itemDate.getTime() - itemDate.getTimezoneOffset() * 60000,
              );
              // Include data that is in this week AND in this month
              const isInWeekAndMonth =
                itemLocalDate >= weekStart &&
                itemLocalDate <= weekEnd &&
                itemLocalDate >= dailyMonthStart &&
                itemLocalDate <= dailyMonthEnd;
              // Check if we've already included this date
              const dateKey = item.date;
              if (isInWeekAndMonth && !includedIncomeDates.has(dateKey)) {
                includedIncomeDates.add(dateKey);
                return true;
              }
              return false;
            });

            if (weekExpensesData.length > 0 || weekIncomeData.length > 0) {
              const weekExpensesTotal = weekExpensesData.reduce(
                (sum, day) => sum + parseFloat(day.total || 0),
                0,
              );
              const weekIncomeTotal = weekIncomeData.reduce(
                (sum, day) => sum + parseFloat(day.total || 0),
                0,
              );

              weeklyExpensesData.push({
                date: `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`,
                total: weekExpensesTotal,
              });

              weeklyIncomeData.push({
                date: `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`,
                total: weekIncomeTotal,
              });
            }

            // Move to next week
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
          }

          // Add any remaining data that wasn't included in the weekly grouping
          const remainingExpenseData = dailyExpensesData.filter((item) => {
            // Convert item.date to local time for consistent comparison
            const itemDate = new Date(item.date);
            // Convert to local date by adjusting for timezone offset
            const itemLocalDate = new Date(
              itemDate.getTime() - itemDate.getTimezoneOffset() * 60000,
            );
            return (
              itemLocalDate >= dailyMonthStart &&
              itemLocalDate <= dailyMonthEnd &&
              !includedExpenseDates.has(item.date)
            );
          });

          const remainingIncomeData = dailyIncomeData.filter((item) => {
            // Convert item.date to local time for consistent comparison
            const itemDate = new Date(item.date);
            // Convert to local date by adjusting for timezone offset
            const itemLocalDate = new Date(
              itemDate.getTime() - itemDate.getTimezoneOffset() * 60000,
            );
            return (
              itemLocalDate >= dailyMonthStart &&
              itemLocalDate <= dailyMonthEnd &&
              !includedIncomeDates.has(item.date)
            );
          });

          // If there's remaining data, add it to the last week or create a new week for it
          if (
            remainingExpenseData.length > 0 ||
            remainingIncomeData.length > 0
          ) {
            const remainingExpensesTotal = remainingExpenseData.reduce(
              (sum, day) => sum + parseFloat(day.total || 0),
              0,
            );
            const remainingIncomeTotal = remainingIncomeData.reduce(
              (sum, day) => sum + parseFloat(day.total || 0),
              0,
            );

            // If we have weekly data, add to the last week, otherwise create a new week
            if (weeklyExpensesData.length > 0) {
              weeklyExpensesData[weeklyExpensesData.length - 1].total +=
                remainingExpensesTotal;
              weeklyIncomeData[weeklyIncomeData.length - 1].total +=
                remainingIncomeTotal;
            } else {
              // Create a week for the remaining data
              const lastWeekStart = new Date(dailyMonthEnd);
              lastWeekStart.setDate(dailyMonthEnd.getDate() - 6);
              weeklyExpensesData.push({
                date: `${lastWeekStart.getFullYear()}-${String(lastWeekStart.getMonth() + 1).padStart(2, "0")}-${String(lastWeekStart.getDate()).padStart(2, "0")}`,
                total: remainingExpensesTotal,
              });
              weeklyIncomeData.push({
                date: `${lastWeekStart.getFullYear()}-${String(lastWeekStart.getMonth() + 1).padStart(2, "0")}-${String(lastWeekStart.getDate()).padStart(2, "0")}`,
                total: remainingIncomeTotal,
              });
            }
          }

          // Use CW/KW (Calendar Week) instead of "Week 1, Week 2"
          incomeExpensesLabels = weeklyExpensesData.map((item) => {
            const date = new Date(item.date);
            const weekNumber = getWeekNumber(date);
            return language === "de" ? `KW ${weekNumber}` : `CW ${weekNumber}`;
          });

          // Create a map of income by date for quick lookup in weekly data
          const weeklyIncomeByDateMap = {};
          weeklyIncomeData.forEach((item) => {
            weeklyIncomeByDateMap[item.date] = parseFloat(item.total || 0);
          });

          incomeData = weeklyIncomeData.map((item) =>
            parseFloat(item.total || 0),
          );
          expensesData = weeklyExpensesData.map((item) =>
            parseFloat(item.total || 0),
          );
        } else if (timeRange === "yearly") {
          // For yearly, show monthly income vs expenses
          const dailyExpensesData = res.data.data.dailyExpenses || [];
          const dailyIncomeData = res.data.data.incomeByDate || [];

          // Create a map of income by date for quick lookup with proper timezone handling
          const incomeByDateMap = {};
          dailyIncomeData.forEach((item) => {
            // Convert item.date to local time for consistent comparison
            const itemDate = new Date(item.date);
            // Convert to local date by adjusting for timezone offset
            const itemLocalDate = new Date(
              itemDate.getTime() - itemDate.getTimezoneOffset() * 60000,
            );
            const dateKey = `${itemLocalDate.getFullYear()}-${String(itemLocalDate.getMonth() + 1).padStart(2, "0")}-${String(itemLocalDate.getDate()).padStart(2, "0")}`;
            incomeByDateMap[dateKey] = parseFloat(item.total || 0);
          });

          // Group by month
          const monthlyExpensesData = [];
          const monthlyIncomeData = [];
          const start = new Date(startDate);
          const end = new Date(endDate);

          // Create data for each month in the year
          for (let month = 0; month < 12; month++) {
            const monthStart = new Date(start.getFullYear(), month, 1);
            const monthEnd = new Date(start.getFullYear(), month + 1, 0);
            // Set time to end of day for proper comparison
            monthEnd.setHours(23, 59, 59, 999);

            // Filter expense data for this month with proper timezone handling
            const monthExpensesData = dailyExpensesData.filter((item) => {
              // Convert item.date to local time for consistent comparison
              const itemDate = new Date(item.date);
              // Convert to local date by adjusting for timezone offset
              const itemLocalDate = new Date(
                itemDate.getTime() - itemDate.getTimezoneOffset() * 60000,
              );
              // Include data that is in this month
              return itemLocalDate >= monthStart && itemLocalDate <= monthEnd;
            });

            // Filter income data for this month with proper timezone handling
            const monthIncomeData = dailyIncomeData.filter((item) => {
              // Convert item.date to local time for consistent comparison
              const itemDate = new Date(item.date);
              // Convert to local date by adjusting for timezone offset
              const itemLocalDate = new Date(
                itemDate.getTime() - itemDate.getTimezoneOffset() * 60000,
              );
              // Include data that is in this month
              return itemLocalDate >= monthStart && itemLocalDate <= monthEnd;
            });

            // Always create data for each month to ensure all 12 months are represented
            const monthExpensesTotal = monthExpensesData.reduce(
              (sum, day) => sum + parseFloat(day.total || 0),
              0,
            );

            // Calculate month income total using the properly timezone-adjusted data
            let monthIncomeTotal = 0;
            // Process each day in the month for income data
            const currentDate = new Date(monthStart);
            while (currentDate <= monthEnd) {
              const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
              monthIncomeTotal += incomeByDateMap[dateKey] || 0;
              currentDate.setDate(currentDate.getDate() + 1);
            }

            monthlyExpensesData.push({
              date: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-01`,
              total: monthExpensesTotal,
            });

            monthlyIncomeData.push({
              date: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-01`,
              total: monthIncomeTotal,
            });
          }

          // Sort by date to ensure proper order
          monthlyExpensesData.sort(
            (a, b) => new Date(a.date) - new Date(b.date),
          );
          monthlyIncomeData.sort((a, b) => new Date(a.date) - new Date(b.date));

          incomeExpensesLabels = monthlyExpensesData.map((item) => {
            const date = new Date(item.date);
            return date.toLocaleDateString(
              language === "de" ? "de-DE" : "en-US",
              { month: "short" },
            );
          });
          incomeData = monthlyIncomeData.map((item) =>
            parseFloat(item.total || 0),
          );
          expensesData = monthlyExpensesData.map((item) =>
            parseFloat(item.total || 0),
          );
        }

        const processedMonthlyData = {
          labels: incomeExpensesLabels,
          datasets: [
            {
              label: t("income"),
              data: incomeData,
              backgroundColor: "rgba(52, 211, 153, 0.7)",
              borderColor: "rgba(52, 211, 153, 1)",
              borderWidth: 0,
              borderRadius: 6,
            },
            {
              label: t("expenses"),
              data: expensesData,
              backgroundColor: "rgba(248, 113, 113, 0.7)",
              borderColor: "rgba(248, 113, 113, 1)",
              borderWidth: 0,
              borderRadius: 6,
            },
          ],
        };

        // Process category data from real data
        const categoryLabels = res.data.data.expenseByCategory.map(
          (item) => item.category_name,
        );
        const categoryValues = res.data.data.expenseByCategory.map((item) =>
          parseFloat(item.total),
        );

        // Calculate total for percentage calculation
        const totalExpenses = categoryValues.reduce(
          (sum, value) => sum + value,
          0,
        );

        // Create labels without percentages (percentages are shown in chart segments)
        const processedCategoryData = {
          labels: categoryLabels,
          datasets: [
            {
              label: t("expensesByCategory"),
              data: categoryValues,
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
              hoverOffset: 12,
            },
          ],
        };

        // Process trend data to show actual balance or expenses trend based on income tracking setting
        let trendLabels = [];
        let trendValues = [];
        let trendLabel = t("balanceTrend");

        if (res.data.data.dailyExpenses) {
          // Process trend data based on time range
          let trendData = [];
          if (timeRange === "weekly") {
            // For weekly, show daily balance trend (exactly last 7 days)
            const rawTrendDaily = res.data.data.dailyExpenses || [];
            const map = new Map((rawTrendDaily || []).map((d) => [d.date, parseFloat(d.total || 0)]));
            const start = new Date(startDate);
            const end = new Date(endDate);
            const out = [];
            const cur = new Date(start);
            while (cur <= end) {
              const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
              out.push({ date: key, total: map.get(key) || 0 });
              cur.setDate(cur.getDate() + 1);
            }
            trendData = out;
          } else if (timeRange === "monthly") {
            // For monthly, we need to aggregate daily data into weeks
            const dailyData = res.data.data.dailyExpenses || [];
            // Group by week (7 days)
            const weeklyData = [];
            // Use the same startDate that was used for the API call
            const trendMonthStart = new Date(startDate);
            const trendMonthEnd = new Date(endDate);
            // Set to end of day
            trendMonthEnd.setHours(23, 59, 59, 999);

            // Create proper weeks for the month
            // Start from the beginning of the month and create weeks
            let currentWeekStart = new Date(trendMonthStart);
            // Adjust to start of the week (Monday)
            const day = currentWeekStart.getDay();
            const diff =
              currentWeekStart.getDate() - day + (day === 0 ? -6 : 1);
            currentWeekStart.setDate(diff);

            while (currentWeekStart <= trendMonthEnd) {
              // Set to start of week (Monday)
              const weekStart = new Date(currentWeekStart);

              // End of week (Sunday)
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6);
              // Set to end of day
              weekEnd.setHours(23, 59, 59, 999);

              // Filter data for this week, ensuring it's within the month
              // Ensure consistent date handling
              const weekData = dailyData.filter((item) => {
                // Convert item.date to local time for consistent comparison
                const itemDate = new Date(item.date);
                // Convert to local date by adjusting for timezone offset
                const itemLocalDate = new Date(
                  itemDate.getTime() - itemDate.getTimezoneOffset() * 60000,
                );
                // Include data that is in this week AND in this month
                return (
                  itemLocalDate >= weekStart &&
                  itemLocalDate <= weekEnd &&
                  itemLocalDate >= trendMonthStart &&
                  itemLocalDate <= trendMonthEnd
                );
              });

              if (weekData.length > 0) {
                const weekTotal = weekData.reduce(
                  (sum, day) => sum + parseFloat(day.total || 0),
                  0,
                );
                weeklyData.push({
                  date: `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`,
                  total: weekTotal,
                });
              }

              // Move to next week
              currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            }
            trendData = weeklyData;
          } else if (timeRange === "yearly") {
            // For yearly, we need to aggregate daily data into months
            const dailyData = res.data.data.dailyExpenses || [];
            // Group by month
            const monthlyData = [];
            const yearlyStart = new Date(startDate);
            const yearlyEnd = new Date(endDate);

            // Create data for each month in the year
            for (let month = 0; month < 12; month++) {
              const monthStart = new Date(yearlyStart.getFullYear(), month, 1);
              const monthEnd = new Date(
                yearlyStart.getFullYear(),
                month + 1,
                0,
              );
              // Set time to end of day for proper comparison
              monthEnd.setHours(23, 59, 59, 999);

              // Filter data for this month with proper timezone handling
              const monthData = dailyData.filter((item) => {
                // Convert item.date to local time for consistent comparison
                const itemDate = new Date(item.date);
                // Convert to local date by adjusting for timezone offset
                const itemLocalDate = new Date(
                  itemDate.getTime() - itemDate.getTimezoneOffset() * 60000,
                );
                // Include data that is in this month
                return itemLocalDate >= monthStart && itemLocalDate <= monthEnd;
              });

              // Always create data for each month to ensure all 12 months are represented
              const monthTotal = monthData.reduce(
                (sum, day) => sum + parseFloat(day.total || 0),
                0,
              );
              monthlyData.push({
                date: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-01`,
                total: monthTotal,
              });
            }
            // Sort by date to ensure proper order
            monthlyData.sort((a, b) => new Date(a.date) - new Date(b.date));
            trendData = monthlyData;
          }

          // Process data in chronological order
          const sortedData = [...trendData].sort(
            (a, b) => new Date(a.date) - new Date(b.date),
          );

          trendLabels = sortedData.map((item, index) => {
            const date = new Date(item.date);
            if (timeRange === "weekly") {
              return formatShortWeekday(item.date);
            } else if (timeRange === "monthly") {
              // Show week numbers (CW/KW)
              const weekNumber = getWeekNumber(date);
              return language === "de"
                ? `KW ${weekNumber}`
                : `CW ${weekNumber}`;
            } else if (timeRange === "yearly") {
              // Show month names
              return date.toLocaleDateString(
                language === "de" ? "de-DE" : "en-US",
                { month: "short" },
              );
            }
            return formatShortWeekday(item.date);
          });

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
            // Calculate cumulative balance based on the aggregated data with improved accuracy
            const totalIncome =
              parseFloat(res.data.data.summary?.total_income) || 0;
            const totalExpenses =
              parseFloat(res.data.data.summary?.total_expenses) || 0;
            const finalBalance = totalIncome - totalExpenses;

            // Calculate running balance with improved algorithm
            const balanceValues = [];
            // Calculate initial balance at the start of the period
            let initialBalance = finalBalance;
            for (let i = sortedData.length - 1; i >= 0; i--) {
              initialBalance += parseFloat(sortedData[i].total || 0);
            }

            // Work forwards through the data to calculate balance at end of each period
            let currentBalance = initialBalance;
            balanceValues.push(currentBalance); // Balance at start of period

            // Work forwards through the data (chronological order)
            for (let i = 0; i < sortedData.length; i++) {
              // Subtract this period's expenses to get the balance at the end of the period
              currentBalance -= parseFloat(sortedData[i].total || 0);
              // Add that balance to the array
              balanceValues.push(currentBalance);
            }

            trendValues = balanceValues;
          }
        }

        const processedTrendData = {
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

        // Only overwrite UI state when API returned meaningful data
        const apiHasData =
          res?.data?.data &&
          ((res.data.data.summary &&
            ((res.data.data.summary.total_income || 0) !== 0 ||
              (res.data.data.summary.total_expenses || 0) !== 0)) ||
            (Array.isArray(res.data.data.expenseByCategory) &&
              res.data.data.expenseByCategory.length > 0) ||
            (Array.isArray(res.data.data.dailyExpenses) &&
              res.data.data.dailyExpenses.length > 0) ||
            (Array.isArray(res.data.data.incomeByDate) &&
              res.data.data.incomeByDate.length > 0));

        if (apiHasData) {
          setReportData({
            monthly: processedMonthlyData,
            category: processedCategoryData,
            trend: processedTrendData,
            summary: res.data.data.summary,
          });
        } else {
          console.log(
            "API returned no meaningful report data; leaving existing report state intact.",
          );
        }

        // Process daily expenses data based on time range
        let processedDailyExpenses = [];
        console.log('Daily expenses processing:', {
          timeRange,
          selectedSources: selectedSources.length,
          rawDailyExpenses: res.data.data.dailyExpenses?.length || 0,
          startDate,
          endDate
        });
        if (timeRange === "weekly") {
          // For weekly, show daily expenses (exactly last 7 days)
          const rawDaily = res.data.data.dailyExpenses || [];
          const map = new Map((rawDaily || []).map((d) => [d.date, parseFloat(d.total || 0)]));
          const start = new Date(startDate);
          const end = new Date(endDate);
          const out = [];
          const cur = new Date(start);
          while (cur <= end) {
            const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
            out.push({ date: key, total: map.get(key) || 0 });
            cur.setDate(cur.getDate() + 1);
          }
          processedDailyExpenses = out;
          console.log('Weekly processing - final data points:', processedDailyExpenses.length, processedDailyExpenses.map(d => d.date));
        } else if (timeRange === "monthly") {
          // For monthly, aggregate daily data into weeks
          const dailyData = res.data.data.dailyExpenses || [];
          // Group by week (7 days)
          const weeklyData = [];
          // Use the same startDate that was used for the API call
          const monthlyMonthStart = new Date(startDate);
          const monthlyMonthEnd = new Date(endDate);
          // Set to end of day
          monthlyMonthEnd.setHours(23, 59, 59, 999);

          // Create proper weeks for the month
          // Start from the beginning of the month and create weeks
          let currentWeekStart = new Date(monthlyMonthStart);
          // Adjust to start of the week (Monday)
          const day = currentWeekStart.getDay();
          const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1);
          currentWeekStart.setDate(diff);

          while (currentWeekStart <= monthlyMonthEnd) {
            // Set to start of week (Monday)
            const weekStart = new Date(currentWeekStart);

            // End of week (Sunday)
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            // Set to end of day
            weekEnd.setHours(23, 59, 59, 999);

            // Filter data for this week, ensuring it's within the month
            // Ensure consistent date handling
            const weekData = dailyData.filter((item) => {
              // Convert item.date to local time for consistent comparison
              const itemDate = new Date(item.date);
              // Convert to local date by adjusting for timezone offset
              const itemLocalDate = new Date(
                itemDate.getTime() - itemDate.getTimezoneOffset() * 60000,
              );
              // Include data that is in this week AND in this month
              return (
                itemLocalDate >= weekStart &&
                itemLocalDate <= weekEnd &&
                itemLocalDate >= monthlyMonthStart &&
                itemLocalDate <= monthlyMonthEnd
              );
            });

            if (weekData.length > 0) {
              const weekTotal = weekData.reduce(
                (sum, day) => sum + parseFloat(day.total || 0),
                0,
              );
              weeklyData.push({
                date: `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`,
                total: weekTotal,
              });
            }

            // Move to next week
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
          }
          processedDailyExpenses = weeklyData;
        } else if (timeRange === "yearly") {
          // For yearly, aggregate daily data into months
          const dailyData = res.data.data.dailyExpenses || [];
          // Group by month
          const monthlyData = [];
          const yearlyStart = new Date(startDate);
          const yearlyEnd = new Date(endDate);

          // Create data for each month in the year
          for (let month = 0; month < 12; month++) {
            const monthStart = new Date(yearlyStart.getFullYear(), month, 1);
            const monthEnd = new Date(yearlyStart.getFullYear(), month + 1, 0);
            // Set time to end of day for proper comparison
            monthEnd.setHours(23, 59, 59, 999);

            // Filter data for this month with proper timezone handling
            const monthData = dailyData.filter((item) => {
              // Convert item.date to local time for consistent comparison
              const itemDate = new Date(item.date);
              // Convert to local date by adjusting for timezone offset
              const itemLocalDate = new Date(
                itemDate.getTime() - itemDate.getTimezoneOffset() * 60000,
              );
              // Include data that is in this month
              return itemLocalDate >= monthStart && itemLocalDate <= monthEnd;
            });

            // Always create data for each month to ensure all 12 months are represented
            const monthTotal = monthData.reduce(
              (sum, day) => sum + parseFloat(day.total || 0),
              0,
            );
            monthlyData.push({
              date: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-01`,
              total: monthTotal,
            });
          }
          // Sort by date to ensure proper order
          monthlyData.sort((a, b) => new Date(a.date) - new Date(b.date));
          processedDailyExpenses = monthlyData;
        }

        // Set processed daily expenses data
        setDailyExpensesData(processedDailyExpenses);

        // =============================
        // Trend per source (lines + legend), matching Dashboard behavior
        // =============================
        try {
          const all = await offlineAPI.getAllTransactions();
          if (Array.isArray(all) && all.length > 0) {
            const { startDate: sd, endDate: ed } = getDateRange();
            const start = new Date(sd);
            const end = new Date(ed);
            end.setHours(23, 59, 59, 999);

            // Build buckets based on timeRange
            const bucketStarts = [];
            const bucketEnds = [];
            const bucketLabels = [];

            if (timeRange === "weekly") {
              const cur = new Date(start);
              while (cur <= end) {
                const bs = new Date(cur);
                const be = new Date(cur);
                be.setHours(23, 59, 59, 999);
                bucketStarts.push(bs);
                bucketEnds.push(be);
                bucketLabels.push(`${bs.getFullYear()}-${String(bs.getMonth() + 1).padStart(2, '0')}-${String(bs.getDate()).padStart(2, '0')}`);
                cur.setDate(cur.getDate() + 1);
              }
            } else if (timeRange === "monthly") {
              // Weekly buckets (Mon-Sun) within month range
              let ws = new Date(start);
              const day = ws.getDay();
              const diff = ws.getDate() - day + (day === 0 ? -6 : 1);
              ws.setDate(diff);
              while (ws <= end) {
                const we = new Date(ws);
                we.setDate(ws.getDate() + 6);
                we.setHours(23, 59, 59, 999);
                bucketStarts.push(new Date(ws));
                bucketEnds.push(we);
                bucketLabels.push(`${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`);
                ws.setDate(ws.getDate() + 7);
              }
            } else {
              // yearly: monthly buckets for all 12 months of the year in range
              for (let m = 0; m < 12; m++) {
                const ms = new Date(start.getFullYear(), m, 1);
                const me = new Date(start.getFullYear(), m + 1, 0);
                me.setHours(23, 59, 59, 999);
                bucketStarts.push(ms);
                bucketEnds.push(me);
                bucketLabels.push(`${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, '0')}-01`);
              }
            }

            const bucketCount = bucketStarts.length;

            // Build source maps
            const bySrcExp = new Map(); // id -> number[buckets]
            const bySrcInc = new Map(); // id -> number[buckets]
            const nameToIds = new Map();
            (sources || []).forEach((s) => {
              const nm = String(s.name || "").trim().toLowerCase();
              if (!nameToIds.has(nm)) nameToIds.set(nm, []);
              nameToIds.get(nm).push(String(s.id));
            });

            const selectedSet = new Set((selectedSources || []).map((x) => String(x)));

            // Filter candidate transactions by range first
            const inRange = (all || []).filter((tx) => {
              const d = new Date(tx.date);
              return d >= start && d <= end;
            });

            inRange.forEach((tx) => {
              const d = new Date(tx.date);
              // Find bucket index
              let idx = -1;
              for (let i = 0; i < bucketCount; i++) {
                if (d >= bucketStarts[i] && d <= bucketEnds[i]) { idx = i; break; }
              }
              if (idx < 0) return;

              // Determine source id
              let sid = null;
              if (String(tx.type).toLowerCase() === 'expense') {
                sid = tx.source_id != null ? String(tx.source_id) : null;
              } else if (String(tx.type).toLowerCase() === 'income') {
                const tname = String(tx.target_name || '').trim().toLowerCase();
                const ids = nameToIds.get(tname) || [];
                if (ids.length > 0) {
                  sid = shouldFilter ? (ids.find((id) => selectedSet.has(id)) || ids[0]) : ids[0];
                }
              }
              if (!sid) return;

              if (String(tx.type).toLowerCase() === 'expense') {
                if (!bySrcExp.has(sid)) bySrcExp.set(sid, new Array(bucketCount).fill(0));
                bySrcExp.get(sid)[idx] += Number(tx.amount || 0);
              } else {
                if (!bySrcInc.has(sid)) bySrcInc.set(sid, new Array(bucketCount).fill(0));
                bySrcInc.get(sid)[idx] += Number(tx.amount || 0);
              }
            });

            const sourceTotals = [];
            const allIds = new Set([...bySrcExp.keys(), ...bySrcInc.keys()]);
            allIds.forEach((id) => {
              const e = bySrcExp.get(id) || new Array(bucketCount).fill(0);
              const inc = bySrcInc.get(id) || new Array(bucketCount).fill(0);
              const total = e.reduce((a, b) => a + b, 0) + inc.reduce((a, b) => a + b, 0);
              sourceTotals.push({ id, total });
            });
            sourceTotals.sort((a, b) => b.total - a.total);

            const palette = [
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

            const idToLabel = (id) => {
              const sObj = (sources || []).find((s) => String(s.id) === String(id));
              return sObj ? (sObj.displayName || sObj.name || `Source ${id}`) : `Source ${id}`;
            };

            const datasets = [];
            const idsToShow = shouldFilter
              ? sourceTotals.map((x) => x.id)
              : sourceTotals.slice(0, 5).map((x) => x.id);

            idsToShow.forEach((id, i) => {
              const e = (bySrcExp.get(id) || new Array(bucketCount).fill(0)).slice();
              const inc = (bySrcInc.get(id) || new Array(bucketCount).fill(0)).slice();
              let series = new Array(bucketCount).fill(0);
              if (isIncomeTrackingDisabled) {
                for (let k = 1; k < e.length; k++) e[k] += e[k - 1];
                series = e.map((v) => -v);
              } else {
                const net = e.map((v, idx) => (inc[idx] || 0) - v);
                for (let k = 1; k < net.length; k++) net[k] += net[k - 1];
                series = net;
              }
              datasets.push({
                label: idToLabel(id),
                data: series,
                borderColor: palette[i % palette.length],
                backgroundColor: palette[i % palette.length].replace(", 1)", ", 0.12)"),
                borderWidth: 2,
                tension: 0.35,
                pointRadius: 0,
              });
            });

            if (!shouldFilter && sourceTotals.length > 5) {
              const restIds = sourceTotals.slice(5).map((x) => x.id);
              const aggE = new Array(bucketCount).fill(0);
              const aggI = new Array(bucketCount).fill(0);
              restIds.forEach((id) => {
                const e = bySrcExp.get(id) || [];
                const inc = bySrcInc.get(id) || [];
                for (let i = 0; i < bucketCount; i++) {
                  aggE[i] += Number(e[i] || 0);
                  aggI[i] += Number(inc[i] || 0);
                }
              });
              let series = new Array(bucketCount).fill(0);
              if (isIncomeTrackingDisabled) {
                for (let k = 1; k < aggE.length; k++) aggE[k] += aggE[k - 1];
                series = aggE.map((v) => -v);
              } else {
                const net = aggE.map((v, idx) => (aggI[idx] || 0) - v);
                for (let k = 1; k < net.length; k++) net[k] += net[k - 1];
                series = net;
              }
              datasets.push({
                label: t("other"),
                data: series,
                borderColor: "rgba(107, 114, 128, 1)",
                backgroundColor: "rgba(107, 114, 128, 0.12)",
                borderWidth: 2,
                tension: 0.35,
                pointRadius: 0,
              });
            }

            // Build display labels for buckets
            let labelsForChart = [];
            if (timeRange === "weekly") {
              labelsForChart = bucketLabels.map((d) => formatShortWeekday(d));
            } else if (timeRange === "monthly") {
              labelsForChart = bucketStarts.map((ws) => {
                const weekNumber = getWeekNumber(ws);
                return language === "de" ? `KW ${weekNumber}` : `CW ${weekNumber}`;
              });
            } else {
              labelsForChart = bucketStarts.map((ms) => ms.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { month: 'short' }));
            }

            setTrendPerSourceChartData({ labels: labelsForChart, datasets });
            const legendItems = datasets.map((ds) => ({ label: ds.label, color: ds.borderColor, total: Array.isArray(ds.data) && ds.data.length > 0 ? ds.data[ds.data.length - 1] : 0 }));
            setTrendPerSourceLegend(legendItems);
          } else {
            setTrendPerSourceChartData(null);
            setTrendPerSourceLegend(null);
          }
        } catch (e) {
          console.warn("Reports: failed building per-source trend", e?.message || e);
        }

        // Additional visuals: Expenses by Source (share) and Largest Expenses for the selected range
        try {
          const all = await offlineAPI.getAllTransactions();
          if (Array.isArray(all) && all.length > 0) {
            // Filter to range and expenses only
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            let inRangeExpenses = all.filter((tx) => {
              if (!tx || tx.type !== "expense") return false;
              const d = new Date(tx.date);
              return d >= start && d <= end;
            });

            // Apply source filtering if sources are selected
            if (shouldFilter) {
              const selectedSourceIds = selectedSources.map(id => String(id));
              inRangeExpenses = inRangeExpenses.filter((tx) => {
                const sourceId = String(tx.source_id || tx.source || '');
                return selectedSourceIds.includes(sourceId);
              });
            }

            // Compute source shares by source_id
            const totalsById = new Map(); // id -> total
            inRangeExpenses.forEach((tx) => {
              const id = tx.source_id != null ? String(tx.source_id) : null;
              if (!id) return;
              totalsById.set(id, (totalsById.get(id) || 0) + Number(tx.amount || 0));
            });

            // Helper to map id -> display label
            const idToLabel = (id) => {
              const sObj = (sources || []).find((s) => String(s.id) === String(id));
              return sObj ? (sObj.displayName || sObj.name || `Source ${id}`) : `Source ${id}`;
            };

            let idsSorted = Array.from(totalsById.entries()).sort((a, b) => b[1] - a[1]).map(([id]) => id);
            let labels = [];
            let data = [];

            if (shouldFilter) {
              // Show ALL selected sources individually (no aggregation)
              const selectedSet = new Set((selectedSources || []).map((x) => String(x)));
              const filteredIds = idsSorted.filter((id) => selectedSet.has(String(id)));
              labels = filteredIds.map((id) => idToLabel(id));
              data = filteredIds.map((id) => totalsById.get(id) || 0);
            } else {
              // All sources: top 7 + Other
              const topIds = idsSorted.slice(0, 7);
              const restIds = idsSorted.slice(7);
              labels = topIds.map((id) => idToLabel(id));
              data = topIds.map((id) => totalsById.get(id) || 0);
              if (restIds.length > 0) {
                labels.push(t("other"));
                data.push(restIds.reduce((sum, id) => sum + (totalsById.get(id) || 0), 0));
              }
            }

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
            const border = [
              "rgba(248, 113, 113, 1)",
              "rgba(96, 165, 250, 1)",
              "rgba(251, 191, 36, 1)",
              "rgba(139, 92, 246, 1)",
              "rgba(16, 185, 129, 1)",
              "rgba(244, 114, 182, 1)",
              "rgba(209, 213, 219, 1)",
              "rgba(139, 69, 19, 1)",
            ];
            const paletteSize = Math.max(labels.length, 0);
            const dataSet = {
              labels,
              datasets: [
                {
                  data,
                  label: t("expensesBySource"),
                  radius: "85%",
                  backgroundColor: bg.slice(0, paletteSize),
                  borderColor: border.slice(0, paletteSize),
                  borderWidth: 1,
                  hoverOffset: 12,
                },
              ],
            };
            setSourceShareData(dataSet);

            // Largest expenses list (top 5)
            const topList = [...inRangeExpenses]
              .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
              .slice(0, 5);
            setTopExpenses(topList);
          } else {
            setSourceShareData(null);
            setTopExpenses([]);
          }
        } catch (e) {
          // Non-fatal
          console.warn("Reports: failed building source/large charts", e?.message || e);
        }

        if (!reportData) setLoading(false);
      } catch (err) {
        // When offline and no cache, don't block UI with an error; just keep prior data
        console.warn("Reports load error (likely offline):", err?.message || err);
        setLoading(false);
      }
    };

    loadReportData();
  }, [timeRange, currentDate, refreshTick, selectedSources]); // include selectedSources to reload when filter changes

  // Calculate total expenses for percentage calculation
  const totalExpenses =
    reportData?.category?.datasets?.[0]?.data?.reduce(
      (sum, value) => sum + value,
      0,
    ) || 0;

  if (loading) {
    return (
      <div className="container mx-auto px-4 pt-4 md:pt-0 pb-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="display-2">{t("reports")}</h1>
        </div>
      </div>
    );
  }

  // Error display removed - using toast notifications instead

  // Calculate savings rate
  const totalIncome = isIncomeTrackingDisabled
    ? 0
    : reportData?.summary?.total_income || 0;
  const totalExpensesValue = reportData?.summary?.total_expenses || 0;
  const netSavings = isIncomeTrackingDisabled
    ? -totalExpensesValue
    : totalIncome - totalExpensesValue;
  // Clamp savings rate to a lower limit of 0%
  const savingsRate = (() => {
    const raw = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
    return Math.max(0, raw).toFixed(1);
  })();

  return (
    <div className="container mx-auto px-4 pt-4 md:pt-0 pb-4 min-h-0">
      {/* ...existing report UI... */}
      <div className="flex flex-col md:flex-row md:justify-between mb-8 gap-4 min-h-[3rem]">
        <div className="flex items-center gap-4">
          <h1 className="display-2 leading-none">{t("reportsAndAnalytics")}</h1>
          <MultiCheckboxDropdown
            options={sources}
            selected={selectedSources}
            onChange={setSelectedSources}
            label={t("filterBySources")}
            allLabel={t("allSources")}
            id="reports-source-filter"
            useIcon={true}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <DateRangeToggle
              value={timeRange}
              onChange={(newRange) => {
                const newDate = timeRangeDates[newRange] || new Date();
                setCurrentDate(newDate);
                setTimeRange(newRange);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                // Remove haptic feedback - only notifications and "+" button should have haptic
                handlePrevious();
              }}
              className="relative w-14 h-14 p-3 md:w-auto md:h-auto md:p-2 rounded-lg overflow-hidden active:scale-95 transition-all duration-200 shadow-lg hover:shadow-xl"
              style={{
                background: `linear-gradient(to right, var(--accent-600), var(--accent))`,
              }}
              onMouseEnter={(e) => {
                e.target.style.background = `linear-gradient(to right, color-mix(in srgb, var(--accent-600) 80%, #000), var(--accent-600))`;
              }}
              onMouseLeave={(e) => {
                e.target.style.background = `linear-gradient(to right, var(--accent-600), var(--accent))`;
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
              <img
                src="/icons/back.svg"
                alt=""
                className="relative z-10 w-8 h-8 md:w-6 md:h-6 filter brightness-0 invert"
                style={{ pointerEvents: "none" }}
              />
            </button>

            <div className="flex-1 text-center text-gray-600 dark:text-gray-400 font-medium px-4 text-base truncate min-w-[250px]">
              {getFormattedDateRange()}
            </div>

            <button
              onClick={() => {
                // Remove haptic feedback - only notifications and "+" button should have haptic
                handleNext();
              }}
              className="relative w-14 h-14 p-3 md:w-auto md:h-auto md:p-2 rounded-lg overflow-hidden active:scale-95 transition-all duration-200 shadow-lg hover:shadow-xl"
              style={{
                background: `linear-gradient(to left, var(--accent-600), var(--accent))`,
              }}
              onMouseEnter={(e) => {
                e.target.style.background = `linear-gradient(to left, color-mix(in srgb, var(--accent-600) 80%, #000), var(--accent-600))`;
              }}
              onMouseLeave={(e) => {
                e.target.style.background = `linear-gradient(to left, var(--accent-600), var(--accent))`;
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-l from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
              <img
                src="/icons/forward.svg"
                alt=""
                className="relative z-10 w-8 h-8 md:w-6 md:h-6 filter brightness-0 invert"
                style={{ pointerEvents: "none" }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {reportData?.summary && (
        <SummaryCards
          summary={reportData.summary}
          timeRange={timeRange}
          startDate={getDateRange().startDate}
          endDate={getDateRange().endDate}
          dailyExpensesSeries={dailyExpensesData || []}
          incomeTrackingDisabled={isIncomeTrackingDisabled}
        />
      )}

      {/* Daily Expenses Chart */}
      <div className="card md:h-[250px] mb-8">
        <div className="card-body h-full flex flex-col min-h-0">
          <h3 className="text-xl font-semibold mb-6">
            {timeRange === "weekly"
              ? t("dailyExpenses")
              : timeRange === "monthly"
                ? t("weeklyExpenses")
                : t("monthlyExpenses")}
          </h3>
          <DailyExpensesChart startDate={getDateRange().startDate} endDate={getDateRange().endDate} timeRange={timeRange} />
        </div>
      </div>



      {/* Charts - Source Category Breakdown and Expenses by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Source Spending by Category */}
        <div className="card md:h-[370px]">
          <div className="card-body h-full flex flex-col min-h-0">
            <h2 className="text-xl font-semibold mb-6">{t("sourceCategoryBreakdown")}</h2>
            <SourceCategoryBarChart selectedSources={shouldFilter ? selectedSources : []} sources={sources} />
          </div>
        </div>
        {/* Expenses by Category */}
        <div className="card md:h-[370px]">
          <div className="card-body h-full flex flex-col min-h-0">
            <h3 className="text-xl font-semibold mb-6">{t("expensesByCategory")}</h3>
            {reportData?.category?.labels?.length > 0 ? (
              <>
                {/* Mobile: custom scrollable legend with amounts */}
                <div className="md:hidden">
                  <motion.div key={`category-chart-mobile-${timeRange}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="w-full h-44">
                    <Pie
                      data={reportData.category}
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
                  </motion.div>
                  <ChartLegend labels={reportData.category.labels} values={reportData.category.datasets?.[0]?.data} backgroundColor={reportData.category.datasets?.[0]?.backgroundColor} formatCurrency={formatCurrency} />
                </div>

                {/* Desktop: pie + custom right-side table legend */}
                <div className="hidden md:flex items-center gap-6 h-full flex-1">
                  <motion.div key={`category-chart-desktop-${timeRange}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex-[2] flex-1 h-full min-w-0 overflow-hidden p-2 flex items-center justify-center" style={{ minHeight: 0 }}>
                    <Pie
                      data={reportData.category}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: { padding: 12 },
                        radius: "100%",
                        plugins: {
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
                  </motion.div>

                  {/* Right-side table legend */}
                  <div className="w-52 max-h-[260px] overflow-y-auto pt-1 self-center scrollbar-thin-modern">
                    <table className="w-full text-sm">
                      <tbody>
                        {reportData.category.labels.map((label, idx) => {
                          const amount = Number(reportData.category.datasets?.[0]?.data?.[idx] || 0);
                          const bg = reportData.category.datasets?.[0]?.backgroundColor || [];
                          const color = bg[idx % bg.length] || "#999";
                          return (
                            <tr key={`${label}-${idx}`} className="h-9">
                              <td className="align-middle pr-3">
                                <div className="flex items-center min-w-0">
                                  <span className="inline-block h-2.5 w-2.5 rounded-full mr-3 flex-shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                                  <span className="text-gray-700 dark:text-gray-300 truncate">{label}</span>
                                </div>
                              </td>
                              <td className="text-right align-middle text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">{formatCurrency(amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <motion.div key={`category-empty-${timeRange}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="text-center py-8 text-gray-500">{t("noDataAvailable")}</motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Balance Trend */}
      <div className="card md:h-[370px] mb-8">
        <div className="card-body h-full flex flex-col min-h-0">
          <h3 className="text-xl font-semibold mb-6">{t("balanceTrend")}</h3>
          <PerSourceBalanceTrend startDate={getDateRange().startDate} endDate={getDateRange().endDate} timeRange={timeRange} selectedSources={selectedSources} sources={sources} incomeTrackingDisabled={isIncomeTrackingDisabled} />
        </div>
      </div>

      {/* Income vs Expenses Chart - Moved to bottom to match Dashboard order */}
      {/* Additional: Expenses by Source and Largest Expenses */}
      <div className="grid grid-cols-1 gap-8 mb-8">
        <div className="card md:h-[370px]">
          <div className="card-body h-full flex flex-col min-h-0">
            <h3 className="text-xl font-semibold mb-6">{t("expensesBySource")}</h3>
            <PerSourceExpensesTrend
              startDate={getDateRange().startDate}
              endDate={getDateRange().endDate}
              timeRange={timeRange}
              selectedSources={selectedSources}
              sources={sources}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h3 className="text-xl font-semibold mb-6">{t("largestExpenses")}</h3>
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("date")}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("description")}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("category")}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("amount")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {topExpenses.map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{formatDate(tx.date)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200 max-w-xs truncate">{tx.description || tx.category_name || tx.category || (t("uncategorized") || "Uncategorized")}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                            {tx.category_name ? (
                              <span className="badge badge-primary">{tx.category_name}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-red-600 dark:text-red-400">-{formatCurrency(Number(tx.amount || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">{t("noDataAvailable")}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
