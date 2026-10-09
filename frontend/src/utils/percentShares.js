/**
 * Integer percentage shares that sum to exactly 100 (largest-remainder / Hamilton method), so a
 * donut legend can drop the decimals without the column adding up to 99 or 101. Each value gets
 * floor(share); the leftover points go to the largest fractional remainders. Non-positive values
 * get 0.
 *
 * @param {number[]} values
 * @returns {number[]} integer percents, same length/order as `values`, summing to 100 (or all 0
 *   when the total is non-positive).
 */
export function percentShares(values) {
  const nums = (values || []).map((v) =>
    typeof v === "number" && isFinite(v) && v > 0 ? v : 0,
  );
  const total = nums.reduce((a, b) => a + b, 0);
  if (total <= 0) return nums.map(() => 0);

  const raw = nums.map((v) => (v / total) * 100);
  const out = raw.map(Math.floor);
  let leftover = 100 - out.reduce((a, b) => a + b, 0);

  const byRemainder = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  for (let k = 0; leftover > 0 && k < byRemainder.length; k++, leftover--) {
    out[byRemainder[k].i] += 1;
  }
  return out;
}
