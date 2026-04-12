import { useTranslation } from "../hooks/useTranslation";
import { motion } from "framer-motion";
import { AnimatedStagger, AnimatedItem } from "./AnimatedPage";
import Card from "./Card";

export default function SummaryCards({
  totalIncome = 0,
  totalExpenses = 0,
  netSavings = 0,
  averageExpense = 0,
  averageLabel,
  incomeTrackingDisabled = false,
}) {
  const { t, formatCurrency } = useTranslation();

  const avgLabel = averageLabel || t("dailyExpenses");

  return (
    <AnimatedStagger 
      className={`grid grid-cols-2 ${incomeTrackingDisabled ? "md:grid-cols-2" : "md:grid-cols-4"} gap-3 md:gap-4 mb-6`}
      staggerDelay={0.08}
      initialDelay={0}
    >
      {!incomeTrackingDisabled && (
        <AnimatedItem>
        <Card style={{ borderColor: "rgba(52, 211, 153, 0.18)", borderRadius: "2.5rem" }}>
          <div className="md:px-4 md:py-3">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30 mr-3">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{t("totalIncome")}</h3>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="text-base font-semibold text-green-600 dark:text-green-400 truncate">
                  {formatCurrency(totalIncome)}
                </motion.p>
              </div>
            </div>
          </div>
        </Card>
        </AnimatedItem>
      )}

      <AnimatedItem>
      <Card style={{ borderColor: "rgba(248, 113, 113, 0.18)", borderRadius: "2.5rem" }}>
        <div className="md:px-4 md:py-3">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 mr-3">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{t("totalExpenses")}</h3>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="text-base font-semibold text-red-600 dark:text-red-400 truncate">
                {formatCurrency(totalExpenses)}
              </motion.p>
            </div>
          </div>
        </div>
      </Card>
      </AnimatedItem>

      {!incomeTrackingDisabled && (
        <AnimatedItem>
        <Card style={{ borderColor: "rgba(168, 85, 247, 0.18)", borderRadius: "2.5rem" }}>
          <div className="md:px-4 md:py-3">
            <div className="flex items-center">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30 mr-3">
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{t("netSavings")}</h3>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="text-base font-semibold text-purple-600 dark:text-purple-400 truncate">
                  {formatCurrency(netSavings)}
                </motion.p>
              </div>
            </div>
          </div>
        </Card>
        </AnimatedItem>
      )}

      <AnimatedItem>
      <Card style={{ borderColor: "rgba(249, 115, 22, 0.18)", borderRadius: "2.5rem" }}>
        <div className="md:px-4 md:py-3">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30 mr-3">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{`Ø ${avgLabel}`}</h3>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="text-base font-semibold text-orange-600 dark:text-orange-400 truncate">
                {formatCurrency(averageExpense)}
              </motion.p>
            </div>
          </div>
        </div>
      </Card>
      </AnimatedItem>
    </AnimatedStagger>
  );
}

