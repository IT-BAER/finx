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
import { transactionAPI } from "../services/api.jsx";
import { motion } from "framer-motion";

const Reports = () => {
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
  const [topExpenses, setTopExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { t, formatCurrency, formatDate, language } = useTranslation();
  const { isIncomeTrackingDisabled } = useAuth();
  const { dark } = useTheme();
  const isCurrentPage = useRef(true);

  useEffect(() => {
    // Set up visibility change listener for background data refresh
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isCurrentPage.current) {
        // Refresh data when page becomes visible
        refreshReportsData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Listen for global data refresh events
    const handleDataRefresh = () => {
      refreshReportsData();
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
    try {
      // Only refresh data when online
      const { getIsOnline } = await import("../services/connectivity.js");
      if (getIsOnline()) {
        const { startDate, endDate } = getDateRange();
        const allTransactions = await offlineAPI.getAllTransactions();

        // If offlineAPI returned nothing, skip updating to avoid zeroing UI
        if (!allTransactions || allTransactions.length === 0) {
          // No data to refresh; keep existing state
          return;
        }

        // Filter transactions for the date range
        const filteredTransactions = allTransactions.filter((tx) => {
          const txDate = new Date(tx.date);
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999); // Set to end of day
          return txDate >= start && txDate <= end;
        });

        // Process data for the report
        const processedData = processReportData(
          filteredTransactions,
          timeRange,
          startDate,
          endDate,
        );

        // Decide if processedData is meaningful before overwriting UI state.
        const hasMeaningfulReport =
          processedData &&
          processedData.reportData &&
          // summary totals not both zero
          ((processedData.reportData.summary?.total_income || 0) !== 0 ||
            (processedData.reportData.summary?.total_expenses || 0) !== 0 ||
            // or category data has non-zero entry
            processedData.reportData.category?.datasets?.[0]?.data?.some(
              (v) => v && v !== 0,
            ) ||
            // or trend labels exist
            processedData.reportData.trend?.labels?.length > 0 ||
            // or daily expenses data has entries
            (processedData.dailyExpensesData &&
              processedData.dailyExpensesData.length > 0));

        if (hasMeaningfulReport) {
          // Update state with new data
          setReportData(processedData.reportData);
          setDailyExpensesData(processedData.dailyExpensesData);
          if (!loading) {
            console.log("Reports data refreshed in background");
          }
        } else {
          // Do not overwrite existing data with empty/zero payload
          console.log(
            "Background refresh returned no meaningful data; keeping existing report state",
          );
        }
      }
    } catch (err) {
      console.error("Error refreshing reports data:", err);
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
        try {
          res = await transactionAPI.getReportData({ startDate, endDate });
        } catch (e) {
          // If offline and no cached API response is available via service, keep previous state
          console.warn("Reports: using existing state due to offline/no cache", e?.message || e);
          if (!reportData) setLoading(false);
          return;
        }

        // Process income vs expenses data based on time range
        let incomeExpensesLabels = [];
        let incomeData = [];
        let expensesData = [];

        if (timeRange === "weekly") {
          // For weekly, show daily income vs expenses for exactly 7 days including today
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
            // For weekly, show daily balance trend
            trendData = res.data.data.dailyExpenses || [];
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
        if (timeRange === "weekly") {
          // For weekly, show daily expenses
          processedDailyExpenses = res.data.data.dailyExpenses || [];
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

        // Additional visuals: Expenses by Source (share) and Largest Expenses for the selected range
        try {
          const all = await offlineAPI.getAllTransactions();
          if (Array.isArray(all) && all.length > 0) {
            // Filter to range and expenses only
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            const inRangeExpenses = all.filter((tx) => {
              if (!tx || tx.type !== "expense") return false;
              const d = new Date(tx.date);
              return d >= start && d <= end;
            });

            // Compute source shares (top 7 + Other)
            const totalsBySource = new Map();
            inRangeExpenses.forEach((tx) => {
              const name = (tx.source_name || "Other").trim() || "Other";
              totalsBySource.set(
                name,
                (totalsBySource.get(name) || 0) + Number(tx.amount || 0),
              );
            });
            const sorted = Array.from(totalsBySource.entries()).sort(
              (a, b) => b[1] - a[1],
            );
            const top = sorted.slice(0, 7);
            const rest = sorted.slice(7);
            let labels = top.map(([n]) => n);
            let data = top.map(([, v]) => v);
            if (rest.length > 0) {
              labels = [...labels, t("other")];
              data = [
                ...data,
                rest.reduce((sum, [, v]) => sum + v, 0),
              ];
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
  }, [timeRange, currentDate]); // Removed t and formatDate to prevent infinite re-renders

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
      <div className="flex flex-col md:flex-row md:justify-between mb-8 gap-4">
        <h1 className="display-2">{t("reportsAndAnalytics")}</h1>
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
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("totalIncome")}
                    </h3>
                    <motion.p
                      key={`income-value-${timeRange}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="text-xl font-bold text-green-600 dark:text-green-400"
                    >
                      {formatCurrency(reportData.summary.total_income || 0)}
                    </motion.p>
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
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t("totalExpenses")}
                  </h3>
                  <motion.p
                    key={`expenses-value-${timeRange}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-xl font-bold text-red-600 dark:text-red-400"
                  >
                    {formatCurrency(reportData.summary.total_expenses || 0)}
                  </motion.p>
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
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("netSavings")}
                    </h3>
                    <motion.p
                      key={`savings-value-${timeRange}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="text-xl font-bold text-purple-600 dark:text-purple-400"
                    >
                      {formatCurrency(
                        (reportData.summary.total_income || 0) -
                          (reportData.summary.total_expenses || 0),
                      )}
                    </motion.p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            className="card"
            style={{
              // Use theme accent for this card so Wednesday theme maps it to violet automatically
              borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
            }}
          >
            <div className="card-body">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 mr-4 savings-icon-chip">
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
                    ></path>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {isIncomeTrackingDisabled
                      ? `Ø ${t("dailyExpenses")}`
                      : t("savingsRate")}
                  </h3>
                  <motion.p
                    key={`rate-value-${timeRange}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-xl font-bold text-blue-600 dark:text-blue-400"
                  >
                    {isIncomeTrackingDisabled
                      ? dailyExpensesData?.length > 0
                        ? formatCurrency(
                            dailyExpensesData.reduce(
                              (sum, item) => sum + parseFloat(item.total || 0),
                              0,
                            ) /
                              (() => {
                                // Calculate actual number of days in the period
                                const { startDate, endDate } = getDateRange();
                                const start = new Date(startDate);
                                const end = new Date(endDate);
                                // Add 1 to include both start and end dates
                                const diffTime = Math.abs(end - start);
                                const diffDays =
                                  Math.ceil(diffTime / (1000 * 60 * 60 * 24)) +
                                  1;
                                return diffDays;
                              })(),
                          )
                        : formatCurrency(0)
                      : `${savingsRate}%`}
                  </motion.p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Expenses Chart */}
      <div className="card mb-8">
        <div className="card-body">
          <h3 className="text-xl font-semibold mb-6">
            {timeRange === "weekly"
              ? t("dailyExpenses")
              : timeRange === "monthly"
                ? t("weeklyExpenses")
                : t("monthlyExpenses")}
          </h3>
          {dailyExpensesData?.length > 0 ? (
            <motion.div
              key={`daily-expenses-chart-${timeRange}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="w-full"
              style={{ height: "auto", minHeight: 0 }}
            >
              <Bar
                data={{
                  labels: dailyExpensesData.map((item) => {
                    const date = new Date(item.date);
                    if (timeRange === "weekly") {
                      return formatShortWeekday(item.date);
                    } else if (timeRange === "monthly") {
                      const weekNumber = getWeekNumber(date);
                      return language === "de"
                        ? `KW ${weekNumber}`
                        : `CW ${weekNumber}`;
                    } else if (timeRange === "yearly") {
                      return date.toLocaleDateString(
                        language === "de" ? "de-DE" : "en-US",
                        { month: "short" },
                      );
                    }
                    return formatShortWeekday(item.date);
                  }),
                  datasets: [
                    {
                      label: t("expenses"),
                      data: dailyExpensesData.map((item) =>
                        parseFloat(item.total || 0),
                      ),
                      backgroundColor: "rgba(248, 113, 113, 0.7)",
                      borderColor: "rgba(248, 113, 113, 1)",
                      borderWidth: 2,
                      borderRadius: 6,
                    },
                  ],
                }}
                options={{
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
                      display: false,
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
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`daily-expenses-empty-${timeRange}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center py-8 text-gray-500"
            >
              {t("noDataAvailable")}
            </motion.div>
          )}
        </div>
      </div>

      {/* Charts - Expenses by Category and Balance Trend */}
      <div
        className={`grid grid-cols-1 ${isIncomeTrackingDisabled ? "lg:grid-cols-1" : "lg:grid-cols-2"} gap-8 mb-8`}
      >
        <div className="card">
          <div className="card-body">
            <h3 className="text-xl font-semibold mb-6">
              {t("expensesByCategory")}
            </h3>
            {reportData?.category?.labels?.length > 0 ? (
              <motion.div
                key={`category-chart-${timeRange}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full"
                style={{ height: "auto", minHeight: 0 }}
              >
                <Pie
                  data={reportData.category}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
            legend: {
                        position: "right",
                        labels: {
              color: dark ? "#ffffff" : "#374151", // Bright white for dark mode, darker gray for light mode
                          font: {
                            size: 12,
                            weight: "600",
                          },
                          usePointStyle: true,
                          boxWidth: 12,
                          padding: 15,
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
                          const total = context.dataset.data.reduce(
                            (acc, val) => acc + val,
                            0,
                          );
                          // Calculate percentage
                          const percentage =
                            total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                          // Only show percentage if it's above 5% to avoid clutter
                          return percentage > 5 ? `${percentage}%` : "";
                        },
                        anchor: "center",
                        align: "center",
                      },
                    },
                    cutout: "60%",
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`category-empty-${timeRange}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center py-8 text-gray-500"
              >
                {t("noDataAvailable")}
              </motion.div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h3 className="text-xl font-semibold mb-6">{t("balanceTrend")}</h3>
            {reportData?.trend?.labels?.length > 0 ? (
              <motion.div
                key={`trend-chart-${timeRange}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full"
                style={{ height: "auto", minHeight: 0 }}
              >
                <Line
                  data={reportData.trend}
                  options={{
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
                            const magnitude = Math.pow(
                              10,
                              Math.floor(Math.log10(roughStep)),
                            );
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
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`trend-empty-${timeRange}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center py-8 text-gray-500"
              >
                {t("noDataAvailable")}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Income vs Expenses Chart - Moved to bottom to match Dashboard order */}
      {/* Additional: Expenses by Source and Largest Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="card">
          <div className="card-body">
            <h3 className="text-xl font-semibold mb-6">{t("expensesBySource")}</h3>
            {sourceShareData && sourceShareData.labels?.length > 0 ? (
              <motion.div
                key={`source-share-${timeRange}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full"
                style={{ height: "auto", minHeight: 0 }}
              >
                <Pie
                  data={sourceShareData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "right",
                        labels: {
                          color: dark ? "#ffffff" : "#374151",
                          font: { size: 12, weight: "600" },
                          usePointStyle: true,
                          boxWidth: 12,
                          padding: 15,
                        },
                      },
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
                      },
                    },
                    cutout: "60%",
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`source-share-empty-${timeRange}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center py-8 text-gray-500"
              >
                {t("noDataAvailable")}
              </motion.div>
            )}
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
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200 max-w-xs truncate">{tx.description || "N/A"}</td>
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
      {!isIncomeTrackingDisabled && (
        <div className="card mb-8">
          <div className="card-body">
            <h3 className="text-xl font-semibold mb-6">
              {t("incomeVsExpenses")}
            </h3>
            {reportData?.monthly?.labels?.length > 0 ? (
              <motion.div
                key={`income-expenses-chart-${timeRange}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full"
                style={{ height: "auto", minHeight: 0 }}
              >
                <Bar
                  data={reportData.monthly}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "top",
                        labels: {
                          color: "#6b7280",
                          font: {
                            size: 12,
                          },
                        },
                      },
                      title: {
                        display: false,
                      },
                      datalabels: {
                        display: false,
                      },
                    },
                    scales: {
                      y: {
                        display: false,
                        beginAtZero: true,
                        grid: {
                          color: "rgba(0, 0, 0, 0.05)",
                        },
                        ticks: {
                          color: "#6b7280",
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
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`income-expenses-empty-${timeRange}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center py-8 text-gray-500"
              >
                {t("noDataAvailable")}
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
