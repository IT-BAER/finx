const MAX_FIELD_LEN = 2000;
const MAX_ITEM_LEN = 64;
const MAX_ITEMS = 200;
const MAX_TOTAL_ARR_BYTES = 8000;

// Control chars except \n (0x0A) and \t (0x09).
const CTRL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/g;
const WHITESPACE_RE = /[\r\n\t]+/g;

const sanitizeText = (raw, maxLen = MAX_FIELD_LEN) => {
  if (typeof raw !== "string") return "";
  return raw.replace(CTRL_RE, " ").trim().slice(0, maxLen);
};

const sanitizeStringArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  const out = [];
  let total = 0;
  for (const item of arr) {
    if (typeof item !== "string") continue;
    const cleaned = item
      .replace(WHITESPACE_RE, " ")
      .replace(CTRL_RE, " ")
      .trim()
      .slice(0, MAX_ITEM_LEN);
    if (!cleaned) continue;
    if (total + cleaned.length + 2 > MAX_TOTAL_ARR_BYTES) break;
    out.push(cleaned);
    total += cleaned.length + 2;
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
};

module.exports = {
  sanitizeText,
  sanitizeStringArray,
  MAX_FIELD_LEN,
  MAX_ITEM_LEN,
  MAX_ITEMS,
  MAX_TOTAL_ARR_BYTES,
};
