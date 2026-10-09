import { useTranslation } from "../hooks/useTranslation";
import { motion } from "framer-motion";
import { AnimatedStagger, AnimatedItem } from "./AnimatedPage";
import Card from "./Card";

export const COIN =
  "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
export const BARS =
  "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z";
export const TARGET = "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z";
export const FLAG = "M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 2H21l-3 6 3 6h-8.5l-1-2H5a2 2 0 00-2 2z";

// Static, so Tailwind's content scanner can see every class it must generate.
const TONE = {
  ok: "text-ok-ink",
  bad: "text-bad-ink",
  accent: "text-accent-ink",
  warn: "text-warn-ink",
  neutral: "text-app",
};

// One KPI tile shape for dashboard, reports and goals. Each tile:
// { key, label, value (string|node), tone, icon (svg path d) }.
export function KpiTiles({ tiles, gridClass = "grid-cols-2 md:grid-cols-4" }) {
  return (
    <AnimatedStagger className={`grid ${gridClass} gap-3 md:gap-4 mb-6`} staggerDelay={0.08} initialDelay={0}>
      {tiles.map((tile) => {
        const tone = TONE[tile.tone] || TONE.neutral;
        return (
          <AnimatedItem key={tile.key}>
            <Card>
              <div className="md:px-4 md:py-3">
                <div className="flex items-center">
                  <div className={`p-2 rounded-full mr-3 tone-chip ${tone}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tile.icon} />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-medium text-muted truncate">{tile.label}</h3>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className={`text-base font-semibold truncate ${tone}`}
                    >
                      {tile.value}
                    </motion.p>
                  </div>
                </div>
              </div>
            </Card>
          </AnimatedItem>
        );
      })}
    </AnimatedStagger>
  );
}

export default function SummaryCards({
  totalIncome = 0,
  totalExpenses = 0,
  netSavings = 0,
  averageExpense = 0,
  averageLabel,
  incomeTrackingDisabled = false,
}) {
  const { t, formatCurrency } = useTranslation();

  const tiles = [
    { key: "income", label: t("totalIncome"), value: formatCurrency(totalIncome), tone: "ok", icon: COIN, incomeOnly: true },
    { key: "expenses", label: t("totalExpenses"), value: formatCurrency(totalExpenses), tone: "bad", icon: COIN },
    { key: "net", label: t("netSavings"), value: formatCurrency(netSavings), tone: "accent", icon: COIN, incomeOnly: true },
    { key: "avg", label: `Ø ${averageLabel || t("dailyExpenses")}`, value: formatCurrency(averageExpense), tone: "warn", icon: BARS },
  ].filter((tile) => !(incomeTrackingDisabled && tile.incomeOnly));

  return (
    <KpiTiles
      tiles={tiles}
      gridClass={incomeTrackingDisabled ? "grid-cols-2 md:grid-cols-2" : "grid-cols-2 md:grid-cols-4"}
    />
  );
}
