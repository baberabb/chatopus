import { create } from "zustand";
import { initializeStore, themes } from "./store/initStore";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { logger } from "./utils/logger";
import {
  ThemeStore,
  ModelStore,
  ModelConfig,
  Message,
  Conversation,
  Theme,
  ThemeType,
  FileAttachment,
} from "./types";

// Handle stream events
listen("stream-response", (event) => {
  const chunk = event.payload as string;
  const lastMessage =
    useChatStore.getState().messages[
      useChatStore.getState().messages.length - 1
    ];
  if (lastMessage?.status === "streaming") {
    useChatStore.getState().appendStreamChunk(chunk);
  }
});

// Handle stream completion
listen("stream-complete", () => {
  const messages = useChatStore.getState().messages;
  const lastIndex = messages.length - 1;
  const lastMessage = messages[lastIndex];

  if (lastMessage?.status === "streaming") {
    logger.state("Store", {
      action: "completeStream",
      messageId: lastMessage.id,
      before: {
        messageStatus: lastMessage.status,
      },
    });

    const updatedMessage = {
      ...lastMessage,
      status: "complete" as const,
    };

    const updatedMessages = [...messages];
    updatedMessages[lastIndex] = updatedMessage;

    useChatStore.setState({ messages: updatedMessages, isStreaming: false });

    logger.state("Store", {
      action: "completeStream",
      messageId: lastMessage.id,
      after: {
        messageStatus: updatedMessage.status,
      },
    });
  }
});

// ----------------------------------------
// Utility / Helper functions
// ----------------------------------------

function createTempIdGenerator() {
  let tempIdCounter = -1;
  return () => {
    tempIdCounter--;
    return tempIdCounter;
  };
}

const generateTempId = createTempIdGenerator();

function isOptimisticMessage(id: number) {
  return id < 0;
}

function createOptimisticMessage(
  content: string,
  role: Message["role"],
  status: Message["status"] = "complete",
  attachments?: FileAttachment[],
  model?: string,
): Message {
  return {
    id: generateTempId(),
    role,
    content,
    timestamp: new Date().toISOString(),
    status,
    attachments,
    ...(model ? { model } : {}),
  };
}

// ----------------------------------------
// Zustand Store
// ----------------------------------------

interface ChatState {
  // Core message state
  messages: Message[];
  error: string | null;
  isLoading: boolean;
  initialized: boolean;
  isStreaming: boolean;

  // Conversation metadata
  conversations: Conversation[];
  currentConversationId: number | null;

  // System message state
  systemMessage: string | null;

  // Message actions
  sendMessage: (
    content: string,
    attachments?: FileAttachment[],
  ) => Promise<void>;
  appendStreamChunk: (chunk: string) => void;
  setMessages: (messages: Message[]) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;
  cancelMessage: () => Promise<void>;

  // Conversation actions
  loadConversations: () => Promise<void>;
  loadConversation: (id: number) => Promise<void>;
  setCurrentConversationId: (id: number | null) => Promise<void>;
  createConversation: () => Promise<number>;
  updateConversation: (
    id: number,
    updates: Partial<Conversation>,
  ) => Promise<void>;
  deleteConversation: (id: number) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // --------------------------------------
  // State initialization
  // --------------------------------------
  messages: [],
  error: null,
  isLoading: false,
  initialized: false,
  isStreaming: false,

  conversations: [],
  currentConversationId: null,

  systemMessage: null,

  // --------------------------------------
  // Message actions
  // --------------------------------------
  sendMessage: async (content, attachments) => {
    try {
      set({ isStreaming: true });
      const { config } = useModelStore.getState();
      const providerConfig = config?.providers[config.active_provider];
      const currentModel = providerConfig?.model;

      // Create optimistic messages
      const userMessage = createOptimisticMessage(
        content,
        "user",
        "complete",
        attachments,
      );
      const assistantMessage = createOptimisticMessage(
        "",
        "assistant",
        "streaming",
        undefined,
        currentModel,
      );

      // Update UI with optimistic messages
      set((state) => ({
        messages: [...state.messages, userMessage, assistantMessage],
        error: null,
      }));

      // Send message to backend
      const response = await invoke<{
        reply: string;
        user_message_id: number;
        assistant_message_id: number;
        conversation_id: number;
      }>("process_message", {
        request: {
          message: content,
          conversation_id: get().currentConversationId,
          attachments: attachments || [],
        },
      });

      // Update real IDs for optimistic messages
      set((state) => {
        const updatedMessages = state.messages.map((msg) => {
          if (msg.id === userMessage.id) {
            return { ...msg, id: response.user_message_id };
          }
          if (msg.id === assistantMessage.id) {
            return { ...msg, id: response.assistant_message_id };
          }
          return msg;
        });
        return {
          messages: updatedMessages,
          currentConversationId: response.conversation_id,
        };
      });

      // Reload conversations to update metadata
      await get().loadConversations();
    } catch (error) {
      const errorDetails =
        error instanceof Error ? error.message : JSON.stringify(error);
      console.error("Send message error:", errorDetails);

      // Rollback optimistic messages
      set((state) => ({
        messages: state.messages.filter((msg) => !isOptimisticMessage(msg.id)),
        error: errorDetails,
        isStreaming: false,
      }));
    }
  },

