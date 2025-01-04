/**
 * store.ts
 * Central state management using Zustand for the chat application.
 * 
 * Architecture Overview:
 * - ChatStore: Manages chat messages, conversations, and streaming state
 * - ThemeStore: Handles light/dark theme switching and CSS variable management
 * - ModelStore: Controls AI model configuration and provider settings
 * 
 * Key Features:
 * - Real-time message streaming with optimistic updates
 * - Persistent conversation management
 * - Theme switching with CSS variable injection
 * - Model configuration with provider-specific settings
 * 
 * The store uses Tauri's IPC bridge to communicate with the Rust backend
 * for data persistence and AI model interaction.
 */

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

/**
 * Stream Event Handlers
 * 
 * The application uses a streaming architecture for real-time message updates:
 * 1. Messages are created optimistically with temporary IDs
 * 2. Content is streamed chunk by chunk from the backend
 * 3. Temporary IDs are replaced with permanent IDs once streaming completes
 */

// Handles incoming message chunks during streaming
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

// Handles stream completion by updating message status and cleaning up state
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

    // Only update isStreaming state for cancellation button
    // Keep message status as streaming to avoid re-renders
    useChatStore.setState({ isStreaming: false });
  }
});

// ----------------------------------------
// Utility / Helper functions
// ----------------------------------------

/**
 * Utility functions for message management:
 * - Temporary ID generation for optimistic updates
 * - Message creation with proper typing
 * - Helper functions for message state management
 */

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
// Zustand Store Implementation
// ----------------------------------------

/**
 * Core store interface defining the chat application state and actions.
 * Organized into logical sections:
 * - Core message state: Current messages, loading states, and errors
 * - Conversation metadata: List of conversations and current selection
 * - System message state: Special system-level instructions
 * - Message actions: Functions for sending, updating, and managing messages
 * - Conversation actions: CRUD operations for conversations
 */

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

