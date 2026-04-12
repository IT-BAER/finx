import { useEffect, useState } from "react";
import offlineAPI from "../services/offlineAPI";
import AnimatedBarChart from "./AnimatedBarChart.jsx";
import { useTranslation } from "../hooks/useTranslation";
import { useTheme } from "../contexts/ThemeContext.jsx";

export default function SourceCategoryBarChart({ selectedSources, sources }) {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { formatCurrency } = useTranslation();
  const { dark } = useTheme();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const all = await offlineAPI.getAllTransactions();
      let filtered = all || [];
      
      if (selectedSources.length > 0) {
        // Convert selectedSources to strings for consistent comparison
        const selectedSourceIds = selectedSources.map(id => String(id));
        filtered = filtered.filter((tx) => {
          const sourceId = String(tx.source_id || tx.source || '');
          return selectedSourceIds.includes(sourceId);
        });
      }
      
      // Create a map of source IDs to display names for better labeling
      const sourceDisplayMap = new Map();
      if (sources && Array.isArray(sources)) {
        sources.forEach(source => {
          sourceDisplayMap.set(String(source.id), source.displayName || source.name);
        });
      }
      
      // Group by category, then by source and calculate totals
      const categoryMap = new Map(); // category -> { source -> total }
      const categoryTotals = new Map(); // category -> total amount
      
      filtered.forEach((tx) => {
        if (tx.type !== "expense") return;
        const cat = tx.category_name || tx.category || "Uncategorized";
        
        // Use display name if available, otherwise fall back to source_name
        const sourceId = String(tx.source_id || '');
        const sourceName = tx.source_name || tx.source || "Other";
        const src = sourceDisplayMap.get(sourceId) || sourceName;
        
        const amount = Number(tx.amount || 0);
        
        if (!categoryMap.has(cat)) categoryMap.set(cat, {});
        categoryMap.get(cat)[src] = (categoryMap.get(cat)[src] || 0) + amount;
        categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + amount);
      });
      
      // Get top 5 categories by total spending
      const topCategories = Array.from(categoryTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat]) => cat);
      
      // Get top sources for these categories
      const sourceSet = new Set();
      topCategories.forEach(cat => {
        if (categoryMap.has(cat)) {
          Object.keys(categoryMap.get(cat)).forEach(src => sourceSet.add(src));
        }
      });
      const sourceNames = Array.from(sourceSet).slice(0, 5); // Limit to top 5 sources
      
      const palette = [
        "rgba(96, 165, 250, 0.8)", // blue
        "rgba(248, 113, 113, 0.8)", // red
        "rgba(52, 211, 153, 0.8)", // green
        "rgba(251, 191, 36, 0.8)",  // amber
        "rgba(139, 92, 246, 0.8)",  // purple
      ];

      const borderPalette = [
        "rgba(96, 165, 250, 1)", // blue
        "rgba(248, 113, 113, 1)", // red
        "rgba(52, 211, 153, 1)", // green
        "rgba(251, 191, 36, 1)",  // amber
        "rgba(139, 92, 246, 1)",  // purple
      ];
      
      const datasets = sourceNames.map((src, i) => ({
        label: src,
        data: topCategories.map((cat) => categoryMap.get(cat)?.[src] || 0),
        backgroundColor: palette[i % palette.length],
        borderColor: borderPalette[i % borderPalette.length],
        borderWidth: 1,
        stack: "sources",
      }));
      
      const hasMultipleSources = sourceNames.length > 1;
      
      setChartData({ labels: topCategories, datasets, hasMultipleSources });
      setLoading(false);
    })();
  }, [selectedSources, sources]);

  if (loading || !chartData) {
    return (
      <div style={{ minHeight: 180 }} className="flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  // Calculate category totals for percentage calculation
  const categoryTotals = chartData.labels.map(label => {
    return chartData.datasets.reduce((sum, dataset, datasetIndex) => {
      return sum + (dataset.data[chartData.labels.indexOf(label)] || 0);
    }, 0);
  });

  return (
    <AnimatedBarChart
      labels={chartData.labels}
      datasets={chartData.datasets.map((ds) => ({
        label: ds.label,
        data: ds.data,
      }))}
      stacked={true}
      showLegend={chartData.hasMultipleSources}
      formatValue={formatCurrency}
    />
  );
}