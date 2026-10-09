import { useState } from "react";
import { donutArcs } from "../utils/donutArcs";

/**
 * SVG donut chart (60% cutout). Draws one arc per positive value,
 * coloured by `colors[i]`. On hover the slice pops outward, the others dim, and the donut's hole
 * shows the slice's `label` + `subLabel` (amount · share) — the centre stays inside the card so
 * it never clips, unlike a cursor-following tooltip. The legend/table lives outside this component.
 *
 * @param {number[]} values
 * @param {string[]} colors            fill per slice (rgba)
 * @param {string[]} [borderColors]    stroke per slice; falls back to the fill
 * @param {string[]} [labels]          hover-centre title per slice
 * @param {string[]} [subLabels]       hover-centre subtitle per slice (e.g. "€ 213,27 · 55,0 %")
 * @param {number}   [size=100]        viewBox side (arcs scale to the container regardless)
 * @param {number}   [cutout=0.6]      inner-radius fraction
 */
export default function SvgDonut({
  values,
  colors,
  borderColors,
  labels,
  subLabels,
  size = 100,
  cutout = 0.6,
  className,
  style,
}) {
  const [hover, setHover] = useState(-1);
  const arcs = donutArcs(values, { size, cutout });
  const interactive = arcs.length > 1; // a lone full ring has nothing to pop against
  const off = size * 0.035;
  const active = interactive && hover >= 0;

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", ...style }}
      onMouseLeave={() => setHover(-1)}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{ width: "100%", height: "100%", display: "block" }}
        role="img"
      >
        {arcs.map((a) => {
          const fill = colors?.[a.index] || "rgba(148, 163, 184, 0.85)";
          const stroke = borderColors?.[a.index] || fill;
          const isHovered = active && hover === a.index;
          const dx = isHovered ? Math.cos(a.midAngle) * off : 0;
          const dy = isHovered ? Math.sin(a.midAngle) * off : 0;
          return (
            <path
              key={a.index}
              d={a.d}
              fill={fill}
              fillRule="evenodd"
              stroke={stroke}
              strokeWidth={0.5}
              transform={isHovered ? `translate(${dx} ${dy})` : undefined}
              style={{
                transition: "transform 150ms ease, opacity 150ms ease",
                opacity: active && !isHovered ? 0.4 : 1,
                cursor: "pointer",
              }}
              onMouseEnter={() => setHover(a.index)}
            />
          );
        })}
      </svg>

      {active && (labels?.[hover] || subLabels?.[hover]) && (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-[22%]"
          aria-hidden="true"
        >
          {labels?.[hover] && (
            <span className="text-sm font-semibold text-app leading-tight truncate max-w-full">
              {labels[hover]}
            </span>
          )}
          {subLabels?.[hover] && (
            <span className="text-xs text-muted leading-tight whitespace-nowrap">
              {subLabels[hover]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
