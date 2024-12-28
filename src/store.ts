import { create } from "zustand";
import { initializeStore, themes } from './store/initStore';
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { logger } from "./utils/logger";
import {
  createOptimisticMessage,
  createOptimisticAssistantMessage,
  isOptimisticMessage,
} from "./store/optimistic";
import {
  ChatState,
  ThemeStore,
  ModelStore,
  ModelConfig,
  Message,
  Conversation,
  Theme,
  ThemeType,
  ProviderSettings,
  ProviderType,
  FileAttachment
} from "./types";

// Handle stream events
listen("stream-response", (event) => {
  const chunk = event.payload as string;
  const lastMessage = useChatStore.getState().messages[useChatStore.getState().messages.length - 1];
  if (lastMessage?.status === 'streaming') {
    useChatStore.getState().appendStreamChunk(chunk);
  }
});

// Handle stream completion
listen("stream-complete", () => {
  const messages = useChatStore.getState().messages;
  const lastIndex = messages.length - 1;
  const lastMessage = messages[lastIndex];
  
  if (lastMessage?.status === 'streaming') {
    logger.state('Store', {
      action: 'completeStream',
      messageId: lastMessage.id,
      before: {
        messageStatus: lastMessage.status
      }
    });

    // Only create new object for the last message
    const updatedMessage = {
      ...lastMessage,
      status: 'complete' as const
    };

    // Create new array with same references except last message
    const updatedMessages = [...messages];
    updatedMessages[lastIndex] = updatedMessage;

    useChatStore.setState({ messages: updatedMessages });

    logger.state('Store', {
      action: 'completeStream',
      messageId: lastMessage.id,
      after: {
        messageStatus: updatedMessage.status
      }
    });
  }
});

// Selectors for granular state updates
// const messageSelector = (state: ChatState) => state.messages;
// const conversationSelector = (state: ChatState) => ({
//   conversations: state.conversations,
//   currentConversationId: state.currentConversationId
// });
// const systemMessageSelector = (state: ChatState) => state.systemMessage;
// const errorSelector = (state: ChatState) => state.error;
// const loadingSelector = (state: ChatState) => state.isLoading;

