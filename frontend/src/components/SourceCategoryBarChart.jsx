import { useEffect, useState } from "react";
import offlineAPI from "../services/offlineAPI";
import { LazyBar as Bar } from "./LazyChart.jsx";

export default function SourceCategoryBarChart({ selectedSources, sources }) {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const all = await offlineAPI.getAllTransactions();
      let filtered = all || [];
      if (selectedSources.length > 0) {
        filtered = filtered.filter((tx) => selectedSources.includes(tx.source_id || tx.source));
      }
      // Group by category, then by source
      const categoryMap = new Map(); // category -> { source -> total }
      filtered.forEach((tx) => {
        if (tx.type !== "expense") return;
        const cat = tx.category_name || tx.category || "Uncategorized";
        const src = tx.source_name || tx.source || "Other";
        if (!categoryMap.has(cat)) categoryMap.set(cat, {});
        categoryMap.get(cat)[src] = (categoryMap.get(cat)[src] || 0) + Number(tx.amount || 0);
      });
      // Build chart.js data
      const categories = Array.from(categoryMap.keys());
      // Get all sources present in filtered data
      const sourceNames = Array.from(new Set(filtered.map((tx) => tx.source_name || tx.source || "Other")));
      const palette = [
        "rgba(96, 165, 250, 1)", // blue
        "rgba(248, 113, 113, 1)", // red
        "rgba(52, 211, 153, 1)", // green
        "rgba(251, 191, 36, 1)",  // amber
        "rgba(139, 92, 246, 1)",  // purple
        "rgba(16, 185, 129, 1)",  // teal
        "rgba(244, 114, 182, 1)", // pink
        "rgba(209, 213, 219, 1)", // gray
      ];
      const datasets = sourceNames.map((src, i) => ({
        label: src,
        data: categories.map((cat) => categoryMap.get(cat)[src] || 0),
        backgroundColor: palette[i % palette.length],
        stack: "sources",
      }));
      setChartData({ labels: categories, datasets });
      setLoading(false);
    })();
  }, [selectedSources, sources]);
  if (loading || !chartData) return <div style={{ minHeight: 180 }} className="flex items-center justify-center text-gray-400">Loading...</div>;
  return (
    <Bar
      data={chartData}
      options={{
        responsive: true,
        plugins: {
          legend: { position: "top" },
          title: { display: false },
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true },
        },
      }}
      style={{ minHeight: 260 }}
    />
  );
}