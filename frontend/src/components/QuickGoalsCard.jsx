import { useState, useEffect } from "react";
import { goalAPI } from "../services/api.jsx";
import { useTranslation } from "../hooks/useTranslation";
import { AnimatedItem } from "./AnimatedPage.jsx";
import { useNavigate } from "react-router-dom";

import Card from "./Card";
/**
 * QuickGoalsCard - Mini progress indicators for top 3 active goals
 * Cyan/teal theme with progress rings
 */
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
        const response = await goalAPI.getAll(false); // exclude completed
        if (!cancelled) {
          const allGoals = response.data?.goals || [];
          // Take top 3 active goals sorted by progress (most progressed first)
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

  if (loading) {
    return (
      <AnimatedItem className={className}>
        <Card style={{ borderColor: "rgba(6, 182, 212, 0.5)" }}>
          <div className="card-body">
            <div className="animate-pulse">
              <div className="flex items-center mb-4">
                <div className="p-3 rounded-full bg-cyan-100 dark:bg-cyan-900/30 mr-4">
                  <div className="w-6 h-6 bg-cyan-200 dark:bg-cyan-800 rounded" />
                </div>
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-28" />
              </div>
              <div className="space-y-3">
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-full" />
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

  if (goals.length === 0) return null;

  const daysUntilDeadline = (deadline) => {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <AnimatedItem className={className}>
      <Card style={{ borderColor: "rgba(6, 182, 212, 0.5)" }}>
        <div className="card-body">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-cyan-100 dark:bg-cyan-900/30 mr-4">
                <svg
                  className="w-6 h-6 text-cyan-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t("goalsProgress") || "Goals Progress"}
              </h3>
            </div>
            <button
              onClick={() => navigate("/goals")}
              className="text-xs text-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium"
            >
              {t("viewAll") || "View All"}
            </button>
          </div>

          {/* Goal Items */}
          <div className="space-y-3">
            {goals.map((goal) => {
              const progress = goal.target_amount > 0
                ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
                : 0;
              const days = daysUntilDeadline(goal.deadline);
              const barColor = progress >= 80 ? "bg-cyan-500" : progress >= 50 ? "bg-cyan-400" : "bg-cyan-300";

              return (
                <div key={goal.id} className="flex items-center gap-3">
                  {/* Icon circle */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: (goal.color || "#06b6d4") + "20", color: goal.color || "#06b6d4" }}
                  >
                    {goal.icon === "savings" ? "💰" :
                     goal.icon === "vacation" ? "✈️" :
                     goal.icon === "car" ? "🚗" :
                     goal.icon === "house" ? "🏠" :
                     goal.icon === "education" ? "🎓" :
                     goal.icon === "emergency" ? "🛟" :
                     goal.icon === "gift" ? "🎁" :
                     goal.icon === "tech" ? "💻" : "🎯"}
                  </div>

                  {/* Goal info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {goal.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                        {progress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                      </span>
                      {days !== null && (
                        <span className={`text-xs ${days < 0 ? "text-red-500" : days < 30 ? "text-yellow-500" : "text-gray-400 dark:text-gray-500"}`}>
                          {days < 0
                            ? `${Math.abs(days)} ${t("daysOverdue") || "days overdue"}`
                            : `${days} ${t("daysLeft") || "days left"}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </AnimatedItem>
  );
}