/**
 * ChatStore: Primary store for managing chat functionality
 * 
 * Key Features:
 * - Optimistic updates for instant UI feedback
 * - Real-time message streaming support
 * - Error handling and recovery
 * - Conversation management with persistence
 * - System message support for AI context
 */
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
  // Message Actions
  // --------------------------------------

  /**
   * Sends a new message and manages the streaming response lifecycle
   * 
   * Implementation steps:
   * 1. Sets streaming state and gets current model config
   * 2. Creates optimistic messages:
   *    - User message with provided content
   *    - Empty assistant message in streaming state
   * 3. Updates UI immediately with optimistic messages
   * 4. Sends message to backend via Tauri bridge
   * 5. Updates temporary message IDs with permanent ones
   * 6. Reloads conversations to update metadata
   * 
   * Error handling:
   * - Rolls back optimistic messages on failure
   * - Updates error state with detailed message
   * - Resets streaming state
   * 
   * @param content - The message text to send
   * @param attachments - Optional file attachments to include
   */
  sendMessage: async (content, attachments) => {
    try {
      set({ isStreaming: true });
      const { config } = useModelStore.getState();
      const providerConfig = config?.providers[config.active_provider];
      const currentModel = providerConfig?.model;
      const currentMessages = get().messages;

      // Create optimistic user message
      const userMessage = createOptimisticMessage(
        content,
        "user",
        "complete",
        attachments,
      );

      // Create optimistic assistant message
      const assistantMessage = createOptimisticMessage(
        "",
        "assistant",
        "streaming",
        undefined,
        currentModel,
      );

      // Update UI with optimistic messages
      const updatedMessages = [...currentMessages, userMessage, assistantMessage];
      set({ messages: updatedMessages, error: null });

      // Send full conversation context to backend
      const response = await invoke<{
        reply: string;
        user_message_id: number;
        assistant_message_id: number;
        conversation_id: number;
      }>("process_conversation", {
        request: {
          messages: updatedMessages.map(msg => ({
            content: typeof msg.content === 'string' ? msg.content : '',
            role: msg.role,
            attachments: msg.attachments || [],
          })),
          conversation_id: get().currentConversationId,
        }
      });

      // Get the current state of the streaming message
      const latestMessages = get().messages;
      const streamedMessage = latestMessages.find(msg => msg.id === assistantMessage.id);
      
      if (!streamedMessage) {
        throw new Error("Streaming message not found");
      }

      // Update messages with real IDs while preserving streamed content
      const finalMessages = latestMessages.map((msg) => {
        if (msg.id === userMessage.id) {
          return { ...msg, id: response.user_message_id };
        }
        if (msg.id === assistantMessage.id) {
          return {
            ...streamedMessage,
            id: response.assistant_message_id,
            status: "streaming" as const // Ensure status remains streaming until completion
          };
        }
        return msg;
      });

      set({
        messages: finalMessages,
        currentConversationId: response.conversation_id,
        isStreaming: true // Maintain streaming state
      });

      // Update conversation list
      await get().loadConversations();
    } catch (error) {
      const errorDetails =
        error instanceof Error ? error.message : JSON.stringify(error);
      console.error("Send message error:", errorDetails);

      // Rollback optimistic messages while preserving existing messages
      set((state) => {
        const existingMessages = state.messages.filter(msg => !isOptimisticMessage(msg.id));
        return {
          messages: existingMessages,
          error: errorDetails,
          isStreaming: false,
          currentConversationId: get().currentConversationId // Preserve conversation ID
        };
      });
    }
  },

  /**
   * Appends a new chunk of streamed content to the current message
   * 
   * Implementation details:
   * 1. Gets current message list and last message
   * 2. Validates message is in streaming state
   * 3. Logs current state for debugging
   * 4. Creates updated message with appended chunk
   * 5. Updates message list with new content
   * 6. Maintains streaming state
   * 7. Logs updated state
   * 
   * Only updates if:
   * - Messages exist in state
   * - Last message is in streaming status
   * 
   * @param chunk - New content to append to current message
   */
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

      // Create new message with updated content
      const updatedMessage = {
        ...lastMessage,
        content: lastMessage.content + chunk
      };

      // Create new messages array with updated message
      const updatedMessages = [...messages];
      updatedMessages[lastIndex] = updatedMessage;

      // Update state with new messages array
      set({ messages: updatedMessages });

      // Log the updated message content length
      const updatedContent = lastMessage.content + chunk;
      logger.state("Store", {
        action: "appendStreamChunk",
        messageId: lastMessage.id,
        after: {
          contentLength: updatedContent.length,
        },
      });
    }
  },

  /**
   * Directly sets the entire messages array
   * Used for bulk updates or state resets
   * 
   * @param messages - New message array to set
   */
  setMessages: (messages) => set({ messages }),

  /**
   * Updates the content of the last message in the list
   * 
   * Used for:
   * - Editing completed messages
   * - Updating partially streamed content
   * - Correcting message content
   * 
   * Implementation:
   * 1. Gets current message list
   * 2. Validates last message exists
   * 3. Creates updated message with new content
   * 4. Updates message list preserving order
   * 
   * @param content - New content for the last message
   */
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

  /**
   * Clears all messages and resets related state
   * 
   * Resets:
   * - Message list to empty
   * - Error state to null
   * - System message to null
   * 
   * Used when:
   * - Starting new conversations
   * - Clearing chat history
   * - Handling major errors
   */
  clearMessages: () => {
    set({
      messages: [],
      error: null,
      systemMessage: null,
    });
  },

  /**
   * Cancels the current streaming message and cleans up state
   * 
   * Implementation steps:
   * 1. Invokes backend cancel command
   * 2. Resets streaming state
   * 3. Updates last message if in streaming state:
   *    - Logs current message state
   *    - Updates status to error
   *    - Updates message list
   *    - Logs final state
   * 
   * Error handling:
   * - Resets streaming state
   * - Updates error state
   * - Logs error details
   * 
   * Used when:
   * - User manually cancels generation
   * - Connection errors occur
   * - Backend timeout/errors
   */
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

        const updatedMessage = { 
          ...lastMessage, 
          content: lastMessage.content, // Preserve content
          status: "error" as const 
        };
        const updatedMessages = [...messages];
        updatedMessages[lastIndex] = updatedMessage;

        set({ 
          messages: updatedMessages,
          isStreaming: false,
          error: null,
          currentConversationId: get().currentConversationId // Preserve conversation ID
        });

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

/**
 * ThemeStore: Manages application theming
 * 
 * Features:
 * - Light/dark theme switching
 * - CSS variable injection for consistent styling
 * - Theme persistence in localStorage
 * - Automatic theme initialization
 */
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

/**
 * ModelStore: Manages AI model configuration
 * 
 * Features:
 * - Provider configuration management (OpenAI, Anthropic, etc.)
 * - Model selection and settings persistence
 * - Provider-specific parameter management
 * - Active provider switching
 */
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

/**
 * Store Initialization
 * 
 * Asynchronously initializes all stores on application start:
 * 1. Loads model configuration from backend
 * 2. Initializes theme from localStorage or system preference
 * 3. Loads conversation history
 * 
 * Error handling ensures graceful degradation if any initialization fails.
 */
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

/**
 * Custom Hooks
 * 
 * Selector hooks for accessing specific parts of state:
 * - useMessages: Access current chat messages
 * - useConversations: Access conversation list and selection
 * - useSystemMessage: Access system-level instructions
 * - useChatError: Access error state
 * - useChatLoading: Access loading state
 * 
 * These hooks help components access only the state they need,
 * optimizing re-renders and improving performance.
 */
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
