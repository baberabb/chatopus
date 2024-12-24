import { create } from 'zustand';
import { ThemeState, ThemeType, themes } from './types';

const THEME_STORAGE_KEY = 'theme';

const applyTheme = (themeType: ThemeType) => {
  requestAnimationFrame(() => {
    document.documentElement.classList.toggle('dark', themeType === 'dark');
    Object.entries(themes[themeType]).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--${key}`, value);
    });
  });
};

// Initialize theme from localStorage or default to light
const getInitialTheme = (): ThemeType => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return (stored as ThemeType) || 'light';
};

export const useThemeStore = create<ThemeState>((set) => {
  const initialTheme = getInitialTheme();
  
  // Apply initial theme
  applyTheme(initialTheme);
  
  return {
    themeType: initialTheme,
    theme: themes[initialTheme],
    initialized: true,
    toggleTheme: () => set((state) => {
      const newThemeType = state.themeType === 'light' ? 'dark' : 'light';
      const newTheme = themes[newThemeType];
      
      // Apply theme changes
      applyTheme(newThemeType);
      
      // Save to localStorage
      localStorage.setItem(THEME_STORAGE_KEY, newThemeType);
      
      return { 
        themeType: newThemeType, 
        theme: newTheme 
      };
    }),
  };
});
