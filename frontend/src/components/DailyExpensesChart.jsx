import { useEffect, useState, useMemo } from "react";
import offlineAPI from "../services/offlineAPI";
import { LazyBar as Bar } from "./LazyChart.jsx";
import { useTranslation } from "../hooks/useTranslation";

function toDate(value) {
  if (typeof value === "string" && /\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.split("-").map((v) => parseInt(v, 10));
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

export default function DailyExpensesChart({ startDate, endDate, timeRange }) {
  const { t, formatCurrency, language } = useTranslation();
  const [series, setSeries] = useState([]);

  const formatShortWeekday = (dateStr) => {
    const dateObj = toDate(dateStr);
    const weekday = dateObj.toLocaleDateString(language === "de" ? "de-DE" : "en-US", { weekday: "short" });
    return weekday.replace(/\.$/, "");
  };
  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  };

  useEffect(() => {
    (async () => {
      const all = await offlineAPI.getAllTransactions();
      const start = toDate(startDate);
      const end = toDate(endDate);
      end.setHours(23, 59, 59, 999);

      const expenses = (all || [])
        .filter((tx) => String(tx.type).toLowerCase() === "expense")
        .filter((tx) => {
          const d = new Date(tx.date);
          return d >= start && d <= end;
        });

      if (timeRange === "weekly") {
        // daily points across the range inclusive
        const map = new Map();
        const cur = new Date(start);
        while (cur <= end) {
          const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
          map.set(key, 0);
          cur.setDate(cur.getDate() + 1);
        }
        expenses.forEach((tx) => {
          const d = toDate(tx.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          map.set(key, (map.get(key) || 0) + Number(tx.amount || 0));
        });
        const arr = Array.from(map.entries()).map(([date, total]) => ({ date, total }));
        setSeries(arr);
      } else if (timeRange === "monthly") {
        // weekly buckets (Mon-Sun)
        const weeks = [];
        let ws = new Date(start);
        const day = ws.getDay();
        const diff = ws.getDate() - day + (day === 0 ? -6 : 1);
        ws.setDate(diff);
        while (ws <= end) {
          const we = new Date(ws);
          we.setDate(ws.getDate() + 6);
          we.setHours(23, 59, 59, 999);
          const total = expenses.reduce((sum, tx) => {
            const d = new Date(tx.date);
            return sum + (d >= ws && d <= we ? Number(tx.amount || 0) : 0);
          }, 0);
          weeks.push({ date: `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, "0")}-${String(ws.getDate()).padStart(2, "0")}`, total });
          ws.setDate(ws.getDate() + 7);
        }
        setSeries(weeks);
      } else {
        // yearly -> monthly totals
        const year = start.getFullYear();
        const months = [];
        for (let m = 0; m < 12; m++) {
          const ms = new Date(year, m, 1);
          const me = new Date(year, m + 1, 0);
          me.setHours(23, 59, 59, 999);
          const total = expenses.reduce((sum, tx) => {
            const d = new Date(tx.date);
            return sum + (d >= ms && d <= me ? Number(tx.amount || 0) : 0);
          }, 0);
          months.push({ date: `${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, "0")}-01`, total });
        }
        setSeries(months);
      }
    })();
  }, [startDate, endDate, timeRange, language]);

  const labels = useMemo(() => {
    if (!series || series.length === 0) return [];
    if (timeRange === "weekly") return series.map((d) => formatShortWeekday(d.date));
    if (timeRange === "monthly") return series.map((d) => {
      const dt = toDate(d.date);
      const wn = getWeekNumber(dt);
      return language === "de" ? `KW ${wn}` : `CW ${wn}`;
    });
    return series.map((d) => toDate(d.date).toLocaleDateString(language === "de" ? "de-DE" : "en-US", { month: "short" }));
  }, [series, timeRange, language]);

  const data = useMemo(() => ({
    labels,
    datasets: [{
      label: t("expenses"),
      data: (series || []).map((d) => Number(d.total || 0)),
      backgroundColor: "rgba(248, 113, 113, 0.7)",
      borderColor: "rgba(248, 113, 113, 1)",
      borderWidth: 2,
      borderRadius: 6,
    }],
  }), [labels, series, t]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } },
      datalabels: {
        anchor: "center",
        align: "center",
        formatter: (value) => (value !== 0 ? formatCurrency(value) : ""),
        color: "#FFFFFF",
        font: { weight: "bold", size: 10 },
        display: (context) => context.dataset.data[context.dataIndex] !== 0,
      },
    },
    scales: { y: { display: false, beginAtZero: true }, x: { grid: { display: false } } },
  };

  return (
    <div className="w-full h-full flex-1" style={{ minHeight: 0 }}>
      {labels.length > 0 ? (
        <Bar data={data} options={options} />
      ) : (
        <div className="text-center py-8 text-gray-500">{t("noDataAvailable")}</div>
      )}
    </div>
  );
}

