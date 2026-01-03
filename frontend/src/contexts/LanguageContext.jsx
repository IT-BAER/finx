import { createContext, useState, useEffect, useContext } from "react";

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    // Check for saved language preference
    const savedLanguage = localStorage.getItem("language");
    if (savedLanguage) {
      setLanguage(savedLanguage);
      return;
    }

    // Auto-detect browser language
    const browserLanguage = navigator.language || navigator.languages[0];
    const supportedLanguages = [
      "en",
      "de",
      "es",
      "fr",
      "it",
      "nl",
      "pl",
      "pt",
      "ru",
      "zh",
    ];
    const detectedLanguage =
      supportedLanguages.find((lang) => browserLanguage.startsWith(lang)) ||
      "en";

    setLanguage(detectedLanguage);
  }, []);

  const changeLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    localStorage.setItem("language", newLanguage);
  };

  const value = {
    language,
    changeLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
