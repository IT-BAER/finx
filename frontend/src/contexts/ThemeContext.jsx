import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};

// Function to update theme color meta tag
function updateThemeColorMeta(theme, darkMode) {
  // Define theme colors for light and dark modes
  const themeColors = {
    default: { light: "#ffffff", dark: "#111827" },
    ocean: { light: "#ffffff", dark: "#0b2533" },
    forest: { light: "#ffffff", dark: "#0f2417" },
    rose: { light: "#ffffff", dark: "#2a0f19" },
  };

  // Get the appropriate color based on theme and mode
  const color =
    (themeColors[theme] && themeColors[theme][darkMode ? "dark" : "light"]) ||
    "#ffffff";

  // Update theme-color meta tag
  let themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.content = color;
  } else {
    themeColorMeta = document.createElement("meta");
    themeColorMeta.name = "theme-color";
    themeColorMeta.content = color;
    document.head.appendChild(themeColorMeta);
  }
}

// Define available themes and labels (could be i18n-ed later)
export const AVAILABLE_THEMES = [
  { key: "default", label: "Default" },
  { key: "ocean", label: "Ocean" },
  { key: "forest", label: "Forest" },
  { key: "rose", label: "Rose" },
];

export const ThemeProvider = ({ children }) => {
  const { user, refreshUser } = useAuth();

  // theme: palette name (default/ocean/forest/rose)
  const [theme, setTheme] = useState(user?.theme || "default");
  // dark: brightness mode independent of palette
  const [dark, setDark] = useState(() => {
    if (user) {
      // Use user's preference if set, otherwise use system preference
      return user.dark_mode === null
        ? window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
        : user.dark_mode;
    }
    // Use system preference when no user is logged in
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });

  // Apply palette and brightness to documentElement
  useEffect(() => {
    const root = document.documentElement;

    // Set current palette
    root.setAttribute("data-theme", theme);

    // Toggle Tailwind dark class and allow CSS variables to adapt via [data-theme="..."] + .dark
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Update theme color meta tag
    updateThemeColorMeta(theme, dark);
  }, [theme, dark]);

  // Update theme when user changes
  useEffect(() => {
    if (user) {
      setTheme(user.theme || "default");
      // Use user's preference if set, otherwise use system preference
      setDark(
        user.dark_mode === null
          ? window.matchMedia &&
              window.matchMedia("(prefers-color-scheme: dark)").matches
          : user.dark_mode,
      );
    } else {
      // Use system preference when user is not logged in
      setTheme("default");
      setDark(
        window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches,
      );
    }
  }, [user]);

  // Listen for system dark mode changes when no user is logged in
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = (e) => {
      // Only update if no user is logged in
      if (!user) {
        setDark(e.matches);
      }
    };

    // Set initial value
    if (!user) {
      setDark(mediaQuery.matches);
    }

    // Listen for changes
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [user]);

  const isDark = dark;

  const toggleDark = async () => {
    const newDark = !dark;
    setDark(newDark);

    // If user is logged in, update their preference in the database
    if (user) {
      try {
        await refreshUser({ dark_mode: newDark });
      } catch (error) {
        console.error("Failed to update dark mode preference:", error);
      }
    }
  };

  const setThemeAndSave = async (newTheme) => {
    setTheme(newTheme);

    // If user is logged in, update their preference in the database
    if (user) {
      try {
        await refreshUser({ theme: newTheme });
      } catch (error) {
        console.error("Failed to update theme preference:", error);
      }
    }
  };

  const value = useMemo(
    () => ({
      theme, // palette
      setTheme: setThemeAndSave, // set palette and save to user profile
      dark: isDark, // brightness flag
      toggleDark, // toggle brightness
      isDark: isDark, // backward alias
      themes: AVAILABLE_THEMES,
    }),
    [theme, isDark, user],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
