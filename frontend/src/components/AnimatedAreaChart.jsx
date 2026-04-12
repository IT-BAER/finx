import { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect, useId } from "react";
import { motion, AnimatePresence, useSpring } from "framer-motion";
import { useTheme } from "../contexts/ThemeContext.jsx";

/* ─── Color palette ───────────────────────────────────────────────── */
const CHART_COLORS = [
  { line: "rgba(96, 165, 250, 1)", fill: "96, 165, 250" },
  { line: "rgba(248, 113, 113, 1)", fill: "248, 113, 113" },
  { line: "rgba(52, 211, 153, 1)", fill: "52, 211, 153" },
  { line: "rgba(251, 191, 36, 1)", fill: "251, 191, 36" },
  { line: "rgba(167, 139, 250, 1)", fill: "167, 139, 250" },
  { line: "rgba(244, 114, 182, 1)", fill: "244, 114, 182" },
  { line: "rgba(56, 189, 248, 1)", fill: "56, 189, 248" },
  { line: "rgba(251, 146, 60, 1)", fill: "251, 146, 60" },
  { line: "rgba(107, 114, 128, 1)", fill: "107, 114, 128" },
  { line: "rgba(234, 179, 8, 1)", fill: "234, 179, 8" },
];

/* ─── Theme-aware colors ──────────────────────────────────────────── */
function colors(dark) {
  return {
    grid: dark ? "rgba(148, 163, 184, 0.08)" : "rgba(100, 116, 139, 0.10)",
    text: dark ? "#94a3b8" : "#64748b",
    crosshair: dark ? "rgba(148, 163, 184, 0.25)" : "rgba(100, 116, 139, 0.20)",
    bg: dark ? "#0f172a" : "#ffffff",
    tooltipBg: dark ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.95)",
    tooltipBorder: dark ? "rgba(148,163,184,0.14)" : "rgba(0,0,0,0.08)",
    tooltipShadow: dark ? "0 8px 32px rgba(0,0,0,0.55)" : "0 8px 32px rgba(0,0,0,0.12)",
    tooltipTitle: dark ? "#94a3b8" : "#6b7280",
    tooltipLabel: dark ? "#cbd5e1" : "#374151",
    tooltipValue: dark ? "#e2e8f0" : "#111827",
    pillBg: dark ? "rgba(30, 41, 59, 0.95)" : "rgba(24, 24, 27, 0.92)",
    pillText: dark ? "#e2e8f0" : "#ffffff",
    dotStroke: dark ? "#0f172a" : "#ffffff",
  };
}

/* ─── Monotone cubic (Fritsch-Carlson) ────────────────────────────── */
function monotoneCubicPoints(points) {
  const n = points.length;
  if (n < 2) return points.map((p) => ({ ...p, cp1x: p.x, cp1y: p.y, cp2x: p.x, cp2y: p.y }));
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    dy.push(points[i + 1].y - points[i].y);
    m.push(dx[i] === 0 ? 0 : dy[i] / dx[i]);
  }
  const tangents = [m[0]];
  for (let i = 1; i < n - 1; i++) tangents.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  tangents.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]) < 1e-10) { tangents[i] = 0; tangents[i + 1] = 0; continue; }
    const a = tangents[i] / m[i], b = tangents[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); tangents[i] = tau * a * m[i]; tangents[i + 1] = tau * b * m[i]; }
  }
  return points.map((p, i) => {
    let cp1x = p.x, cp1y = p.y, cp2x = p.x, cp2y = p.y;
    if (i > 0) { const seg = dx[i - 1] / 3; cp1x = p.x - seg; cp1y = p.y - tangents[i] * seg; }
    if (i < n - 1) { const seg = dx[i] / 3; cp2x = p.x + seg; cp2y = p.y + tangents[i] * seg; }
    return { ...p, cp1x, cp1y, cp2x, cp2y };
  });
}

