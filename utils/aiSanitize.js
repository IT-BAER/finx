const MAX_FIELD_LEN = 2000;
const MAX_ITEM_LEN = 64;
const MAX_ITEMS = 200;
const MAX_TOTAL_ARR_BYTES = 8000;

const WHITESPACE_RE = /[\r\n\t]+/g;

const isDisallowedControlChar = (char) => {
  const code = char.charCodeAt(0);
  return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
};

const replaceControlChars = (text) => {
  let out = "";
  let inControlRun = false;
  for (const char of text) {
    if (isDisallowedControlChar(char)) {
      if (!inControlRun) out += " ";
      inControlRun = true;
      continue;
    }
    out += char;
    inControlRun = false;
  }
  return out;
};

const sanitizeText = (raw, maxLen = MAX_FIELD_LEN) => {
  if (typeof raw !== "string") return "";
  return replaceControlChars(raw).trim().slice(0, maxLen);
};

const sanitizeStringArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  const out = [];
  let total = 0;
  for (const item of arr) {
    if (typeof item !== "string") continue;
    const cleaned = replaceControlChars(item.replace(WHITESPACE_RE, " "))
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