  appendStreamChunk: (chunk: string) => {
    const messages = get().messages;
    const lastIndex = messages.length - 1;
    const lastMessage = messages[lastIndex];

    if (lastMessage?.status === "streaming") {
      logger.state("Store", {
        action: "appendStreamChunk",
        messageId: lastMessage.id,
        before: {
          contentLength: lastMessage.content.length,
          chunkLength: chunk.length,
        },
      });

      const updatedMessage = {
        ...lastMessage,
        content: lastMessage.content + chunk,
      };

      const updatedMessages = [...messages];
      updatedMessages[lastIndex] = updatedMessage;

      set({ messages: updatedMessages, isStreaming: true });

      logger.state("Store", {
        action: "appendStreamChunk",
        messageId: lastMessage.id,
        after: {
          contentLength: updatedMessage.content.length,
        },
      });
    }
  },

  setMessages: (messages) => set({ messages }),

  updateLastMessage: (content: string) => {
    const messages = get().messages;
    const lastIndex = messages.length - 1;
    const lastMessage = messages[lastIndex];

    if (lastMessage) {
      const updatedMessage = { ...lastMessage, content };
      const updatedMessages = [...messages];
      updatedMessages[lastIndex] = updatedMessage;
      set({ messages: updatedMessages });
    }
  },

  clearMessages: () => {
    set({
      messages: [],
      error: null,
      systemMessage: null,
    });
  },

  cancelMessage: async () => {
    try {
      await invoke("cancel_message");
      set({ isStreaming: false });
      const messages = get().messages;
      const lastIndex = messages.length - 1;
      const lastMessage = messages[lastIndex];

      if (lastMessage?.status === "streaming") {
        logger.state("Store", {
          action: "cancelMessage",
          messageId: lastMessage.id,
          before: {
            messageStatus: lastMessage.status,
          },
        });

        const updatedMessage = { ...lastMessage, status: "error" as const };
        const updatedMessages = [...messages];
        updatedMessages[lastIndex] = updatedMessage;

        set({ messages: updatedMessages });

        logger.state("Store", {
          action: "cancelMessage",
          messageId: lastMessage.id,
          after: {
            messageStatus: updatedMessage.status,
          },
        });
      }
    } catch (error) {
      set({ isStreaming: false });
      const errorDetails =
        error instanceof Error ? error.message : JSON.stringify(error);
      console.error("Failed to cancel message:", errorDetails);
      set({ error: errorDetails });
    }
  },

  // --------------------------------------
  // Conversation actions
  // --------------------------------------
  loadConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      const conversations = await invoke<Conversation[]>("get_conversations");
      conversations.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      set({
        conversations,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load conversations";
      console.error("Load conversations error:", errorMessage);
      set({
        error: errorMessage,
        isLoading: false,
        conversations: [],
      });
      throw error;
    }
  },

  loadConversation: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      // Ensure the conversation exists
      const { conversations } = get();
      const conversation = conversations.find((c) => c.id === id);
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Load messages
      const messages = await invoke<Message[]>("load_conversation_messages", {
        conversationId: id,
      });

      set({
        messages,
        currentConversationId: id,
        systemMessage: conversation.systemMessage || null,
        isLoading: false,
        error: null,
        isStreaming: false, // Reset streaming state when loading new conversation
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load conversation";
      console.error("Load conversation error:", errorMessage);
      set({
        error: errorMessage,
        isLoading: false,
        messages: [],
        systemMessage: null,
      });
      throw error;
    }
  },

