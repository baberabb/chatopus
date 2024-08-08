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
  shadowColor: string; // New shadow color property

}

export const themes: Record<ThemeType, Theme> = {
  light: {
    background: "#FFFFFF",
    surface: "#F5F5F5",
    border: "#E6E6E6",
    text: "#333333",
    textSecondary: "#757575",
    shadowColor: "rgba(0, 0, 0, 0.1)", // New shadow color for light theme

  },
  dark: {
    background: "#2C3E50",
    surface: "#34495E",
    border: "#4A5568",
    text: "#E2E8F0",
    textSecondary: "#A0AEC0",
    shadowColor: "rgba(0, 0, 0, 0.2)", // New shadow color for dark theme


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

// import { create } from 'zustand'
// import { persist } from 'zustand/middleware'
//
// export const themes = {
//     light: {
//         background: "#FFFFFF",
//         surface: "#F5F5F5",
//         border: "#E6E6E6",
//         text: "#333333",
//         textSecondary: "#757575",
//     },
//     dark: {
//         background: "#2C3E50",
//         surface: "#34495E",
//         border: "#4A5568",
//         text: "#E2E8F0",
//         textSecondary: "#A0AEC0",
//     },
// };
//
// type ThemeType = 'light' | 'dark';
//
// interface GlobalState {
//     // Theme
//     themeType: ThemeType;
//     theme: typeof themes.light | typeof themes.dark;
//     toggleTheme: () => void;
//
//     // User
//     user: { id: string; name: string } | null;
//     setUser: (user: { id: string; name: string } | null) => void;
//
//     // Current View
//     currentView: string;
//     setCurrentView: (view: string) => void;
//
//     // Sidebar
//     isSidebarOpen: boolean;
//     toggleSidebar: () => void;
//     setSidebarOpen: (isOpen: boolean) => void;
//
//     // You can add more global state here as needed
// }
//
// const useStore = create<GlobalState>()(
//     persist(
//         (set, get) => ({
//             // Theme
//             themeType: 'light',
//             theme: themes.light,
//             toggleTheme: () => {
//                 const newThemeType = get().themeType === 'light' ? 'dark' : 'light';
//                 set({
//                     themeType: newThemeType,
//                     theme: themes[newThemeType]
//                 });
//                 applyTheme(newThemeType);
//             },
//
//             // User
//             user: null,
//             setUser: (user) => set({ user }),
//
//             // Current View
//             currentView: 'chat',
//             setCurrentView: (view) => set({ currentView: view }),
//
//             // Sidebar
//             isSidebarOpen: false,
//             toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
//             setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
//
//             // Add more state and actions as needed
//         }),
//         {
//             name: 'global-store',
//             getStorage: () => localStorage,
//         }
//     )
// );
//
// const applyTheme = (newTheme: ThemeType) => {
//     if (newTheme === "dark") {
//         document.documentElement.classList.add("dark");
//     } else {
//         document.documentElement.classList.remove("dark");
//     }
//     document.body.style.backgroundColor = themes[newTheme].background;
//     document.body.style.color = themes[newTheme].text;
// };
//
// export default useStore;
