import { useState, useEffect } from "react";
import { goalAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Card from "./Card";

export default function QuickGoalsCard({ className = "" }) {
  const { t, formatCurrency } = useTranslation();
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchGoals = async () => {
      try {
        setLoading(true);
        const response = await goalAPI.getAll(false);
        if (!cancelled) {
          const allGoals = response.data?.goals || [];
          const active = allGoals
            .filter(g => !g.is_completed)
            .sort((a, b) => {
              const pA = a.target_amount > 0 ? (a.current_amount / a.target_amount) : 0;
              const pB = b.target_amount > 0 ? (b.current_amount / b.target_amount) : 0;
              return pB - pA;
            })
            .slice(0, 3);
          setGoals(active);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch goals:", err);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchGoals();
    return () => { cancelled = true; };
  }, []);

  const emojiMap = {
    savings: "💰", vacation: "✈️", car: "🚗", house: "🏠",
    education: "🎓", emergency: "🛟", gift: "🎁", tech: "💻",
  };

  if (loading) {
    return (
      <Card variant="insight-card" className={className}>
        <div className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="insight-skeleton w-11 h-11" />
            <div className="flex-1 space-y-2">
              <div className="insight-skeleton h-3 w-28" />
              <div className="insight-skeleton h-3 w-16" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="insight-skeleton h-14 w-full" />
            <div className="insight-skeleton h-14 w-full" />
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

  if (goals.length === 0) return null;

  const daysUntilDeadline = (deadline) => {
    if (!deadline) return null;
    return Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
  };

  return (
    <Card variant="insight-card" className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3.5">
            <div className="insight-icon" style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {t("goalsProgress") || "Goals Progress"}
            </p>
          </div>
          <button
            onClick={() => navigate("/goals")}
            className="text-[11px] font-medium text-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
          >
            {t("viewAll") || "View All"} →
          </button>
        </div>

        {/* Goal items */}
        <div className="space-y-3">
          {goals.map((goal, i) => {
            const progress = goal.target_amount > 0
              ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
              : 0;
            const days = daysUntilDeadline(goal.deadline);
            const ringRadius = 18;
            const circumference = 2 * Math.PI * ringRadius;
            const ringOffset = circumference - (progress / 100) * circumference;
            const progressColor = progress >= 80 ? "#06b6d4" : progress >= 50 ? "#22d3ee" : "#67e8f9";

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {/* Progress ring with emoji */}
                <div className="relative shrink-0 flex items-center justify-center" style={{ width: 48, height: 48 }}>
                  <svg width="48" height="48" className="transform -rotate-90">
                    <circle cx="24" cy="24" r={ringRadius} fill="none" strokeWidth="3"
                      className="stroke-gray-200 dark:stroke-gray-700" />
                    <circle cx="24" cy="24" r={ringRadius} fill="none" strokeWidth="3"
                      stroke={progressColor} strokeLinecap="round"
                      strokeDasharray={circumference} strokeDashoffset={ringOffset}
                      className="progress-ring-circle" />
                  </svg>
                  <span className="absolute text-sm">{emojiMap[goal.icon] || "🎯"}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {goal.name}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                      {progress}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                    </span>
                    {days !== null && (
                      <span className={`text-[11px] ${days < 0 ? "text-red-500" : days < 30 ? "text-amber-500" : "text-gray-400 dark:text-gray-500"}`}>
                        {days < 0
                          ? `${Math.abs(days)} ${t("daysOverdue") || "days overdue"}`
                          : `${days}d`}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
