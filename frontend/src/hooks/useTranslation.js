import { useMemo } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import enTranslations from "../translations/en";
import deTranslations from "../translations/de";
import esTranslations from "../translations/es";
import frTranslations from "../translations/fr";
import itTranslations from "../translations/it";
import nlTranslations from "../translations/nl";
import plTranslations from "../translations/pl";
import ptTranslations from "../translations/pt";
import ruTranslations from "../translations/ru";
import zhTranslations from "../translations/zh";

const translations = {
  en: enTranslations,
  de: deTranslations,
  es: esTranslations,
  fr: frTranslations,
  it: itTranslations,
  nl: nlTranslations,
  pl: plTranslations,
  pt: ptTranslations,
  ru: ruTranslations,
  zh: zhTranslations,
};

const locales = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
  it: "it-IT",
  nl: "nl-NL",
  pl: "pl-PL",
  pt: "pt-PT",
  ru: "ru-RU",
  zh: "zh-CN",
};

export const useTranslation = () => {
  const { language } = useLanguage();

  const t = useMemo(() => {
    return (key, params = {}) => {
      if (!key) return "";

      const keys = key.split(".");
      let translation = translations[language] || translations.en;

      for (const k of keys) {
        translation = translation[k];
        if (!translation) return key; // Return the key if translation not found
      }

      // Handle interpolation
      if (typeof translation === "string" && Object.keys(params).length > 0) {
        return translation.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
          return params[paramKey] !== undefined ? params[paramKey] : match;
        });
      }

      return translation;
    };
  }, [language]);

  // Date formatting based on language
  const formatDate = useMemo(() => {
    return (date) => {
      if (!date) return "";

      const dateObj = new Date(date);
      const options = {
        year: "numeric",
        month: "short",
        day: "numeric",
      };

      // Use different locales based on selected language
      const locale = locales[language] || "en-US";
      return dateObj.toLocaleDateString(locale, options);
    };
  }, [language]);

  // Currency formatting based on language
  const formatCurrency = useMemo(() => {
    return (amount) => {
      if (amount === undefined || amount === null) return "";

      const locale = locales[language] || "en-US";
      const currency = language === "en" ? "USD" : "EUR"; // Simplified currency logic for now, or match app logic

      // If specific custom formatting is needed per language, valid, otherwise standard Intl
      if (language === "de") {
        // Keep existing custom German format if desired
        return (
          "€ " +
          new Intl.NumberFormat("de-DE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
            .format(amount)
            .replace("€", "")
            .trim()
        );
      }

      // Default formatting
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency,
      }).format(amount);
    };
  }, [language]);

  return { t, language, formatDate, formatCurrency };
};
