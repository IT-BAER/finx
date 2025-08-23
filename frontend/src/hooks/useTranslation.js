import { useMemo } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import enTranslations from "../translations/en";
import deTranslations from "../translations/de";

const translations = {
  en: enTranslations,
  de: deTranslations,
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
      const locale = language === "de" ? "de-DE" : "en-US";
      return dateObj.toLocaleDateString(locale, options);
    };
  }, [language]);

  // Currency formatting based on language
  const formatCurrency = useMemo(() => {
    return (amount) => {
      if (amount === undefined || amount === null) return "";

      // Use different locales and currencies based on selected language
      if (language === "de") {
        // Format with € on the left side like $ with a space
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
      } else {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount);
      }
    };
  }, [language]);

  return { t, language, formatDate, formatCurrency };
};
