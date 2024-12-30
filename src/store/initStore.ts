import { Theme, ThemeType } from "../types";

export const themes: Record<ThemeType, Theme> = {
  light: {
    background: "#FFFFFF",
    surface: "#F5F5F5",
    border: "#E6E6E6",
    text: "#333333",
    textSecondary: "#757575",
    shadowColor: "rgba(0, 0, 0, 0.1)",
  },
  dark: {
    background: "#2C3E50",
    surface: "#34495E",
    border: "#4A5568",
    text: "#E2E8F0",
    textSecondary: "#A0AEC0",
    shadowColor: "rgba(0, 0, 0, 0.2)",
  },
};

export const initializeStore = async () => {
  // Theme initialization
  const getInitialTheme = async (): Promise<ThemeType> => {
    try {
      const savedTheme = localStorage.getItem("theme") as ThemeType | null;
      if (savedTheme === "light" || savedTheme === "dark") {
        return savedTheme;
      }
    } catch (error) {
      console.warn("Failed to read theme from localStorage:", error);
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const initialTheme = await getInitialTheme();

  return {
    theme: {
      type: initialTheme,
      values: themes[initialTheme],
    },
  };
};
