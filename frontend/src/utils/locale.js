/**
 * Get BCP 47 locale string from language code
 * Used for Intl.NumberFormat, toLocaleString, and other locale-aware APIs
 *
 * @param {string} language - Language code (e.g., 'en', 'de', 'es')
 * @returns {string} BCP 47 locale string (e.g., 'en-US', 'de-DE', 'es-ES')
 */
export const getLocaleString = (language) => {
  const localeMap = {
    en: "en-US",
    de: "de-DE",
    es: "es-ES",
    fr: "fr-FR",
    it: "it-IT",
    pt: "pt-PT",
    nl: "nl-NL",
    pl: "pl-PL",
    ru: "ru-RU",
    zh: "zh-CN",
  };
  return localeMap[language] || "en-US";
};

export default getLocaleString;
