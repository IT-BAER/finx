import { niceScale } from "./niceScale.js";

/**
 * Y-domain for the area chart: pads the raw [min,max], then rounds via niceScale. When every
 * series is near-flat (its own movement < 5% of the overall span, e.g. two constant balance
 * lines far apart), the padding widens so the lines sit inside the frame instead of on its edges.
 */
export function areaDomain(datasets) {
  let mn = Infinity;
  let mx = -Infinity;
  let maxSpread = 0; // largest single-series (max - min)
  for (const ds of datasets || []) {
    let smn = Infinity;
    let smx = -Infinity;
    for (const v of ds?.data || []) {
      if (typeof v === "number" && isFinite(v)) {
        if (v < mn) mn = v;
        if (v > mx) mx = v;
        if (v < smn) smn = v;
        if (v > smx) smx = v;
      }
    }
    if (isFinite(smn)) maxSpread = Math.max(maxSpread, smx - smn);
  }
  if (!isFinite(mn)) { mn = 0; mx = 100; }
  if (mn === mx) { mn -= 1; mx += 1; }

  const range = mx - mn;
  const flat = maxSpread < range * 0.05;
  const pad = range * (flat ? 0.25 : 0.1);
  return niceScale(mn - pad, mx + pad);
}
