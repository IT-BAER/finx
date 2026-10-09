/**
 * One categorical colour ramp for the whole app, so a category is the same colour in the
 * donut, the bar and the table chip — and the same colour the Android app shows. Colour is
 * theme-invariant (a category's identity does not change with the palette), so this is a plain
 * JS ramp rather than a CSS token — it also feeds SVG `fill` attributes, which cannot resolve
 * CSS `var()`.
 *
 * The seven swatches and their order mirror `FinxChartPalettes.category` in the Android app
 * (`core/design/.../FinxColors.kt`); the last one is the "unknown category" grey. Changing
 * either side breaks cross-platform parity.
 */
const RAMP_RGB = [
  "248, 113, 113", // red
  "96, 165, 250",  // blue
  "251, 191, 36",  // amber
  "139, 92, 246",  // violet
  "16, 185, 129",  // emerald
  "244, 114, 182", // pink
  "209, 213, 219", // grey — also the blank-name fallback
];

/** rgba(...,0.85) strings — the default fill used by the donut, legend dots and chips. */
export const CATEGORY_RAMP = RAMP_RGB.map((rgb) => `rgba(${rgb}, 0.85)`);

/**
 * The same seven hues darkened until the label reaches 5.3:1 against its own tint on a white card,
 * comfortably past the 4.5:1 AA floor, which is what every light palette uses as the card surface. Same hue ratios, only
 * scaled toward black, so a category still reads as "the red one" in either theme. The dark
 * themes use the undarkened swatch directly — there it already measures 6.2:1 or better.
 */
const RAMP_RGB_ON_LIGHT = [
  "154, 70, 70",
  "58, 100, 151",
  "128, 97, 18",
  "106, 70, 188",
  "10, 111, 77",
  "149, 70, 111",
  "101, 103, 106",
];

/**
 * The label colour on the dark themes. Six of the seven clear 5.3:1 unchanged against their own 18%
 * tint; violet measures 4.05:1, so it alone is lifted toward white until it does too.
 */
const RAMP_RGB_ON_DARK = [
  "248, 113, 113",
  "96, 165, 250",
  "251, 191, 36",
  "159, 120, 248",
  "16, 185, 129",
  "244, 114, 182",
  "209, 213, 219",
];

/** Structured swatches for the SVG charts that need a fill + an opaque hover + the raw rgb. */
export const CATEGORY_SWATCHES = RAMP_RGB.map((rgb, i) => ({
  main: `rgba(${rgb}, 0.85)`,
  hover: `rgba(${rgb}, 1)`,
  rgb,
  rgbOnLight: RAMP_RGB_ON_LIGHT[i],
  rgbOnDark: RAMP_RGB_ON_DARK[i],
}));

/**
 * Java's `String.hashCode`, reproduced exactly (32-bit signed overflow via Math.imul) so a
 * category lands on the same ramp slot here as it does on Android.
 *
 * @param {string} s
 * @returns {number} 32-bit signed hash
 */
function javaStringHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * The colour for one category name. Depends on the name alone, so it is stable across screens,
 * across paginated loads, and across platforms. A blank or missing name gets the grey swatch.
 *
 * Ceiling: seven swatches means two unrelated categories can share a hue. That collision is
 * inherited from the Android palette on purpose — parity beats per-screen distinctness.
 *
 * @param {string|null|undefined} name
 * @returns {string} rgba colour
 */
export function categoryColor(name) {
  if (name == null || String(name).trim() === "") return CATEGORY_RAMP[CATEGORY_RAMP.length - 1];
  const h = javaStringHash(String(name).toLowerCase());
  const idx = ((h % CATEGORY_RAMP.length) + CATEGORY_RAMP.length) % CATEGORY_RAMP.length;
  return CATEGORY_RAMP[idx];
}

/**
 * Build a name -> colour map for a set of categories. A convenience wrapper over
 * `categoryColor`; the map holds no state, so adding names never moves an existing one.
 *
 * @param {string[]} names
 * @returns {Map<string, string>} name -> rgba colour
 */
export function assignCategoryColors(names) {
  const map = new Map();
  for (const raw of names) {
    if (raw == null) continue;
    const name = String(raw);
    if (!map.has(name)) map.set(name, categoryColor(name));
  }
  return map;
}

/**
 * The structured swatch for one category name — same slot as `categoryColor`, but exposing the
 * raw rgb so a chip can paint the Android badge treatment (accent at 18% as the ground, accent
 * itself as the label) instead of a solid fill.
 *
 * @param {string|null|undefined} name
 * @returns {{main: string, hover: string, rgb: string}}
 */
export function categorySwatch(name) {
  const idx = CATEGORY_RAMP.indexOf(categoryColor(name));
  return CATEGORY_SWATCHES[idx];
}

/**
 * Inline custom properties for the `.badge-category` chip: the tint hue plus its two pre-checked
 * label colours, so the chip follows the theme in CSS without a re-render.
 *
 * @param {string|null|undefined} name
 * @returns {Record<string, string>}
 */
export function categoryChipStyle(name) {
  const sw = categorySwatch(name);
  return { "--cat-rgb": sw.rgb, "--cat-fg-light": sw.rgbOnLight, "--cat-fg-dark": sw.rgbOnDark };
}