function buildCurvePath(pts) {
  if (!pts.length) return "";
  const cps = monotoneCubicPoints(pts);
  let d = `M${cps[0].x},${cps[0].y}`;
  for (let i = 1; i < cps.length; i++) d += ` C${cps[i - 1].cp2x},${cps[i - 1].cp2y} ${cps[i].cp1x},${cps[i].cp1y} ${cps[i].x},${cps[i].y}`;
  return d;
}

function buildAreaPath(pts, baselineY) {
  if (!pts.length) return "";
  return `${buildCurvePath(pts)} L${pts[pts.length - 1].x},${baselineY} L${pts[0].x},${baselineY} Z`;
}

/* ─── Spring-animated dot ─────────────────────────────────────────── */
function AnimatedDot({ x, y, color, strokeColor, visible }) {
  const springConf = { stiffness: 300, damping: 30 };
  const ax = useSpring(x, springConf);
  const ay = useSpring(y, springConf);
  useEffect(() => { ax.set(x); }, [x, ax]);
  useEffect(() => { ay.set(y); }, [y, ay]);
  if (!visible) return null;
  return (
    <motion.circle cx={ax} cy={ay} r={5} fill={color} stroke={strokeColor} strokeWidth={2} />
  );
}

/* ─── Spring-animated crosshair ───────────────────────────────────── */
function AnimatedCrosshair({ x, height, color, visible, uid }) {
  const springConf = { stiffness: 300, damping: 30 };
  const ax = useSpring(x, springConf);
  useEffect(() => { ax.set(x); }, [x, ax]);
  if (!visible) return null;
  const gradId = `${uid}-crosshair-fade`;
  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0 }} />
          <stop offset="10%" style={{ stopColor: color, stopOpacity: 1 }} />
          <stop offset="90%" style={{ stopColor: color, stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <motion.rect x={ax} y={0} width={1} height={height} fill={`url(#${gradId})`} />
    </>
  );
}

/* ─── Spring-animated highlight spotlight mask ────────────────────── */
function HighlightSpotlight({ cx, innerW, innerH, uid }) {
  const springConf = { stiffness: 300, damping: 30 };
  const animCx = useSpring(cx, springConf);
  useEffect(() => { animCx.set(cx); }, [cx, animCx]);
  const hw = Math.max(30, innerW * 0.1);
  const filterId = `${uid}-hl-blur`;
  const maskId = `${uid}-hl-mask`;
  return (
    <defs>
      <filter id={filterId} x="-100%" y="-50%" width="300%" height="200%">
        <feGaussianBlur stdDeviation="18" />
      </filter>
      <mask id={maskId}>
        <motion.rect
          y={-10}
          width={hw * 2}
          height={innerH + 20}
          fill="white"
          rx={hw}
          style={{ x: animCx, translateX: `-${hw}px` }}
          filter={`url(#${filterId})`}
        />
      </mask>
    </defs>
  );
}

/* ─── Date ticker pill (bottom) ───────────────────────────────────── */
function DatePill({ label, x, parentRef, dark: isDark }) {
  const c = colors(isDark);
  const springConf = { stiffness: 400, damping: 35 };
  const ax = useSpring(x, springConf);
  useEffect(() => { ax.set(x); }, [x, ax]);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      style={{
        position: "absolute", bottom: 0, left: 0, pointerEvents: "none", zIndex: 50,
        x: ax, translateX: "-50%",
      }}
    >
      <div style={{
        background: c.pillBg, color: c.pillText,
        borderRadius: 999, padding: "3px 14px",
        fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
      }}>
        {label}
      </div>
    </motion.div>
  );
}

