import React, { createContext, useState, useContext, useEffect } from "react";

export const themes = {
  light: {
    background: "#FFFFFF",
    surface: "#F5F5F5",
    border: "#E6E6E6",
    text: "#333333",
    textSecondary: "#757575",
  },
  dark: {
    background: "#2C3E50",
    surface: "#34495E",
    border: "#4A5568",
    text: "#E2E8F0",
    textSecondary: "#A0AEC0",
  },
};

export type ThemeContextType = {
  themeType: "light" | "dark";
  theme: typeof themes.light | typeof themes.dark;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themeType, setThemeType] = useState<"light" | "dark">(() => {
    // Initialize theme based on user preference or system setting
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    // Apply theme immediately when component mounts
    applyTheme(themeType);
  }, []);

  const applyTheme = (newTheme: "light" | "dark") => {
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    document.body.style.backgroundColor = themes[newTheme].background;
    document.body.style.color = themes[newTheme].text;
    localStorage.setItem("theme", newTheme);
  };

  const toggleTheme = () => {
    setThemeType((prevTheme) => {
      const newTheme = prevTheme === "light" ? "dark" : "light";
      applyTheme(newTheme);
      return newTheme;
    });
  };

  const value = {
    themeType,
    theme: themes[themeType],
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
