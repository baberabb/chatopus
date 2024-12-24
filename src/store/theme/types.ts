export interface Theme {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  shadowColor: string;
}

export type ThemeType = 'light' | 'dark';

export interface ThemeState {
  themeType: ThemeType;
  theme: Theme;
  initialized: boolean;
  toggleTheme: () => void;
}

export const themes: Record<ThemeType, Theme> = {
  light: {
    background: '#ffffff',
    surface: '#f8f9fa',
    text: '#1a1a1a',
    textSecondary: '#6c757d',
    border: '#e9ecef',
    shadowColor: '#000000'
  },
  dark: {
    background: '#1a1a1a',
    surface: '#2d2d2d',
    text: '#ffffff',
    textSecondary: '#a1a1aa',
    border: '#404040',
    shadowColor: '#000000'
  }
};
