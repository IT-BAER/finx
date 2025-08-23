import React from "react";
import { useTranslation } from "../hooks/useTranslation";

/**
 * DateRangeToggle
 * Reusable toggle group for selecting time ranges (weekly, monthly, yearly).
 *
 * Props:
 * - value: 'weekly' | 'monthly' | 'yearly'
 * - onChange: function(newValue)
 * - className: optional additional classes for the wrapper
 *
 * Accessibility:
 * - Buttons are rendered with aria-pressed and keyboard support (ArrowLeft / ArrowRight)
 *
 * Visuals:
 * - On small screens buttons become full-width and stacked, centered within their container.
 * - Active button uses theme-accent-bg to align with app theme variables.
 * - Inactive buttons use neutral surfaces and hover states consistent with the design system.
 */
const OPTIONS = [
  { key: "weekly", labelKey: "weekly" },
  { key: "monthly", labelKey: "monthly" },
  { key: "yearly", labelKey: "yearly" },
];

export default function DateRangeToggle({
  value = "weekly",
  onChange,
  className = "",
}) {
  const { t } = useTranslation();

  const handleKeyDown = (e, index) => {
    if (e.key === "ArrowRight") {
      const next = OPTIONS[(index + 1) % OPTIONS.length].key;
      onChange && onChange(next);
    } else if (e.key === "ArrowLeft") {
      const prev = OPTIONS[(index - 1 + OPTIONS.length) % OPTIONS.length].key;
      onChange && onChange(prev);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange && onChange(OPTIONS[index].key);
    }
  };

  return (
    <div
      className={`grid grid-cols-3 gap-2 w-full mx-auto ${className}`}
      role="tablist"
      aria-label={t("timeRange") || "Time range"}
    >
      {OPTIONS.map((opt, i) => {
        const isActive = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-pressed={isActive}
            aria-selected={isActive}
            onClick={() => onChange && onChange(opt.key)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`w-full rounded-lg shadow-sm px-3 h-10 flex items-center justify-center text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isActive
                ? "theme-accent-bg text-white font-medium"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            aria-label={t(opt.labelKey)}
          >
            {t(opt.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