  setCurrentConversationId: async (id: number | null) => {
    // Don't reload if already on this conversation
    if (id === get().currentConversationId) return;

    // Clear current conversation state
    set({
      currentConversationId: null,
      messages: [],
      systemMessage: null,
      error: null,
      isStreaming: false,
    });

    if (id) {
      try {
        await get().loadConversation(id);
      } catch {
        // Error is already set in loadConversation
      }
    }
  },

  createConversation: async () => {
    try {
      // Clear current conversation state
      set({
        currentConversationId: null,
        messages: [],
        error: null,
        systemMessage: null,
        isLoading: true,
        isStreaming: false,
      });

      // Create new conversation
      const newId = await invoke<number>("create_conversation");

      // Reload conversations to include the new one
      const conversations = await invoke<Conversation[]>("get_conversations");
      const newConversation = conversations.find((c) => c.id === newId);
      if (!newConversation) {
        throw new Error("Failed to find newly created conversation");
      }

      set((state) => ({
        conversations: [newConversation, ...state.conversations],
        currentConversationId: newId,
        isLoading: false,
      }));

      return newId;
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to create conversation";
      set({
        error: errorMsg,
        isLoading: false,
      });
      throw error;
    }
  },

  updateConversation: async (id: number, updates: Partial<Conversation>) => {
    try {
      await invoke("update_conversation", { id, updates });

      // Update system message in local state if changed
      if ("systemMessage" in updates) {
        set({ systemMessage: updates.systemMessage || null });
      }

      // Reload conversations if metadata changed
      const metadataChanged = Object.keys(updates).some(
        (key) => key !== "systemMessage" && key !== "messages",
      );
      if (metadataChanged) {
        await get().loadConversations();
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to update conversation";
      set({ error: errorMsg });
      throw error;
    }
  },

  deleteConversation: async (id: number) => {
    try {
      // Clear local state if deleting current conversation
      if (id === get().currentConversationId) {
        set({
          currentConversationId: null,
          messages: [],
          error: null,
          systemMessage: null,
          isStreaming: false,
        });
      }

      await invoke("delete_conversation", { conversationId: id });
      await get().loadConversations();
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to delete conversation";
      set({ error: errorMsg });
      throw error;
    }
  },
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
      await invoke("update_config", { newConfig: config });
      set({ config });
    } catch (error) {
      console.error("Failed to update config:", error);
      throw error;
    }
  },
  updateProviderSettings: async (provider, settings) => {
    try {
      const currentConfig = get().config;
      if (!currentConfig) {
        throw new Error("Config not initialized");
      }

      await invoke("update_provider_settings", { provider, settings });

      set((state) => ({
        config: {
          active_provider: currentConfig.active_provider,
          providers: {
            ...currentConfig.providers,
            [provider]: settings,
          },
        },
      }));
    } catch (error) {
      console.error("Failed to update provider settings:", error);
      throw error;
    }
  },
  setActiveProvider: async (provider) => {
    try {
      const currentConfig = get().config;
      if (!currentConfig) {
        throw new Error("Config not initialized");
      }

      if (provider === currentConfig.active_provider) return;

      await invoke("set_active_provider", { provider });

      set((state) => ({
        config: {
          active_provider: provider,
          providers: currentConfig.providers,
        },
      }));
    } catch (error) {
      console.error("Failed to set active provider:", error);
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
    const config = await invoke<ModelConfig>("get_config");
    useModelStore.setState({ config, initialized: true });

    // Initialize theme
    const { theme } = await initializeStore();
    useThemeStore.setState({
      themeType: theme.type,
      theme: theme.values,
      initialized: true,
    });
    applyTheme(theme.type, theme.values);

    // Load conversations
    await useChatStore.getState().loadConversations();
    useChatStore.setState({ initialized: true });
  } catch (error) {
    console.error("Failed to initialize stores:", error);
  }
})();

// Hooks for accessing specific parts of state
export const useMessages = () =>
  useChatStore((state: ChatState) => state.messages);
export const useConversations = () =>
  useChatStore((state: ChatState) => ({
    conversations: state.conversations,
    currentConversationId: state.currentConversationId,
  }));
export const useSystemMessage = () =>
  useChatStore((state: ChatState) => state.systemMessage);
export const useChatError = () =>
  useChatStore((state: ChatState) => state.error);
export const useChatLoading = () =>
  useChatStore((state: ChatState) => state.isLoading);

export const useZustandTheme = () => {
  const store = useThemeStore();
  if (!store.initialized) {
    return {
      theme: themes.light,
      themeType: "light" as const,
      toggleTheme: store.toggleTheme,
      initialized: false,
    };
  }
  return store;
};
