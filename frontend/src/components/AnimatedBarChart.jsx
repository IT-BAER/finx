import { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect, useId } from "react";
import { motion } from "framer-motion";
import { useTheme } from "../contexts/ThemeContext.jsx";

/* ─── Color palette ───────────────────────────────────────────────── */
const CHART_COLORS = [
  { main: "rgba(96, 165, 250, 0.85)", hover: "rgba(96, 165, 250, 1)", rgb: "96, 165, 250" },
  { main: "rgba(248, 113, 113, 0.85)", hover: "rgba(248, 113, 113, 1)", rgb: "248, 113, 113" },
  { main: "rgba(52, 211, 153, 0.85)", hover: "rgba(52, 211, 153, 1)", rgb: "52, 211, 153" },
  { main: "rgba(251, 191, 36, 0.85)", hover: "rgba(251, 191, 36, 1)", rgb: "251, 191, 36" },
  { main: "rgba(167, 139, 250, 0.85)", hover: "rgba(167, 139, 250, 1)", rgb: "167, 139, 250" },
  { main: "rgba(244, 114, 182, 0.85)", hover: "rgba(244, 114, 182, 1)", rgb: "244, 114, 182" },
  { main: "rgba(56, 189, 248, 0.85)", hover: "rgba(56, 189, 248, 1)", rgb: "56, 189, 248" },
  { main: "rgba(251, 146, 60, 0.85)", hover: "rgba(251, 146, 60, 1)", rgb: "251, 146, 60" },
];

/* ─── Theme helpers ───────────────────────────────────────────────── */
function colors(dark) {
  return {
    grid: dark ? "rgba(148, 163, 184, 0.08)" : "rgba(100, 116, 139, 0.10)",
    text: dark ? "#94a3b8" : "#64748b",
    crosshair: dark ? "rgba(148, 163, 184, 0.2)" : "rgba(100, 116, 139, 0.15)",
    tooltipBg: dark ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.95)",
    tooltipBorder: dark ? "rgba(148,163,184,0.14)" : "rgba(0,0,0,0.08)",
    tooltipShadow: dark ? "0 8px 32px rgba(0,0,0,0.55)" : "0 8px 32px rgba(0,0,0,0.12)",
    tooltipTitle: dark ? "#94a3b8" : "#6b7280",
    tooltipLabel: dark ? "#cbd5e1" : "#374151",
    tooltipValue: dark ? "#e2e8f0" : "#111827",
    pillBg: dark ? "rgba(30, 41, 59, 0.95)" : "rgba(24, 24, 27, 0.92)",
    pillText: dark ? "#e2e8f0" : "#ffffff",
  };
}

