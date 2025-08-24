import en from "../translations/en";
import de from "../translations/de";

const dictionaries = { en, de };

export function tRaw(key, params = {}) {
  if (!key) return "";
  let lang = "en";
  try {
    const saved = localStorage.getItem("language");
    if (saved && (saved === "en" || saved === "de")) lang = saved;
    else if (typeof navigator !== "undefined") {
      const browserLang = navigator.language || (navigator.languages && navigator.languages[0]);
      if (browserLang && browserLang.startsWith("de")) lang = "de";
    }
  } catch (_) {}

  const dict = dictionaries[lang] || dictionaries.en;
  const parts = key.split(".");
  let value = dict;
  for (const p of parts) {
    value = value?.[p];
    if (value === undefined) return key;
  }
  if (typeof value === "string" && params && Object.keys(params).length) {
    return value.replace(/\{\{(\w+)\}\}/g, (_m, k) => (params[k] !== undefined ? params[k] : _m));
  }
  return typeof value === "string" ? value : key;
}

export default tRaw;
