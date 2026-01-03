import React from "react";

// Small reusable legend used for mobile views to ensure consistency
export default function ChartLegend({ labels = [], values = [], backgroundColor = [], formatCurrency = (v) => v }) {
  // Fallback palette when chart dataset doesn't provide colors
  const fallback = [
    "rgba(255, 99, 132, 0.7)",
    "rgba(54, 162, 235, 0.7)",
    "rgba(255, 205, 86, 0.7)",
    "rgba(75, 192, 192, 0.7)",
    "rgba(153, 102, 255, 0.7)",
    "rgba(255, 159, 64, 0.7)",
    "rgba(199, 199, 199, 0.7)",
    "rgba(83, 102, 255, 0.7)",
  ];

  const getColor = (i) => (backgroundColor && backgroundColor[i]) || fallback[i % fallback.length];

  return (
    <div className="mt-4 w-full max-h-48 overflow-y-auto scrollbar-thin-modern divide-y divide-gray-800/20 dark:divide-gray-700">
      {labels.map((label, idx) => {
        const amount = Number(values?.[idx] || 0);
        const color = getColor(idx);
        return (
          <div key={`${label}-${idx}`} className="py-2 flex items-center justify-between h-9">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="text-sm text-gray-200 dark:text-gray-300 font-medium truncate">{label}</span>
            </div>
            <span className="text-sm text-gray-400 dark:text-gray-400 font-medium whitespace-nowrap">{formatCurrency(amount)}</span>
          </div>
        );
      })}
    </div>
  );
}
