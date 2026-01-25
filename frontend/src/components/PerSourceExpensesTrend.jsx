import { useEffect, useMemo, useState } from "react";
import offlineAPI from "../services/offlineAPI";
import { LazyLine as Line } from "./LazyChart.jsx";
import ChartLegend from "./ChartLegend.jsx";
import { useTranslation } from "../hooks/useTranslation";
import { getLocaleString } from "../utils/locale";

function toDate(value) {
  if (typeof value === "string" && /\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.split("-").map((v) => parseInt(v, 10));
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

export default function PerSourceExpensesTrend({
  startDate,
  endDate,
  timeRange, // 'weekly' | 'monthly' | 'yearly'
  selectedSources = [],
  sources = [],
}) {
  const { t, formatCurrency, language } = useTranslation();
  const [chartData, setChartData] = useState(null);
  const [legend, setLegend] = useState([]);
  const locale = getLocaleString(language);

  const shouldFilter = useMemo(() => {
    return selectedSources.length > 0 && selectedSources.length < (sources?.length || Infinity);
  }, [selectedSources, sources]);

  // Helpers
  const formatShortWeekday = (dateStr) => {
    const dateObj = toDate(dateStr);
    const weekday = dateObj.toLocaleDateString(locale, { weekday: "short" });
    return weekday.replace(/\.$/, "");
  };
  const getWeekNumber = (dateObj) => {
    const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  };

  useEffect(() => {
    (async () => {
      try {
        const all = await offlineAPI.getAllTransactions();
        const start = toDate(startDate);
        const end = toDate(endDate);
        end.setHours(23, 59, 59, 999);

        // Build buckets
        const bucketStarts = [];
        const bucketEnds = [];
        const bucketLabels = [];

        if (timeRange === "weekly") {
          const cur = new Date(start);
          while (cur <= end) {
            const bs = new Date(cur);
            const be = new Date(cur);
            be.setHours(23, 59, 59, 999);
            bucketStarts.push(bs);
            bucketEnds.push(be);
            bucketLabels.push(`${bs.getFullYear()}-${String(bs.getMonth() + 1).padStart(2, "0")}-${String(bs.getDate()).padStart(2, "0")}`);
            cur.setDate(cur.getDate() + 1);
          }
        } else if (timeRange === "monthly") {
          // daily buckets across the whole month
          const cur = new Date(start);
          while (cur <= end) {
            const bs = new Date(cur);
            const be = new Date(cur);
            be.setHours(23, 59, 59, 999);
            bucketStarts.push(bs);
            bucketEnds.push(be);
            bucketLabels.push(`${bs.getFullYear()}-${String(bs.getMonth() + 1).padStart(2, "0")}-${String(bs.getDate()).padStart(2, "0")}`);
            cur.setDate(cur.getDate() + 1);
          }
        } else {
          // yearly -> monthly buckets for the year range
          const year = start.getFullYear();
          for (let m = 0; m < 12; m++) {
            const bs = new Date(year, m, 1);
            const be = new Date(year, m + 1, 0);
            be.setHours(23, 59, 59, 999);
            bucketStarts.push(bs);
            bucketEnds.push(be);
            bucketLabels.push(`${bs.getFullYear()}-${String(bs.getMonth() + 1).padStart(2, "0")}-01`);
          }
        }
        const bucketCount = bucketStarts.length;

        // Filter transactions in range and type expense
        let expenses = (all || []).filter((tx) => tx && String(tx.type).toLowerCase() === "expense");
        expenses = expenses.filter((tx) => {
          const d = new Date(tx.date);
          return d >= start && d <= end;
        });

        // Apply source filtering
        if (shouldFilter) {
          const selectedSet = new Set((selectedSources || []).map((x) => String(x)));
          expenses = expenses.filter((tx) => selectedSet.has(String(tx.source_id ?? tx.source ?? "")));
        }

        // Group amounts per source id per bucket
        const bySrc = new Map(); // id -> number[buckets]
        expenses.forEach((tx) => {
          const sid = tx.source_id != null ? String(tx.source_id) : null;
          if (!sid) return;
          const d = new Date(tx.date);
          let idx = -1;
          for (let i = 0; i < bucketCount; i++) {
            if (d >= bucketStarts[i] && d <= bucketEnds[i]) { idx = i; break; }
          }
          if (idx < 0) return;
          if (!bySrc.has(sid)) bySrc.set(sid, new Array(bucketCount).fill(0));
          bySrc.get(sid)[idx] += Number(tx.amount || 0);
        });

        // Determine which ids to show
        const totals = Array.from(bySrc.entries()).map(([id, arr]) => ({ id, total: (arr || []).reduce((a, b) => a + b, 0) }));
        totals.sort((a, b) => b.total - a.total);

        const idsToShow = shouldFilter ? totals.map((x) => x.id) : totals.slice(0, 5).map((x) => x.id);
        const palette = [
          "rgba(96, 165, 250, 1)",
          "rgba(248, 113, 113, 1)",
          "rgba(52, 211, 153, 1)",
          "rgba(251, 191, 36, 1)",
          "rgba(139, 92, 246, 1)",
          "rgba(16, 185, 129, 1)",
          "rgba(244, 114, 182, 1)",
          "rgba(209, 213, 219, 1)",
          "rgba(59, 130, 246, 1)",
          "rgba(234, 179, 8, 1)",
        ];

        const idToLabel = (id) => {
          const sObj = (sources || []).find((s) => String(s.id) === String(id));
          return sObj ? (sObj.displayName || sObj.name || `Source ${id}`) : `Source ${id}`;
        };

        const datasets = [];
        idsToShow.forEach((id, i) => {
          const daily = (bySrc.get(id) || new Array(bucketCount).fill(0)).slice();
          for (let k = 1; k < daily.length; k++) daily[k] += daily[k - 1];
          const cumulativeNegative = daily.map((v) => -v);
          datasets.push({
            label: idToLabel(id),
            data: cumulativeNegative,
            borderColor: palette[i % palette.length],
            backgroundColor: palette[i % palette.length].replace(", 1)", ", 0.12)"),
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          });
        });

        if (!shouldFilter && totals.length > 5) {
          const restIds = totals.slice(5).map((x) => x.id);
          const other = new Array(bucketCount).fill(0);
          restIds.forEach((id) => {
            const arr = bySrc.get(id) || [];
            for (let i = 0; i < bucketCount; i++) {
              other[i] += Number(arr[i] || 0);
            }
          });
          for (let k = 1; k < other.length; k++) other[k] += other[k - 1];
          const otherCumulativeNegative = other.map((v) => -v);
          datasets.push({
            label: t("other"),
            data: otherCumulativeNegative,
            borderColor: "rgba(107, 114, 128, 1)",
            backgroundColor: "rgba(107, 114, 128, 0.12)",
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          });
        }

        // Labels for chart
        let labelsForChart = [];
        if (timeRange === "weekly") {
          labelsForChart = bucketLabels.map((d) => formatShortWeekday(d));
        } else if (timeRange === "monthly") {
          labelsForChart = bucketStarts.map((d) => String(d.getDate()));
        } else {
          labelsForChart = bucketStarts.map((ms) => ms.toLocaleDateString(locale, { month: 'short' }));
        }

        setChartData({ labels: labelsForChart, datasets });
        const legendItems = datasets.map((ds) => ({ label: ds.label, color: ds.borderColor, total: Array.isArray(ds.data) && ds.data.length > 0 ? ds.data[ds.data.length - 1] : 0 }));
        setLegend(legendItems);
      } catch (e) {
        setChartData(null);
        setLegend([]);
      }
    })();
  }, [startDate, endDate, timeRange, selectedSources, sources, language, t]);

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`,
        },
      },
      datalabels: { display: false },
    },
    scales: {
      y: { display: true, beginAtZero: false },
      x: { grid: { display: false } },
    },
    interaction: { mode: "nearest", axis: "x", intersect: false },
    tension: 0.4,
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {chartData && chartData.labels?.length > 0 ? (
        <>
          <div className="md:hidden">
            <div className="w-full h-44">
              <Line data={chartData} options={{ ...lineChartOptions, plugins: { ...lineChartOptions.plugins, legend: { display: false } } }} />
            </div>
            {legend && legend.length > 0 && (
              <ChartLegend
                labels={legend.map((i) => i.label)}
                values={legend.map((i) => Math.abs(Number(i.total || 0)))}
                backgroundColor={legend.map((i) => i.color)}
                formatCurrency={formatCurrency}
              />
            )}
          </div>
          <div className="hidden md:flex flex-col w-full h-full flex-1 min-h-0">
            <div className="flex-1 min-h-0 w-full">
              <Line data={chartData} options={lineChartOptions} />
            </div>
            {legend && legend.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {legend.map((item) => (
                  <div key={item.label} className="flex items-center space-x-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{item.label}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">• {formatCurrency(Number(item.total || 0))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">{t("noDataAvailable")}</div>
      )}
    </div>
  );
}

