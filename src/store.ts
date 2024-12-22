import { create } from "zustand";
import { initializeStore, themes } from './store/initStore';
import { Theme, ThemeType, ModelConfig, ProviderSettings, ProviderType } from './types';
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface ThemeStore {
  themeType: ThemeType;
  theme: Theme;
  toggleTheme: () => void;
  initialized: boolean;
}

interface ChatStore {
  // State
  messages: Message[];
  conversations: Conversation[];
  currentConversationId: string | null;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
  isLoading: boolean;

  // Message actions
  sendMessage: (content: string) => Promise<void>;
  appendStreamChunk: (chunk: string) => void;
  completeStream: (messageId: string) => void;
  setMessages: (messages: Message[]) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;

  // Conversation actions
  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  setCurrentConversationId: (id: string | null) => Promise<void>;
  createConversation: () => Promise<string>;
  updateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
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
  status?: 'pending' | 'streaming' | 'complete' | 'error';
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

const createMessage = (content: string, role: string, status: Message['status'] = 'complete'): Message => ({
  id: crypto.randomUUID(),
  content,
  role,
  timestamp: new Date().toISOString(),
  status,
});

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

export const useChatStore = create<ChatStore>((set, get) => ({
  // State
  messages: [],
  conversations: [],
  currentConversationId: null,
  isStreaming: false,
  streamingContent: '',
  error: null,
  isLoading: false,

  // Message actions
  sendMessage: async (content: string) => {
    const state = get();
    if (!state.currentConversationId) {
      const newId = await state.createConversation();
      await state.setCurrentConversationId(newId);
    }

    // Add user message immediately
    const userMessage = createMessage(content, 'user');
    set(state => ({
      messages: [...state.messages, userMessage],
      error: null
    }));

    // Create empty assistant message
    const assistantMessage = createMessage('', 'assistant', 'streaming');
    set(state => ({
      messages: [...state.messages, assistantMessage],
      isStreaming: true,
      streamingContent: ''
    }));

    try {
      // Process message
      const response = await invoke<{ reply: string, message_id: string }>('process_message', { 
        message: content 
      });

      // Update assistant message with ID from backend
      set(state => ({
        messages: state.messages.map((msg, index) => 
          index === state.messages.length - 1
            ? { ...msg, id: response.message_id }
            : msg
        )
      }));

    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to send message',
        isStreaming: false 
      });

      // Mark assistant message as error
      set(state => ({
        messages: state.messages.map((msg, index) => 
          index === state.messages.length - 1
            ? { ...msg, status: 'error' }
            : msg
        )
      }));
    }
  },

  appendStreamChunk: (chunk: string) => {
    set(state => ({
      streamingContent: state.streamingContent + chunk,
      messages: state.messages.map((msg, index) => 
        index === state.messages.length - 1 
          ? { ...msg, content: state.streamingContent + chunk }
          : msg
      )
    }));
  },

  completeStream: (messageId: string) => {
    set(state => ({
      isStreaming: false,
      streamingContent: '',
      messages: state.messages.map(msg =>
        msg.id === messageId
          ? { ...msg, status: 'complete' }
          : msg
      )
    }));
  },

  setMessages: (messages) => set({ messages }),
  
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

  clearMessages: () => set({ 
    messages: [],
    streamingContent: '',
    isStreaming: false,
    error: null
  }),

  // Conversation actions
  loadConversations: async () => {
    set({ isLoading: true });
    try {
      const conversations = await invoke<Conversation[]>('get_conversations');
      set({ conversations, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load conversations',
        isLoading: false 
      });
    }
  },

  loadConversation: async (id: string) => {
    set({ isLoading: true });
    try {
      const messages = await invoke<Message[]>('load_conversation_messages', {
        conversationId: parseInt(id, 10)
      });
      set({ 
        messages,
        currentConversationId: id,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load conversation',
        isLoading: false 
      });
    }
  },

  setCurrentConversationId: async (id: string | null) => {
    if (id === get().currentConversationId) return;
    
    set({ currentConversationId: id });
    if (id) {
      await get().loadConversation(id);
    } else {
      set({ messages: [] });
    }
  },

  createConversation: async () => {
    try {
      const newId = await invoke<string>('clear_chat_history');
      await get().loadConversations();
      return newId;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create conversation' });
      throw error;
    }
  },

  updateConversation: async (id: string, updates: Partial<Conversation>) => {
    try {
      await invoke('update_conversation', { id: parseInt(id, 10), updates });
      await get().loadConversations();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update conversation' });
    }
  },

  deleteConversation: async (id: string) => {
    try {
      await invoke('delete_conversation', { conversationId: parseInt(id, 10) });
      
      // If deleted current conversation, clear it
      if (id === get().currentConversationId) {
        set({ currentConversationId: null, messages: [] });
      }
      
      await get().loadConversations();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete conversation' });
    }
  }
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

  // Load initial conversations
  useChatStore.getState().loadConversations();
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

// Set up event listeners
listen("stream-response", (event) => {
  const chunk = event.payload as string;
  if (useChatStore.getState().isStreaming) {
    useChatStore.getState().appendStreamChunk(chunk);
  }
});

listen("stream-complete", (event) => {
  const messageId = event.payload as string;
  useChatStore.getState().completeStream(messageId);
});
