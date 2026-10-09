import React from "react";
import { CATEGORY_RAMP } from "../utils/categoryColors";

// Small reusable legend used for mobile views to ensure consistency
export default function ChartLegend({ labels = [], values = [], backgroundColor = [], formatCurrency = (v) => v }) {
  const getColor = (i) => (backgroundColor && backgroundColor[i]) || CATEGORY_RAMP[i % CATEGORY_RAMP.length];

  return (
    <div className="mt-4 w-full max-h-48 overflow-y-auto scrollbar-thin-modern divide-y divide-line/20">
      {labels.map((label, idx) => {
        const amount = Number(values?.[idx] || 0);
        const color = getColor(idx);
        return (
          <div key={`${label}-${idx}`} className="py-2 flex items-center justify-between h-9">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="inline-block h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="text-sm text-app font-medium truncate">{label}</span>
            </div>
            <span className="text-sm text-muted font-medium whitespace-nowrap">{formatCurrency(amount)}</span>
          </div>
        );
      })}
    </div>
  );
}
