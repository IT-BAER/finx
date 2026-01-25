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

export default function PerSourceBalanceTrend({
  startDate,
  endDate,
  timeRange, // 'weekly' | 'monthly' | 'yearly'
  selectedSources = [],
  sources = [],
  incomeTrackingDisabled = false,
}) {
  const { t, formatCurrency, language } = useTranslation();
  const locale = getLocaleString(language);
  const [chartData, setChartData] = useState(null);
  const [legend, setLegend] = useState([]);

  const shouldFilter = useMemo(() => {
    return selectedSources.length > 0 && selectedSources.length < (sources?.length || Infinity);
  }, [selectedSources, sources]);

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

        // Buckets
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
          // weekly buckets within month (Mon-Sun)
          let ws = new Date(start);
          const day = ws.getDay();
          const diff = ws.getDate() - day + (day === 0 ? -6 : 1);
          ws.setDate(diff);
          while (ws <= end) {
            const we = new Date(ws);
            we.setDate(ws.getDate() + 6);
            we.setHours(23, 59, 59, 999);
            bucketStarts.push(new Date(ws));
            bucketEnds.push(we);
            bucketLabels.push(`${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, "0")}-${String(ws.getDate()).padStart(2, "0")}`);
            ws.setDate(ws.getDate() + 7);
          }
        } else {
          // yearly -> monthly buckets
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

        // Build maps
        const bySrcExp = new Map(); // id -> number[buckets]
        const bySrcInc = new Map(); // id -> number[buckets]

        // name -> [ids] (include both name and displayName for robust matching)
        const nameToIds = new Map();
        (sources || []).forEach((s) => {
          const names = new Set([
            String(s.name || "").trim().toLowerCase(),
            String(s.displayName || "").trim().toLowerCase(),
          ].filter(Boolean));
          for (const nm of names) {
            if (!nameToIds.has(nm)) nameToIds.set(nm, []);
            nameToIds.get(nm).push(String(s.id));
          }
        });
        const selectedSet = new Set((selectedSources || []).map((x) => String(x)));

        // Helper function to get source ID from transaction
        const getSourceIdFromTx = (tx) => {
          let sid = null;
          const type = String(tx.type).toLowerCase();
          if (type === 'expense') {
            sid = tx.source_id != null ? String(tx.source_id) : null;
          } else if (type === 'income') {
            const tryNames = [tx.target_name, tx.target, tx.source_name]
              .map((v) => String(v || '').trim().toLowerCase())
              .filter(Boolean);
            for (const nm of tryNames) {
              const ids = nameToIds.get(nm) || [];
              if (ids.length > 0) {
                sid = shouldFilter ? (ids.find((id) => selectedSet.has(id)) || ids[0]) : ids[0];
                break;
              }
            }
            // As a last resort, if the record carries a source_id, accept it
            if (!sid && tx.source_id != null) sid = String(tx.source_id);
          }
          return sid;
        };

        // Calculate initial balance from transactions BEFORE the selected date range
        const initialBalanceBySource = new Map(); // id -> initial balance
        (all || []).forEach((tx) => {
          const d = toDate(tx.date);
          if (d < start) {
            const sid = getSourceIdFromTx(tx);
            if (!sid) return;
            
            if (!initialBalanceBySource.has(sid)) initialBalanceBySource.set(sid, 0);
            const amt = Number(tx.amount || 0);
            const type = String(tx.type).toLowerCase();
            if (type === 'income') {
              initialBalanceBySource.set(sid, initialBalanceBySource.get(sid) + amt);
            } else if (type === 'expense') {
              initialBalanceBySource.set(sid, initialBalanceBySource.get(sid) - amt);
            }
          }
        });

        const inRange = (all || []).filter((tx) => {
          const d = toDate(tx.date);
          return d >= start && d <= end;
        });

        inRange.forEach((tx) => {
          const d = toDate(tx.date);
          let idx = -1;
          for (let i = 0; i < bucketCount; i++) { if (d >= bucketStarts[i] && d <= bucketEnds[i]) { idx = i; break; } }
          if (idx < 0) return;

          // Use helper function to determine source id
          const sid = getSourceIdFromTx(tx);
          if (!sid) return;

          if (String(tx.type).toLowerCase() === 'expense') {
            if (!bySrcExp.has(sid)) bySrcExp.set(sid, new Array(bucketCount).fill(0));
            bySrcExp.get(sid)[idx] += Number(tx.amount || 0);
          } else {
            if (!bySrcInc.has(sid)) bySrcInc.set(sid, new Array(bucketCount).fill(0));
            bySrcInc.get(sid)[idx] += Number(tx.amount || 0);
          }
        });

        // Totals order
        const sourceTotals = [];
        const allIds = new Set([...bySrcExp.keys(), ...bySrcInc.keys()]);
        allIds.forEach((id) => {
          const e = bySrcExp.get(id) || new Array(bucketCount).fill(0);
          const inc = bySrcInc.get(id) || new Array(bucketCount).fill(0);
          const total = e.reduce((a,b)=>a+b,0) + inc.reduce((a,b)=>a+b,0);
          sourceTotals.push({ id, total });
        });
        sourceTotals.sort((a,b)=> b.total - a.total);

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
        const idsToShow = shouldFilter ? sourceTotals.map((x) => x.id) : sourceTotals.slice(0, 5).map((x) => x.id);
        idsToShow.forEach((id, i) => {
          const e = (bySrcExp.get(id) || new Array(bucketCount).fill(0)).slice();
          const inc = (bySrcInc.get(id) || new Array(bucketCount).fill(0)).slice();
          // Get initial balance from transactions before the selected date range
          const initialBalance = initialBalanceBySource.get(id) || 0;
          let series = new Array(bucketCount).fill(0);
          if (incomeTrackingDisabled) {
            for (let k = 1; k < e.length; k++) e[k] += e[k - 1];
            // Start from initial balance (negative since we're tracking expenses)
            series = e.map((v) => initialBalance - v);
          } else {
            const net = e.map((v, idx) => (inc[idx] || 0) - v);
            // Add initial balance to the first bucket, then accumulate
            net[0] += initialBalance;
            for (let k = 1; k < net.length; k++) net[k] += net[k - 1];
            series = net;
          }
          datasets.push({
            label: idToLabel(id),
            data: series,
            borderColor: palette[i % palette.length],
            backgroundColor: palette[i % palette.length].replace(", 1)", ", 0.12)"),
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          });
        });

        if (!shouldFilter && sourceTotals.length > 5) {
          const restIds = sourceTotals.slice(5).map((x) => x.id);
          const aggE = new Array(bucketCount).fill(0);
          const aggI = new Array(bucketCount).fill(0);
          // Calculate combined initial balance for "other" sources
          let aggInitialBalance = 0;
          restIds.forEach((id) => {
            const e = bySrcExp.get(id) || [];
            const inc = bySrcInc.get(id) || [];
            for (let i = 0; i < bucketCount; i++) {
              aggE[i] += Number(e[i] || 0);
              aggI[i] += Number(inc[i] || 0);
            }
            aggInitialBalance += initialBalanceBySource.get(id) || 0;
          });
          let series = new Array(bucketCount).fill(0);
          if (incomeTrackingDisabled) {
            for (let k = 1; k < aggE.length; k++) aggE[k] += aggE[k - 1];
            series = aggE.map((v) => aggInitialBalance - v);
          } else {
            const net = aggE.map((v, idx) => (aggI[idx] || 0) - v);
            // Add aggregated initial balance to the first bucket
            net[0] += aggInitialBalance;
            for (let k = 1; k < net.length; k++) net[k] += net[k - 1];
            series = net;
          }
          datasets.push({
            label: t("other"),
            data: series,
            borderColor: "rgba(107, 114, 128, 1)",
            backgroundColor: "rgba(107, 114, 128, 0.12)",
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          });
        }

        // Labels
        let labelsForChart = [];
        if (timeRange === "weekly") {
          labelsForChart = bucketLabels.map((d) => formatShortWeekday(d));
        } else if (timeRange === "monthly") {
          labelsForChart = bucketStarts.map((ws) => {
            const weekNumber = getWeekNumber(ws);
            return `${t("calendarWeekShort")} ${weekNumber}`;
          });
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
  }, [startDate, endDate, timeRange, selectedSources, sources, incomeTrackingDisabled, language, t]);

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: { mode: "index", intersect: false, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } },
      datalabels: { display: false },
    },
    scales: { y: { display: true, beginAtZero: false }, x: { grid: { display: false } } },
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

