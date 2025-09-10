import { useEffect, useState } from "react";
import offlineAPI from "../services/offlineAPI";
import { LazyBar as Bar } from "./LazyChart.jsx";
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
    <Bar
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: "top",
            labels: {
              font: {
                size: 12
              },
              color: dark ? "#d1d5db" : "#374151",
              usePointStyle: true,
              padding: 12
            }
          },
          title: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.parsed.y;
                const categoryIndex = context.dataIndex;
                const categoryTotal = categoryTotals[categoryIndex];
                const percentage = categoryTotal > 0 ? ((value / categoryTotal) * 100).toFixed(1) : 0;
                
                if (chartData.hasMultipleSources) {
                  return `${context.dataset.label}: ${formatCurrency(value)} (${percentage}%)`;
                }
                return `${context.dataset.label}: ${formatCurrency(value)}`;
              },
            },
          },
          datalabels: {
            display: chartData.hasMultipleSources,
            color: '#fff',
            font: {
              weight: 'bold',
              size: 9
            },
            formatter: function(value, context) {
              if (value === 0) return '';
              
              const categoryIndex = context.dataIndex;
              const categoryTotal = categoryTotals[categoryIndex];
              const percentage = categoryTotal > 0 ? ((value / categoryTotal) * 100).toFixed(0) : 0;
              
              // Only show percentage if it's 8% or more to avoid clutter
              return percentage >= 8 ? `${percentage}%` : '';
            },
            anchor: 'center',
            align: 'center',
            clip: true
          },
        },
        scales: {
          x: { 
            stacked: true,
            grid: {
              display: false,
            },
            ticks: {
              color: "#6b7280",
              maxRotation: 0,
              minRotation: 0,
              font: {
                size: 11
              },
              padding: 5,
              callback: function(value, index, ticks) {
                // Truncate long labels to fit better
                const label = this.getLabelForValue(value);
                return label.length > 8 ? label.substring(0, 8) + '...' : label;
              }
            },
            offset: true,
            categoryPercentage: 1.0,
            barPercentage: 0.9,
          },
          y: { 
            stacked: true, 
            beginAtZero: true,
            grid: {
              color: "rgba(0, 0, 0, 0.05)",
            },
            ticks: {
              color: "#6b7280",
              callback: function (value) {
                return formatCurrency(value);
              },
            },
          },
        },
      }}
    />
  );
}