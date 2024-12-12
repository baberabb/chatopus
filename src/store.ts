import { create } from "zustand";

interface ThemeStore {
  themeType: ThemeType;
  theme: Theme;
  toggleTheme: () => void;
}

type ThemeType = "light" | "dark";

interface Theme {
  background: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  shadowColor: string;
}

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

const THEME_STORAGE_KEY = "theme";

const getInitialTheme = (): ThemeType => {
  const savedTheme = localStorage.getItem(
    THEME_STORAGE_KEY,
  ) as ThemeType | null;
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const applyTheme = (themeType: ThemeType, theme: Theme) => {
  document.documentElement.classList.toggle("dark", themeType === "dark");
  Object.entries(theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--${key}`, value);
  });
};

const useThemeStore = create<ThemeStore>((set) => {
  const initialThemeType = getInitialTheme();
  const initialTheme = themes[initialThemeType];

  // Apply initial theme
  applyTheme(initialThemeType, initialTheme);

  return {
    themeType: initialThemeType,
    theme: initialTheme,
    toggleTheme: () =>
      set((state) => {
        const newThemeType = state.themeType === "light" ? "dark" : "light";
        const newTheme = themes[newThemeType];

        applyTheme(newThemeType, newTheme);
        localStorage.setItem(THEME_STORAGE_KEY, newThemeType);

        return { themeType: newThemeType, theme: newTheme };
      }),
  };
});

export const useZustandTheme = () => useThemeStore();
