/**
 * Donut-slice geometry for the SVG donut charts. Pure: given the
 * slice values it returns one SVG path `d` per positive slice plus the slice's mid-angle (used to
 * pop the slice outward on hover). Slices start at 12 o'clock and run clockwise.
 * A single non-zero value renders as a full ring (even-odd fill punches the hole).
 *
 * @param {number[]} values
 * @param {{size?:number, cutout?:number, pad?:number}} [opts]
 *   size = viewBox square side; cutout = inner-radius fraction; pad = inset so the hover pop and
 *   stroke stay inside the viewBox.
 * @returns {Array<{d:string, midAngle:number, index:number}>} one entry per positive slice, in
 *   input order, carrying the original index so colours align.
 */
export function donutArcs(values, { size = 100, cutout = 0.6, pad } = {}) {
  const nums = (values || []).map((v) =>
    typeof v === "number" && isFinite(v) && v > 0 ? v : 0,
  );
  const total = nums.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  const inset = pad == null ? size * 0.08 : pad;
  const cx = size / 2;
  const cy = size / 2;
  const oR = size / 2 - inset;
  const iR = oR * cutout;
  const full = 2 * Math.PI;

  const arcs = [];
  let acc = -Math.PI / 2; // 12 o'clock
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] <= 0) continue;
    const a0 = acc;
    const a1 = acc + (nums[i] / total) * full;
    acc = a1;
    arcs.push({
      d: arcPath(cx, cy, oR, iR, a0, a1),
      midAngle: (a0 + a1) / 2,
      index: i,
    });
  }
  return arcs;
}

const r2 = (n) => Math.round(n * 100) / 100;
const pt = (cx, cy, r, ang) => [r2(cx + r * Math.cos(ang)), r2(cy + r * Math.sin(ang))];

function arcPath(cx, cy, oR, iR, a0, a1) {
  const sweep = a1 - a0;
  if (sweep >= 2 * Math.PI - 1e-6) {
    const [ox0, oy0] = pt(cx, cy, oR, 0);
    const [ox1, oy1] = pt(cx, cy, oR, Math.PI);
    const [ix0, iy0] = pt(cx, cy, iR, 0);
    const [ix1, iy1] = pt(cx, cy, iR, Math.PI);
    return (
      `M ${ox0} ${oy0} A ${oR} ${oR} 0 1 1 ${ox1} ${oy1} A ${oR} ${oR} 0 1 1 ${ox0} ${oy0} ` +
      `M ${ix0} ${iy0} A ${iR} ${iR} 0 1 0 ${ix1} ${iy1} A ${iR} ${iR} 0 1 0 ${ix0} ${iy0} Z`
    );
  }
  const large = sweep > Math.PI ? 1 : 0;
  const [osx, osy] = pt(cx, cy, oR, a0);
  const [oex, oey] = pt(cx, cy, oR, a1);
  const [iex, iey] = pt(cx, cy, iR, a1);
  const [isx, isy] = pt(cx, cy, iR, a0);
  return (
    `M ${osx} ${osy} A ${oR} ${oR} 0 ${large} 1 ${oex} ${oey} ` +
    `L ${iex} ${iey} A ${iR} ${iR} 0 ${large} 0 ${isx} ${isy} Z`
  );
}
