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

export interface Message {
  id: string;
  content: string;
  role: string;
  timestamp: string;
  model?: string;  // Added model field
  reactions?: {
    thumbsUp: number;
  };
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  model: string;
  messageCount: number;
  timestamp: string;
}

interface ChatStore {
  messages: Message[];
  conversations: Conversation[];
  currentConversationId: string | null;
  setMessages: (messages: Message[]) => void;
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversationId: (id: string | null) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;
}

interface ProviderSettings {
  api_key: string;
  model: string;
  max_tokens: number;
  streaming: boolean;
}

interface ModelConfig {
  active_provider: string;
  providers: {
    [key: string]: ProviderSettings;
  };
}

interface ModelStore {
  config: ModelConfig;
  setConfig: (config: ModelConfig) => void;
  updateProviderSettings: (provider: string, settings: ProviderSettings) => void;
  setActiveProvider: (provider: string) => void;
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
const MODEL_CONFIG_STORAGE_KEY = "model_config";

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

const getInitialModelConfig = (): ModelConfig => {
  const savedConfig = localStorage.getItem(MODEL_CONFIG_STORAGE_KEY);
  if (savedConfig) {
    return JSON.parse(savedConfig);
  }
  return {
    active_provider: "anthropic",
    providers: {
      anthropic: {
        api_key: "",
        model: "claude-3-sonnet-20240320",
        max_tokens: 1024,
        streaming: true,
      },
      openai: {
        api_key: "",
        model: "gpt-4-turbo-preview",
        max_tokens: 1024,
        streaming: true,
      },
      openrouter: {
        api_key: "",
        model: "anthropic/claude-3-opus",
        max_tokens: 1024,
        streaming: true,
      },
    },
  };
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

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  conversations: [],
  currentConversationId: null,
  setMessages: (messages) => set({ messages }),
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  updateLastMessage: (content) => set((state) => {
    const messages = [...state.messages];
    if (messages.length > 0) {
      messages[messages.length - 1] = {
        ...messages[messages.length - 1],
        content
      };
    }
    return { messages };
  }),
  clearMessages: () => set({ messages: [] })
}));

export const useModelStore = create<ModelStore>((set) => {
  const initialConfig = getInitialModelConfig();

  return {
    config: initialConfig,
    setConfig: (config) => {
      localStorage.setItem(MODEL_CONFIG_STORAGE_KEY, JSON.stringify(config));
      set({ config });
    },
    updateProviderSettings: (provider, settings) =>
      set((state) => {
        const newConfig = {
          ...state.config,
          providers: {
            ...state.config.providers,
            [provider]: settings,
          },
        };
        localStorage.setItem(MODEL_CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
        return { config: newConfig };
      }),
    setActiveProvider: (provider) =>
      set((state) => {
        const newConfig = {
          ...state.config,
          active_provider: provider,
        };
        localStorage.setItem(MODEL_CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
        return { config: newConfig };
      }),
  };
});

export const useZustandTheme = () => useThemeStore();
