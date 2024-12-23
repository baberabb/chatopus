import { create } from "zustand";
import { initializeStore, themes } from './store/initStore';
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createGuard, StateGuard } from "./store/guards";
import {
  createOptimisticMessage,
  createOptimisticAssistantMessage,
  updateMessageId,
  rollbackMessage,
  isOptimisticMessage
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
} from "./store/types";

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

export const useChatStore = create<ChatState>((set, get) => {
  // Helper functions
  const updateMessage = (id: string, updates: Partial<Message>) => {
    set(state => ({
      messages: state.messages.map(msg =>
        msg.id === id ? { ...msg, ...updates } : msg
      )
    }));
  };

  const parseConversationId = (id: string | null) => {
    // Always return undefined for null/empty IDs to trigger new conversation creation
    if (!id) return undefined;
    const parsed = parseInt(id, 10);
    // Return undefined for invalid IDs to trigger new conversation creation
    return isNaN(parsed) ? undefined : parsed;
  };

  // Create state guard helper
  const guard = () => createGuard({
    messages: get().messages,
    isStreaming: get().isStreaming,
    isLoading: get().isLoading,
    currentConversationId: get().currentConversationId,
  });

  return {
    // State
    messages: [],
    conversations: [],
    currentConversationId: null,
    isStreaming: false,
    error: null,
    isLoading: false,

    // Message actions
    sendMessage: async (content: string) => {
      try {
        // Check if we can send message
        StateGuard.assertOperation(guard().canSendMessage());

        // Create optimistic messages
        const userMessage = createOptimisticMessage(content, 'user');
        const assistantMessage = createOptimisticAssistantMessage();

        // Update UI immediately with new messages
        set(state => ({
          messages: [...state.messages, userMessage, assistantMessage],
          error: null,
          isStreaming: true
        }));

        // Process message - backend handles conversation creation
        const response = await invoke<{ reply: string, message_id: string, conversation_id: string }>('process_message', { 
          request: {
            message: content,
            conversation_id: get().currentConversationId ? parseInt(get().currentConversationId) : undefined
          }
        });

        // Update state with real IDs
        set(state => ({
          currentConversationId: response.conversation_id.toString(),
          messages: updateMessageId(
            updateMessageId(state.messages, userMessage.id, response.message_id + '_user'),
            assistantMessage.id,
            response.message_id
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
          error: errorDetails,
          isStreaming: false 
        }));
      }
    },

    appendStreamChunk: (chunk: string) => {
      const lastMessage = get().messages[get().messages.length - 1];
      if (lastMessage?.status === 'streaming') {
        updateMessage(lastMessage.id, {
          content: lastMessage.content + chunk
        });
      }
    },

    completeStream: (messageId: string) => {
      updateMessage(messageId, { status: 'complete' });
      set({ isStreaming: false });
    },

    setMessages: (messages: Message[]) => set({ messages }),
    
    updateLastMessage: (content: string) => {
      const lastMessage = get().messages[get().messages.length - 1];
      if (lastMessage) {
        updateMessage(lastMessage.id, { content });
      }
    },

    clearMessages: () => set({ 
      messages: [],
      isStreaming: false,
      error: null
    }),

    cancelMessage: async () => {
      try {
        await invoke('cancel_message');
        const lastMessage = get().messages[get().messages.length - 1];
        if (lastMessage?.status === 'streaming') {
          updateMessage(lastMessage.id, {
            status: 'error',
            error: 'Message cancelled'
          });
        }
        set({ isStreaming: false });
      } catch (error) {
        console.error('Failed to cancel message:', error);
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

    loadConversation: async (id: string) => {
      try {
        // Check if we can switch conversation
        StateGuard.assertOperation(guard().canSwitchConversation());

        set({ isLoading: true });
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
      
      try {
        // Check if we can switch conversation
        if (id) {
          StateGuard.assertOperation(guard().canSwitchConversation());
        }

        set({ currentConversationId: id });
        if (id) {
          await get().loadConversation(id);
        } else {
          set({ messages: [] });
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to switch conversation' });
      }
    },

    createConversation: async () => {
      try {
        // Check if we can create conversation
        StateGuard.assertOperation(guard().canCreateConversation());

        // Always create a new conversation
        const newId = await invoke<string>('clear_chat_history');
        
        // Clear current state
        set({ 
          currentConversationId: null,
          messages: [],
          isStreaming: false,
          error: null
        });
        
        // Load updated conversation list
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
        // Check if we can delete conversation
        StateGuard.assertOperation(guard().canDeleteConversation(id));

        // First clear local state if it's the current conversation
        if (id === get().currentConversationId) {
          set({ 
            currentConversationId: null, 
            messages: [],
            isStreaming: false,
            error: null
          });
        }

        // Then delete from backend
        await invoke('delete_conversation', { conversationId: parseInt(id, 10) });
        await get().loadConversations();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to delete conversation' });
      }
    }
  };
});

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