function formatAxisValue(v) {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1)}k`;
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

/* ─── Tooltip ─────────────────────────────────────────────────────── */
function BarTooltip({ bar, datasets, formatValue, dark: isDark, containerRef, barCenterX, margin }) {
  const c = colors(isDark);
  const tooltipRef = useRef(null);
  const [tooltipW, setTooltipW] = useState(160);

  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const w = tooltipRef.current.offsetWidth;
      if (w > 0) setTooltipW(w);
    }
  });

  const container = containerRef.current;
  const cW = container ? container.offsetWidth : 400;
  const xInContainer = barCenterX + margin.left;
  const offset = 16;
  const shouldFlip = xInContainer + tooltipW + offset > cW;
  const targetX = shouldFlip ? xInContainer - tooltipW - offset : xInContainer + offset;

  return (
    <div
      ref={tooltipRef}
      style={{
        position: "absolute", left: targetX, top: margin.top + 4,
        pointerEvents: "none", zIndex: 50, minWidth: 120,
      }}
    >
      <div style={{
        borderRadius: 8, padding: "10px 14px",
        background: isDark ? "#1e293b" : "#ffffff",
        border: `1px solid ${c.tooltipBorder}`, boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: c.tooltipTitle, marginBottom: 6 }}>{bar.label}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {datasets.length > 1 ? (
            datasets.map((ds, dsIdx) => (
              <div key={dsIdx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: CHART_COLORS[dsIdx % CHART_COLORS.length].hover, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: c.tooltipLabel }}>{ds.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: c.tooltipValue, fontVariantNumeric: "tabular-nums" }}>
                  {formatValue(ds.data[bar.barIdx] || 0)}
                </span>
              </div>
            ))
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: CHART_COLORS[bar.colorIdx % CHART_COLORS.length].hover, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: c.tooltipLabel }}>{bar.datasetLabel}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: c.tooltipValue, fontVariantNumeric: "tabular-nums" }}>
                {formatValue(bar.value)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  AnimatedBarChart                                                  */
/* ═══════════════════════════════════════════════════════════════════ */

export default function AnimatedBarChart({
  labels = [],
  datasets = [],
  stacked = false,
  formatValue = (v) => v.toFixed(0),
  showLegend = false,
}) {
  const { dark } = useTheme();
  const c = colors(dark);
  const uid = useId();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredBarIdx, setHoveredBarIdx] = useState(null); // index in labels
  const [isLoaded, setIsLoaded] = useState(false);

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setDimensions({ width: r.width, height: r.height });
    });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(t);
  }, []);

  const margin = useMemo(() => ({ top: 16, right: 16, bottom: 32, left: 48 }), []);
  const { width, height } = dimensions;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // Y-axis scale
  const { maxValue, yTicks } = useMemo(() => {
    let mx = 0;
    const numBars = labels.length;
    if (stacked) {
      for (let i = 0; i < numBars; i++) {
        let t = 0;
        datasets.forEach(ds => { t += Math.abs(ds.data[i] || 0); });
        mx = Math.max(mx, t);
      }
    } else {
      datasets.forEach(ds => ds.data.forEach(v => { mx = Math.max(mx, Math.abs(v || 0)); }));
    }
    if (mx === 0) mx = 1;
    mx *= 1.1;  // 10% headroom
    const step = mx / 4;
    const ticks = Array.from({ length: 5 }, (_, i) => step * i);
    return { maxValue: mx, yTicks: ticks };
  }, [labels, datasets, stacked]);

  // Bar layout
  const barLayout = useMemo(() => {
    if (!labels.length || !datasets.length || innerW <= 0 || innerH <= 0) return { bars: [], groupCenters: [] };

    const numBars = labels.length;
    const numDs = datasets.length;
    const groupGap = Math.max(4, Math.min(16, innerW / numBars * 0.2));
    const groupWidth = (innerW - groupGap * (numBars + 1)) / numBars;
    const bars = [];
    const groupCenters = [];

    for (let bi = 0; bi < numBars; bi++) {
      const groupX = groupGap + bi * (groupWidth + groupGap);
      groupCenters.push(groupX + groupWidth / 2);

      if (stacked) {
        let stackY = 0;
        datasets.forEach((ds, dsIdx) => {
          const value = Math.abs(ds.data[bi] || 0);
          const h = (value / maxValue) * innerH;
          bars.push({ x: groupX, y: innerH - stackY - h, width: groupWidth, height: h, value: ds.data[bi] || 0, datasetIdx: dsIdx, barIdx: bi, label: labels[bi], datasetLabel: ds.label, colorIdx: dsIdx });
          stackY += h;
        });
      } else {
        const barW = numDs > 1 ? (groupWidth - (numDs - 1) * 2) / numDs : groupWidth;
        datasets.forEach((ds, dsIdx) => {
          const value = Math.abs(ds.data[bi] || 0);
          const h = (value / maxValue) * innerH;
          const x = numDs > 1 ? groupX + dsIdx * (barW + 2) : groupX;
          bars.push({ x, y: innerH - h, width: barW, height: h, value: ds.data[bi] || 0, datasetIdx: dsIdx, barIdx: bi, label: labels[bi], datasetLabel: ds.label, colorIdx: dsIdx });
        });
      }
    }
    return { bars, groupCenters };
  }, [labels, datasets, innerW, innerH, stacked, maxValue]);

  const handleBarEnter = useCallback((barIdx) => setHoveredBarIdx(barIdx), []);
  const handleBarLeave = useCallback(() => setHoveredBarIdx(null), []);

  if (!labels.length || !datasets.length || width < 10 || height < 10) {
    return <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 120, flex: "1 1 0" }} />;
  }

  const isHovering = hoveredBarIdx !== null;

  // Crosshair X for hovered group
  const crosshairX = isHovering && barLayout.groupCenters[hoveredBarIdx] != null
    ? barLayout.groupCenters[hoveredBarIdx] : 0;

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 120, flex: "1 1 0", position: "relative", touchAction: "none" }}>
      <svg width={width} height={height} style={{ display: "block", cursor: "default" }}>
        <defs>
          {/* Bar gradient fills */}
          {CHART_COLORS.map((col, idx) => (
            <linearGradient key={`bar-g-${idx}`} id={`${uid}-bar-g-${idx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`rgba(${col.rgb}, 1)`} />
              <stop offset="100%" stopColor={`rgba(${col.rgb}, 0.7)`} />
            </linearGradient>
          ))}
          {/* Grid fade mask */}
          <linearGradient id={`${uid}-bar-grid-fade`} x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" style={{ stopColor: "white", stopOpacity: 0 }} />
            <stop offset="10%" style={{ stopColor: "white", stopOpacity: 1 }} />
            <stop offset="90%" style={{ stopColor: "white", stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: "white", stopOpacity: 0 }} />
          </linearGradient>
          <mask id={`${uid}-bar-grid-mask`}>
            <rect fill={`url(#${uid}-bar-grid-fade)`} width={innerW} height={innerH} x={0} y={0} />
          </mask>
          {/* Crosshair fade gradient */}
          <linearGradient id={`${uid}-bar-crosshair-fade`} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: c.crosshair, stopOpacity: 0 }} />
            <stop offset="10%" style={{ stopColor: c.crosshair, stopOpacity: 1 }} />
            <stop offset="90%" style={{ stopColor: c.crosshair, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: c.crosshair, stopOpacity: 0 }} />
          </linearGradient>
        </defs>

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text key={`yt-${i}`} x={margin.left - 8} y={margin.top + innerH - (tick / maxValue) * innerH}
            textAnchor="end" dominantBaseline="middle" fill={c.text} fontSize={11}
            style={{ userSelect: "none" }}>
            {formatAxisValue(tick)}
          </text>
        ))}

        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grid rows with fading edges */}
          <g mask={`url(#${uid}-bar-grid-mask)`}>
            {yTicks.map((tick, i) => {
              const y = innerH - (tick / maxValue) * innerH;
              return <line key={`g-${i}`} x1={0} y1={y} x2={innerW} y2={y}
                stroke={c.grid} strokeWidth={1} strokeDasharray="4,4" />;
            })}
          </g>

          {/* Crosshair indicator for hovered group */}
          {isHovering && (
            <rect x={crosshairX - 0.5} y={0} width={1} height={innerH} fill={`url(#${uid}-bar-crosshair-fade)`} />
          )}

          {/* Bars with entrance animation */}
          {barLayout.bars.map((bar, i) => {
            const isGroupHovered = hoveredBarIdx === bar.barIdx;
            const anyHovered = isHovering;
            const palette = CHART_COLORS[bar.colorIdx % CHART_COLORS.length];
            const dimmed = anyHovered && !isGroupHovered;

            return (
              <motion.rect
                key={`bar-${bar.barIdx}-${bar.datasetIdx}`}
                x={bar.x}
                width={Math.max(0, bar.width)}
                rx={Math.min(6, bar.width / 2)}
                ry={Math.min(6, bar.width / 2)}
                fill={`url(#${uid}-bar-g-${bar.colorIdx % CHART_COLORS.length})`}
                initial={{ y: innerH, height: 0 }}
                animate={{
                  y: isLoaded ? bar.y : innerH,
                  height: isLoaded ? Math.max(0, bar.height) : 0,
                  opacity: dimmed ? 0.35 : 1,
                }}
                transition={{
                  y: { duration: 0.4, ease: "easeOut" },
                  height: { duration: 0.4, ease: "easeOut" },
                  opacity: { duration: 0.2 },
                }}
                onMouseEnter={() => handleBarEnter(bar.barIdx)}
                onMouseLeave={handleBarLeave}
                style={{ cursor: "pointer" }}
              />
            );
          })}

          {/* X-axis labels — fade near crosshair */}
          {labels.map((label, i) => {
            const x = barLayout.groupCenters[i] || 0;
            let opacity = 1;
            if (isHovering) {
              const dist = Math.abs(x - crosshairX);
              if (dist < 10) opacity = 0;
              else if (dist < 40) opacity = (dist - 10) / 30;
            }

            const maxLen = width < 400 ? 4 : 8;
            const display = label.length > maxLen ? label.slice(0, maxLen) + "…" : label;

            return (
              <text key={`xl-${i}`} x={x} y={innerH + 18} textAnchor="middle"
                fill={c.text} fontSize={11} style={{ userSelect: "none", opacity, transition: "opacity 0.3s" }}>
                {display}
              </text>
            );
          })}
        </g>
      </svg>

      {/* Date pill at bottom */}
        {isHovering && labels[hoveredBarIdx] && (
          <div
            style={{
              position: "absolute", bottom: 0, pointerEvents: "none", zIndex: 50,
              left: crosshairX + margin.left, transform: "translateX(-50%)",
            }}
          >
            <div style={{
              background: c.pillBg, color: c.pillText,
              borderRadius: 999, padding: "3px 14px",
              fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            }}>
              {labels[hoveredBarIdx]}
            </div>
          </div>
        )}

      {/* Tooltip */}
        {isHovering && (() => {
          const bar = barLayout.bars.find(b => b.barIdx === hoveredBarIdx);
          if (!bar) return null;
          return (
            <BarTooltip
              key="bar-tooltip"
              bar={bar}
              datasets={datasets}
              formatValue={formatValue}
              dark={dark}
              containerRef={containerRef}
              barCenterX={crosshairX}
              margin={margin}
            />
          );
        })()}

      {/* Legend */}
      {showLegend && datasets.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 20px", marginTop: 8, justifyContent: "center" }}>
          {datasets.map((ds, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: CHART_COLORS[i % CHART_COLORS.length].hover, display: "inline-block" }} />
              <span style={{ fontSize: 12, color: c.text }}>{ds.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}