// Split store into smaller stores for more granular updates
export const useChatStore = create<ChatState>((set, get) => ({
  // Core message state - only updates for streaming/editing
  messages: [],
  error: null,
  isLoading: false,
  initialized: false,

  // Conversation metadata - only updates when conversation list changes
  conversations: [],
  currentConversationId: null,

  // System message state - only updates when system message changes
  systemMessage: null as string | null,

  // Message actions
  sendMessage: async (content: string, attachments?: FileAttachment[]) => {
    try {
      // Get current model from model store
      const modelStore = useModelStore.getState();
      const config = modelStore.config;
      const currentModel = config?.providers[config.active_provider]?.model;

      // Create optimistic messages
      const userMessage = createOptimisticMessage(content, 'user', 'complete', attachments);
      const assistantMessage = createOptimisticAssistantMessage(currentModel);

      // Update UI immediately with new messages
      set(state => ({
        messages: [...state.messages, userMessage, assistantMessage],
        error: null
      }));

      // Process message - backend handles conversation creation
      const response = await invoke<{ reply: string, user_message_id: number, assistant_message_id: number, conversation_id: number }>('process_message', { 
        request: {
          message: content,
          conversation_id: get().currentConversationId,
          attachments: attachments || []
        }
      });

      // Update state with real IDs - optimize by doing single pass
      set(state => {
        const messages = [...state.messages];
        // Find and update both messages in one pass
        for (let i = messages.length - 2; i < messages.length; i++) {
          const msg = messages[i];
          if (msg.id === userMessage.id) {
            messages[i] = { ...msg, id: response.user_message_id };
          } else if (msg.id === assistantMessage.id) {
            messages[i] = { ...msg, id: response.assistant_message_id };
          }
        }
        return {
          currentConversationId: response.conversation_id,
          messages
        };
      });

      // Load conversation list in background
      // get().loadConversations();

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
    const messages = get().messages;
    const lastIndex = messages.length - 1;
    const lastMessage = messages[lastIndex];
    
    if (lastMessage?.status === 'streaming') {
      logger.state('Store', {
        action: 'appendStreamChunk',
        messageId: lastMessage.id,
        before: {
          contentLength: lastMessage.content.length,
          chunkLength: chunk.length
        }
      });

      // Only create new object for the last message
      const updatedMessage = {
        ...lastMessage,
        content: lastMessage.content + chunk
      };

      // Create new array with same references except last message
      const updatedMessages = [...messages];
      updatedMessages[lastIndex] = updatedMessage;

      set({ messages: updatedMessages });

      logger.state('Store', {
        action: 'appendStreamChunk',
        messageId: lastMessage.id,
        after: {
          contentLength: updatedMessage.content.length
        }
      });
    }
  },

  setMessages: (messages: Message[]) => set({ messages }),
  
  updateLastMessage: (content: string) => {
    const messages = get().messages;
    const lastIndex = messages.length - 1;
    const lastMessage = messages[lastIndex];
    
    if (lastMessage) {
      // Only create new object for the last message
      const updatedMessage = {
        ...lastMessage,
        content
      };

      // Create new array with same references except last message
      const updatedMessages = [...messages];
      updatedMessages[lastIndex] = updatedMessage;

      set({ messages: updatedMessages });
    }
  },

  clearMessages: () => set({ 
    messages: [],
    error: null,
    systemMessage: null
  }),

  cancelMessage: async () => {
    try {
      await invoke('cancel_message');
      const messages = get().messages;
      const lastIndex = messages.length - 1;
      const lastMessage = messages[lastIndex];
      
      if (lastMessage?.status === 'streaming') {
        logger.state('Store', {
          action: 'cancelMessage',
          messageId: lastMessage.id,
          before: {
            messageStatus: lastMessage.status
          }
        });

        // Only create new object for the last message
        const updatedMessage = {
          ...lastMessage,
          status: 'error' as const
        };

        // Create new array with same references except last message
        const updatedMessages = [...messages];
        updatedMessages[lastIndex] = updatedMessage;

        set({ messages: updatedMessages });

        logger.state('Store', {
          action: 'cancelMessage',
          messageId: lastMessage.id,
          after: {
            messageStatus: updatedMessage.status
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
    set({ isLoading: true, error: null }); // Clear any previous errors
    try {
      const conversations = await invoke<Conversation[]>('get_conversations');
      // Sort conversations by most recent first
      conversations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      set({ 
        conversations,
        isLoading: false,
        error: null
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load conversations';
      console.error('Load conversations error:', errorMessage);
      set({ 
        error: errorMessage,
        isLoading: false,
        conversations: [] // Clear conversations on error
      });
      throw error; // Re-throw to handle in UI
    }
  },

  loadConversation: async (id: number) => {
    set({ isLoading: true, error: null }); // Clear any previous errors
    try {
      // Ensure the conversation exists in our list first
      const conversations = get().conversations;
      const conversationExists = conversations.some(c => c.id === id);
      if (!conversationExists) {
        throw new Error('Conversation not found');
      }

      const [messages, conversation] = await Promise.all([
        invoke<Message[]>('load_conversation_messages', { conversationId: id }),
        invoke<Conversation>('get_conversation', { id })
      ]);
      
      // Update states separately to minimize re-renders
      set({ 
        messages,
        currentConversationId: id,
        systemMessage: conversation.systemMessage || null,
        isLoading: false,
        error: null
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load conversation';
      console.error('Load conversation error:', errorMessage);
      set({ 
        error: errorMessage,
        isLoading: false,
        messages: [], // Clear messages on error
        systemMessage: null // Clear system message on error
      });
      throw error; // Re-throw to handle in UI
    }
  },

  setCurrentConversationId: async (id: number | null) => {
    if (id === get().currentConversationId) return;
    
    set({ 
      currentConversationId: id,
      error: null // Clear any previous errors
    });
    
    if (id) {
      try {
        set({ isLoading: true });
        await get().loadConversation(id);
      } catch (error) {
        // Error is already set by loadConversation
        set({ currentConversationId: null }); // Reset on error
      }
    } else {
      set({ messages: [] });
    }
  },

  createConversation: async () => {
    try {
      set({ 
        currentConversationId: null, 
        messages: [],
        error: null,
        systemMessage: null,
        isLoading: true
      });

      // Create new conversation and get its ID
      const newId = await invoke<number>('create_new_convos');
      console.log('New conversation ID:', newId);
      
      // Load all conversations to get the new one
      const conversations = await invoke<Conversation[]>('get_conversations');
      console.log('All conversations:', conversations);
      const newConversation = conversations.find(c => c.id === newId);
      
      if (!newConversation) {
        throw new Error('Failed to find newly created conversation');
      }
      
      // Update conversations list and set current conversation
      // #TODO: this might be messing up state. maybe
      //  set(state => ({
      //   conversations: [newConversation, ...state.conversations],
      //   isLoading: false
      // }));
      set(state => ({
        conversations: [newConversation, ...state.conversations],
        currentConversationId: newId,
        messages: [], // Ensure messages are cleared
        systemMessage: null, // Ensure system message is cleared
        isLoading: false,
        error: null // Clear any previous errors
      }));

      return newId;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create conversation',
        isLoading: false 
      });
      throw error; // Re-throw to handle in UI
    }
  },

  updateConversation: async (id: number, updates: Partial<Conversation>) => {
    try {
      await invoke('update_conversation', { id, updates });
      
      // Handle system message updates separately
      if ('systemMessage' in updates) {
        set({ systemMessage: updates.systemMessage || null });
      }
      
      // Only reload conversations if metadata changed (title, preview, etc)
      const metadataChanged = Object.keys(updates).some(key => 
        key !== 'systemMessage' && key !== 'messages'
      );
      
      if (metadataChanged) {
        await get().loadConversations();
      }
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
        error: null,
        systemMessage: null
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

export const useModelStore = create<ModelStore>((set, get) => ({
  config: null,
  initialized: false,
  setConfig: async (config) => {
    try {
      await invoke('update_config', { newConfig: config });
      set({ config });
    } catch (error) {
      console.error('Failed to update config:', error);
      throw error;
    }
  },
  updateProviderSettings: async (provider, settings) => {
    try {
      const currentConfig = get().config;
      if (!currentConfig) {
        throw new Error('Config not initialized');
      }

      await invoke('update_provider_settings', { provider, settings });
      
      set((state) => ({
        config: {
          active_provider: currentConfig.active_provider,
          providers: {
            ...currentConfig.providers,
            [provider]: settings
          }
        }
      }));
    } catch (error) {
      console.error('Failed to update provider settings:', error);
      throw error;
    }
  },
  setActiveProvider: async (provider) => {
    try {
      const currentConfig = get().config;
      if (!currentConfig) {
        throw new Error('Config not initialized');
      }

      if (provider === currentConfig.active_provider) return;
      
      await invoke('set_active_provider', { provider });
      
      set((state) => ({
        config: {
          active_provider: provider,
          providers: currentConfig.providers
        }
      }));
    } catch (error) {
      console.error('Failed to set active provider:', error);
      throw error;
    }
  },
}));

const THEME_STORAGE_KEY = "theme";

const applyTheme = (themeType: ThemeType, theme: Theme) => {
  requestAnimationFrame(() => {
    document.documentElement.classList.toggle("dark", themeType === "dark");
    Object.entries(theme).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--${key}`, value);
    });
  });
};

// Initialize stores asynchronously
(async () => {
  try {
    // Get initial config from backend
    const config = await invoke<ModelConfig>('get_config');
    useModelStore.setState({ config, initialized: true });

    // Initialize theme
    const { theme } = await initializeStore();
    useThemeStore.setState({ 
      themeType: theme.type, 
      theme: theme.values,
      initialized: true 
    });
    applyTheme(theme.type, theme.values);

    // Load conversations
    await useChatStore.getState().loadConversations();
    useChatStore.setState({ initialized: true });
  } catch (error) {
    console.error('Failed to initialize stores:', error);
  }
})();

// Hooks for accessing specific parts of state
export const useMessages = () => useChatStore((state: ChatState) => state.messages);
export const useConversations = () => useChatStore((state: ChatState) => ({
  conversations: state.conversations,
  currentConversationId: state.currentConversationId
}));
export const useSystemMessage = () => useChatStore((state: ChatState) => state.systemMessage);
export const useChatError = () => useChatStore((state: ChatState) => state.error);
export const useChatLoading = () => useChatStore((state: ChatState) => state.isLoading);

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
