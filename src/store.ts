import { create } from "zustand";
import { initializeStore, themes } from './store/initStore';
import { Theme, ThemeType, ModelConfig, ProviderSettings, ProviderType } from './types';

interface ThemeStore {
  themeType: ThemeType;
  theme: Theme;
  toggleTheme: () => void;
  initialized: boolean;
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

interface ModelStore {
  config: ModelConfig;
  initialized: boolean;
  setConfig: (config: ModelConfig) => void;
  updateProviderSettings: (provider: ProviderType, settings: ProviderSettings) => void;
  setActiveProvider: (provider: ProviderType) => void;
}

export interface Message {
  id: string;
  content: string;
  role: string;
  timestamp: string;
  model?: string;
  reactions?: {
    thumbsUp: number;
  };
  isEditing?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  model: string;
  messageCount: number;
  timestamp: string;
}

const THEME_STORAGE_KEY = "theme";
const MODEL_CONFIG_STORAGE_KEY = "model_config";

const applyTheme = (themeType: ThemeType, theme: Theme) => {
  requestAnimationFrame(() => {
    document.documentElement.classList.toggle("dark", themeType === "dark");
    Object.entries(theme).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--${key}`, value);
    });
  });
};

export const useThemeStore = create<ThemeStore>((set) => ({
  themeType: "light",
  theme: themes.light,
  initialized: false,
  toggleTheme: () =>
    set((state) => {
      const newThemeType = state.themeType === "light" ? "dark" : "light";
      const newTheme = themes[newThemeType];

      applyTheme(newThemeType, newTheme);
      localStorage.setItem(THEME_STORAGE_KEY, newThemeType);

      return { themeType: newThemeType, theme: newTheme };
    }),
}));

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

export const useModelStore = create<ModelStore>((set) => ({
  config: {
    active_provider: "anthropic" as ProviderType,
    providers: {
      anthropic: {
        api_key: "",
        model: "claude-3-sonnet-20240320",
        parameters: {
          max_tokens: 1024,
          streaming: true,
          temperature: 0.7,
          top_p: 1,
          top_k: 5
        },
        customParameters: {},
      },
      openai: {
        api_key: "",
        model: "gpt-4-turbo-preview",
        parameters: {
          max_tokens: 1024,
          streaming: true,
          temperature: 0.7,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
          tool_calls: false,
          tool_choice: "none"
        },
        customParameters: {},
      },
      openrouter: {
        api_key: "",
        model: "anthropic/claude-3-opus",
        parameters: {
          max_tokens: 1024,
          streaming: true,
          temperature: 0.7,
          top_p: 1,
          top_k: 5,
          presence_penalty: 0,
          frequency_penalty: 0
        },
        customParameters: {},
      },
    } as Record<ProviderType, ProviderSettings>
  },
  initialized: false,
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
}));

// Initialize stores asynchronously
initializeStore().then(({ theme, modelConfig }) => {
  useThemeStore.setState({ 
    themeType: theme.type, 
    theme: theme.values,
    initialized: true 
  });
  useModelStore.setState({ 
    config: modelConfig,
    initialized: true 
  });
  
  // Apply theme after initialization
  applyTheme(theme.type, theme.values);
});

export const useZustandTheme = () => {
  const store = useThemeStore();
  if (!store.initialized) {
    return { 
      theme: themes.light, 
      themeType: "light" as const, 
      toggleTheme: store.toggleTheme,
      initialized: false 
    };
  }
  return store;
};
