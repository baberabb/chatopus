import { create } from "zustand";
import { initializeStore, themes } from './store/initStore';
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createGuard, StateGuard } from "./store/guards";
import { logger } from "./utils/logger";
import {
  createOptimisticMessage,
  createOptimisticAssistantMessage,
  updateMessageId,
  rollbackMessage,
  isOptimisticMessage,
  updateMessageContent,
  updateMessageStatus
} from "./store/optimistic";
import {
  ChatState,
  ThemeStore,
  ModelStore,
  Message,
  Conversation,
  Theme,
  ThemeType,
  ModelConfig,
  ProviderSettings,
  ProviderType
} from "./types";

// Only handle stream chunks - components handle completion
listen("stream-response", (event) => {
  const chunk = event.payload as string;
  const lastMessage = useChatStore.getState().messages[useChatStore.getState().messages.length - 1];
  if (lastMessage?.status === 'streaming') {
    useChatStore.getState().appendStreamChunk(chunk);
  }
});

export const useChatStore = create<ChatState>((set, get) => ({
  // State
  messages: [],
  conversations: [],
  currentConversationId: null,
  error: null,
  isLoading: false,

  // Message actions
  sendMessage: async (content: string) => {
    try {
      // Create optimistic messages
      const userMessage = createOptimisticMessage(content, 'user');
      const assistantMessage = createOptimisticAssistantMessage();

      // Update UI immediately with new messages
      set(state => ({
        messages: [...state.messages, userMessage, assistantMessage],
        error: null
      }));

      // Process message - backend handles conversation creation
      const response = await invoke<{ reply: string, user_message_id: number, assistant_message_id: number, conversation_id: number }>('process_message', { 
        request: {
          message: content,
          conversation_id: get().currentConversationId
        }
      });

      // Update state with real IDs
      set(state => ({
        currentConversationId: response.conversation_id,
        messages: updateMessageId(
          updateMessageId(state.messages, userMessage.id, response.user_message_id),
          assistantMessage.id,
          response.assistant_message_id
        )
      }));

      // Load conversation list in background
      get().loadConversations();

    } catch (error) {
      // Roll back optimistic updates on error
      const errorDetails = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Send message error:', errorDetails);
      set(state => ({
        messages: state.messages.filter(msg => !isOptimisticMessage(msg.id)),
        error: errorDetails
      }));
    }
  },

  appendStreamChunk: (chunk: string) => {
    const lastMessage = get().messages[get().messages.length - 1];
    if (lastMessage?.status === 'streaming') {
      logger.state('Store', {
        action: 'appendStreamChunk',
        messageId: lastMessage.id,
        before: {
          contentLength: lastMessage.content.length,
          chunkLength: chunk.length
        }
      });

      set(state => ({
        messages: updateMessageContent(state.messages, lastMessage.id, lastMessage.content + chunk)
      }));

      logger.state('Store', {
        action: 'appendStreamChunk',
        messageId: lastMessage.id,
        after: {
          contentLength: get().messages.find(m => m.id === lastMessage.id)?.content.length
        }
      });
    }
  },

  setMessages: (messages: Message[]) => set({ messages }),
  
  updateLastMessage: (content: string) => {
    const lastMessage = get().messages[get().messages.length - 1];
    if (lastMessage) {
      set(state => ({
        messages: updateMessageContent(state.messages, lastMessage.id, content)
      }));
    }
  },

  clearMessages: () => set({ 
    messages: [],
    error: null
  }),

  cancelMessage: async () => {
    try {
      await invoke('cancel_message');
      const lastMessage = get().messages[get().messages.length - 1];
      if (lastMessage?.status === 'streaming') {
        logger.state('Store', {
          action: 'cancelMessage',
          messageId: lastMessage.id,
          before: {
            messageStatus: lastMessage.status
          }
        });

        // Update message status
        set(state => ({
          messages: updateMessageStatus(state.messages, lastMessage.id, 'error')
        }));

        logger.state('Store', {
          action: 'cancelMessage',
          messageId: lastMessage.id,
          after: {
            messageStatus: get().messages.find(m => m.id === lastMessage.id)?.status
          }
        });
      }
    } catch (error) {
      const errorDetails = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Failed to cancel message:', errorDetails);
      set({ error: errorDetails });
    }
  },

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

  loadConversation: async (id: number) => {
    set({ isLoading: true });
    try {
      const messages = await invoke<Message[]>('load_conversation_messages', {
        conversationId: id
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

  setCurrentConversationId: async (id: number | null) => {
    if (id === get().currentConversationId) return;
    
    set({ currentConversationId: id });
    if (id) {
      await get().loadConversation(id);
    } else {
      set({ messages: [] });
    }
  },

  createConversation: async () => {
    // Always create a new conversation
    const newId = await invoke<number>('clear_chat_history');
    
    // Clear current state
    set({ 
      currentConversationId: null, 
      messages: [],
      error: null
    });
    
    // Load updated conversation list
    await get().loadConversations();
    return newId;
  },

  updateConversation: async (id: number, updates: Partial<Conversation>) => {
    try {
      await invoke('update_conversation', { id, updates });
      await get().loadConversations();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update conversation' });
    }
  },

  deleteConversation: async (id: number) => {
    // First clear local state if it's the current conversation
    if (id === get().currentConversationId) {
      set({ 
        currentConversationId: null, 
        messages: [],
        error: null
      });
    }

    // Then delete from backend
    await invoke('delete_conversation', { conversationId: id });
    await get().loadConversations();
  }
}));

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
