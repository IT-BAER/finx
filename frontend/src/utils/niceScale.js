/**
 * "Nice number" axis scale (Heckbert, Graphics Gems): a rounded domain with evenly spaced,
 * round ticks, so an axis reads 0/50/100/150 instead of 0/37/74.1/111.1.
 * Returns {min, max, step, ticks}; maxTicks is an upper bound on the gridline count.
 */
export function niceScale(rawMin, rawMax, maxTicks = 5) {
  const lo = Math.min(rawMin, rawMax);
  let hi = Math.max(rawMin, rawMax);
  if (lo === hi) hi = lo + 1; // flat range: non-zero span, no divide-by-zero

  const range = niceNum(hi - lo, false);
  const step = niceNum(range / Math.max(1, maxTicks - 1), true);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;

  const ticks = [];
  // +step/2 guards against float drift dropping the final tick
  for (let v = min; v <= max + step / 2; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  return { min, max, step, ticks };
}

// round=false ceils to the enclosing nice number; round=true snaps to the nearest {1,2,2.5,5}x10^n.
function niceNum(range, round) {
  const exp = Math.floor(Math.log10(range));
  const frac = range / 10 ** exp;
  let nf;
  if (round) {
    if (frac < 1.5) nf = 1;
    else if (frac < 3) nf = 2;
    else if (frac < 4) nf = 2.5;
    else if (frac < 7) nf = 5;
    else nf = 10;
  } else {
    if (frac <= 1) nf = 1;
    else if (frac <= 2) nf = 2;
    else if (frac <= 5) nf = 5;
    else nf = 10;
  }
  return nf * 10 ** exp;
}
