import { useMemo } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { motion } from "framer-motion";

export default function SummaryCards({
  summary = { total_income: 0, total_expenses: 0 },
  timeRange,
  startDate,
  endDate,
  dailyExpensesSeries = [], // array of { date, total }
  incomeTrackingDisabled = false,
}) {
  const { t, formatCurrency } = useTranslation();

  const totalIncome = incomeTrackingDisabled ? 0 : (summary?.total_income || 0);
  const totalExpenses = summary?.total_expenses || 0;
  const netSavings = incomeTrackingDisabled ? -totalExpenses : totalIncome - totalExpenses;

  const averageDailyExpenses = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diffTime = Math.abs(e - s);
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const total = (dailyExpensesSeries || []).reduce((sum, item) => sum + (parseFloat(item.total || 0)), 0);
    return days > 0 ? total / days : 0;
  }, [startDate, endDate, dailyExpensesSeries]);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${incomeTrackingDisabled ? "lg:grid-cols-2" : "lg:grid-cols-4"} gap-6 mb-8`}>
      {!incomeTrackingDisabled && (
        <div className="card" style={{ borderColor: "rgba(52, 211, 153, 0.5)" }}>
          <div className="card-body">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 mr-4">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("totalIncome")}</h3>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(totalIncome)}
                </motion.p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ borderColor: "rgba(248, 113, 113, 0.5)" }}>
        <div className="card-body">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30 mr-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("totalExpenses")}</h3>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="text-xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(totalExpenses)}
              </motion.p>
            </div>
          </div>
        </div>
      </div>

      {!incomeTrackingDisabled && (
        <div className="card" style={{ borderColor: "rgba(168, 85, 247, 0.5)" }}>
          <div className="card-body">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 mr-4">
                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("netSavings")}</h3>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrency(netSavings)}
                </motion.p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ borderColor: "rgba(249, 115, 22, 0.5)" }}>
        <div className="card-body">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30 mr-4">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{`Ø ${t("dailyExpenses")}`}</h3>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(averageDailyExpenses)}
              </motion.p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