/* ─── Tooltip ─────────────────────────────────────────────────────── */
function Tooltip({ index, label, series, formatValue, dark: isDark, containerRef, crosshairX, paddingLeft }) {
  const c = colors(isDark);
  const tooltipRef = useRef(null);
  const [tooltipSize, setTooltipSize] = useState({ w: 180, h: 80 });

  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const w = tooltipRef.current.offsetWidth;
      const h = tooltipRef.current.offsetHeight;
      if (w > 0) setTooltipSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    }
  });

  const container = containerRef.current;
  const cW = container ? container.offsetWidth : 400;
  const xInContainer = crosshairX + paddingLeft;
  const offset = 16;
  const shouldFlip = xInContainer + tooltipSize.w + offset > cW;
  const targetX = shouldFlip ? xInContainer - tooltipSize.w - offset : xInContainer + offset;
  const targetY = Math.max(8, 8);

  const springConf = { stiffness: 200, damping: 25 };
  const animLeft = useSpring(targetX, springConf);
  const animTop = useSpring(targetY, springConf);
  useEffect(() => { animLeft.set(targetX); }, [targetX, animLeft]);
  useEffect(() => { animTop.set(targetY); }, [targetY, animTop]);

  const rows = series.map((s) => {
    const pt = s.pts[index];
    return pt ? { label: s.label, value: pt.value, color: s.lineColor } : null;
  }).filter(Boolean);

  return (
    <motion.div
      ref={tooltipRef}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{
        position: "absolute", left: animLeft, top: animTop,
        pointerEvents: "none", zIndex: 50, minWidth: 140,
        transformOrigin: shouldFlip ? "right top" : "left top",
      }}
    >
      <div style={{
        borderRadius: 12, padding: "10px 14px",
        background: c.tooltipBg, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${c.tooltipBorder}`, boxShadow: c.tooltipShadow,
      }}>
        {label && (
          <div style={{ fontSize: 11, fontWeight: 500, color: c.tooltipTitle, marginBottom: 8 }}>{label}</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: row.color, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: c.tooltipLabel }}>{row.label}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: c.tooltipValue, fontVariantNumeric: "tabular-nums" }}>
                {formatValue(row.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Compact Y-axis value formatter ──────────────────────────────── */
function formatAxisValue(v) {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1)}k`;
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  AnimatedAreaChart                                                 */
/* ═══════════════════════════════════════════════════════════════════ */

export default function AnimatedAreaChart({
  labels = [],
  datasets = [],
  formatValue = (v) => String(v),
  showLegend = false,
}) {
  const { dark } = useTheme();
  const c = colors(dark);
  const uid = useId();
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredIndex, setHoveredIndex] = useState(null);
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

  // Reveal animation
  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 900);
    return () => clearTimeout(t);
  }, []);

  const margin = useMemo(() => ({ top: 16, right: 16, bottom: 32, left: 48 }), []);
  const { width, height } = dimensions;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // Y-axis scale
  const { minVal, maxVal, yTicks } = useMemo(() => {
    let mn = Infinity, mx = -Infinity;
    for (const ds of datasets) for (const v of ds.data || []) {
      if (typeof v === "number" && isFinite(v)) { if (v < mn) mn = v; if (v > mx) mx = v; }
    }
    if (!isFinite(mn)) { mn = 0; mx = 100; }
    if (mn === mx) { mn -= 1; mx += 1; }
    const range = mx - mn; const pad = range * 0.1;
    mn -= pad; mx += pad;
    const step = (mx - mn) / 4;
    const ticks = Array.from({ length: 5 }, (_, i) => mn + step * i);
    return { minVal: mn, maxVal: mx, yTicks: ticks };
  }, [datasets]);

  const scaleY = useCallback((v) => maxVal === minVal ? innerH / 2 : innerH - ((v - minVal) / (maxVal - minVal)) * innerH, [innerH, minVal, maxVal]);
  const scaleX = useCallback((i, total) => total <= 1 ? innerW / 2 : (i / (total - 1)) * innerW, [innerW]);

  // Series data
  const allSeries = useMemo(() => {
    const n = labels.length;
    return datasets.map((ds, dsIdx) => {
      const col = CHART_COLORS[dsIdx % CHART_COLORS.length];
      const lineColor = ds.borderColor || col.line;
      const fillRgb = col.fill;
      const pts = (ds.data || []).slice(0, n).map((v, i) => ({ x: scaleX(i, n), y: scaleY(v), value: v }));
      return { label: ds.label, lineColor, fillRgb, pts };
    });
  }, [datasets, labels.length, scaleX, scaleY]);

  // Nearest index from mouse/touch X
  const findNearestIndex = useCallback((clientX) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const mx = clientX - rect.left - margin.left;
    const n = labels.length;
    if (n === 0 || innerW <= 0) return null;
    const step = innerW / Math.max(1, n - 1);
    return Math.max(0, Math.min(n - 1, Math.round(mx / step)));
  }, [labels.length, innerW, margin.left]);

  const handleMouseMove = useCallback((e) => setHoveredIndex(findNearestIndex(e.clientX)), [findNearestIndex]);
  const handleMouseLeave = useCallback(() => setHoveredIndex(null), []);
  const handleTouchMove = useCallback((e) => { if (e.touches.length > 0) setHoveredIndex(findNearestIndex(e.touches[0].clientX)); }, [findNearestIndex]);
  const handleTouchEnd = useCallback(() => setHoveredIndex(null), []);

  if (width < 10 || height < 10) {
    return <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 120, flex: "1 1 0" }} />;
  }

  const n = labels.length;
  const isHovering = hoveredIndex !== null;
  const crosshairX = isHovering ? scaleX(hoveredIndex, n) : 0;

  // X-axis labels — show ~5-7 evenly spaced
  const labelStep = Math.max(1, Math.ceil(n / 6));

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 120, flex: "1 1 0", position: "relative", touchAction: "none" }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ display: "block", cursor: isLoaded ? "crosshair" : "default" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <defs>
          {/* Area gradient fills */}
          {allSeries.map((series, idx) => (
            <linearGradient key={`area-g-${idx}`} id={`${uid}-area-g-${idx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`rgba(${series.fillRgb}, ${dark ? 0.35 : 0.45})`} />
              <stop offset="100%" stopColor={`rgba(${series.fillRgb}, 0)`} />
            </linearGradient>
          ))}
          {/* Edge fade mask for lines */}
          <linearGradient id={`${uid}-edge-fade-h`} x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" style={{ stopColor: "white", stopOpacity: 0 }} />
            <stop offset="8%" style={{ stopColor: "white", stopOpacity: 1 }} />
            <stop offset="92%" style={{ stopColor: "white", stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: "white", stopOpacity: 0 }} />
          </linearGradient>
          <mask id={`${uid}-edge-mask`}>
            <rect fill={`url(#${uid}-edge-fade-h)`} width={innerW} height={innerH} x={0} y={0} />
          </mask>
          {/* Grid row fade mask */}
          <linearGradient id={`${uid}-grid-row-fade`} x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" style={{ stopColor: "white", stopOpacity: 0 }} />
            <stop offset="10%" style={{ stopColor: "white", stopOpacity: 1 }} />
            <stop offset="90%" style={{ stopColor: "white", stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: "white", stopOpacity: 0 }} />
          </linearGradient>
          <mask id={`${uid}-grid-mask`}>
            <rect fill={`url(#${uid}-grid-row-fade)`} width={innerW} height={innerH} x={0} y={0} />
          </mask>
          {/* Clip-path for reveal animation */}
          <clipPath id={`${uid}-area-reveal-clip`}>
            <rect x={0} y={0} width={isLoaded ? innerW : 0} height={innerH + 20}
              style={{ transition: isLoaded ? "none" : `width 900ms cubic-bezier(0.85, 0, 0.15, 1)` }} />
          </clipPath>
        </defs>

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text
            key={`ytick-${i}`}
            x={margin.left - 8}
            y={margin.top + scaleY(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fill={c.text}
            fontSize={11}
            style={{ userSelect: "none" }}
          >
            {formatAxisValue(tick)}
          </text>
        ))}

        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grid rows with fading edges */}
          <g mask={`url(#${uid}-grid-mask)`}>
            {yTicks.map((tick, i) => (
              <line key={`grid-${i}`} x1={0} y1={scaleY(tick)} x2={innerW} y2={scaleY(tick)}
                stroke={c.grid} strokeWidth={1} strokeDasharray="4,4" />
            ))}
          </g>

          {/* Area fills + lines with clip reveal */}
          <g clipPath={`url(#${uid}-area-reveal-clip)`}>
            {/* Area fills — render in reverse so first dataset is on top */}
            <motion.g animate={{ opacity: isHovering ? 0.55 : 1 }} transition={{ duration: 0.4 }}>
              <g mask={`url(#${uid}-edge-mask)`}>
                {[...allSeries].reverse().map((series, _rIdx) => {
                  const idx = allSeries.length - 1 - _rIdx;
                  if (series.pts.length < 2) return null;
                  return <path key={`area-${idx}`} d={buildAreaPath(series.pts, innerH)} fill={`url(#${uid}-area-g-${idx})`} />;
                })}
              </g>
            </motion.g>

            {/* Lines — dim when hovering */}
            <motion.g animate={{ opacity: isHovering ? 0.5 : 1 }} transition={{ duration: 0.4 }}>
              {allSeries.map((series, idx) => {
                if (series.pts.length < 2) return null;
                return (
                  <path key={`line-${idx}`} d={buildCurvePath(series.pts)}
                    fill="none" stroke={series.lineColor} strokeWidth={2}
                    strokeLinecap="round" strokeLinejoin="round" />
                );
              })}
            </motion.g>

            {/* Highlighted lines — full paths clipped to a spring-animated spotlight */}
            {isHovering && <HighlightSpotlight cx={crosshairX} innerW={innerW} innerH={innerH} uid={uid} />}
            {isHovering && (
              <g mask={`url(#${uid}-hl-mask)`}>
                {allSeries.map((series, idx) => {
                  if (series.pts.length < 2) return null;
                  return <path key={`hl-${idx}`} d={buildCurvePath(series.pts)} fill="none"
                    stroke={series.lineColor} strokeWidth={2.5} strokeLinecap="round" />;
                })}
              </g>
            )}
          </g>

          {/* Animated crosshair */}
          <AnimatedCrosshair x={crosshairX} height={innerH} color={c.crosshair} visible={isHovering && isLoaded} uid={uid} />

          {/* Animated dots on lines */}
          {isHovering && isLoaded && allSeries.map((series, idx) => {
            const pt = series.pts[hoveredIndex];
            if (!pt) return null;
            return <AnimatedDot key={`dot-${idx}`} x={pt.x} y={pt.y}
              color={series.lineColor} strokeColor={c.dotStroke} visible />;
          })}

          {/* X-axis labels — fade near crosshair */}
          {labels.map((label, i) => {
            if (i % labelStep !== 0 && i !== n - 1) return null;
            const lx = scaleX(i, n);
            let opacity = 1;
            if (isHovering) {
              const dist = Math.abs(lx - crosshairX);
              if (dist < 20) opacity = 0;
              else if (dist < 50) opacity = (dist - 20) / 30;
            }
            return (
              <text key={`xl-${i}`} x={lx} y={innerH + 18} textAnchor="middle"
                fill={c.text} fontSize={11} style={{ userSelect: "none", opacity, transition: "opacity 0.3s" }}>
                {label}
              </text>
            );
          })}
        </g>
      </svg>

      {/* Date ticker pill */}
      <AnimatePresence>
        {isHovering && isLoaded && labels[hoveredIndex] && (
          <DatePill
            key="pill"
            label={labels[hoveredIndex]}
            x={crosshairX + margin.left}
            parentRef={containerRef}
            dark={dark}
          />
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <AnimatePresence>
        {isHovering && isLoaded && (
          <Tooltip
            key="tooltip"
            index={hoveredIndex}
            label={labels[hoveredIndex]}
            series={allSeries}
            formatValue={formatValue}
            dark={dark}
            containerRef={containerRef}
            crosshairX={crosshairX}
            paddingLeft={margin.left}
          />
        )}
      </AnimatePresence>

      {/* Legend */}
      {showLegend && allSeries.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 20px", marginTop: 8, justifyContent: "center" }}>
          {allSeries.map((series, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: series.lineColor, display: "inline-block" }} />
              <span style={{ fontSize: 12, color: c.text }}>{series.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
