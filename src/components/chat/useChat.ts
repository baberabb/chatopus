/**
 * useChat.ts
 * Custom hook that provides chat functionality by coordinating between UI components
 * and the Zustand store (store.ts).
 * 
 * State Management Flow:
 * 1. Components use this hook to access chat state and actions
 * 2. Actions are dispatched to the store which handles:
 *    - Optimistic updates for immediate UI feedback
 *    - Backend communication via Tauri
 *    - Message streaming and state updates
 *    - Error handling and recovery
 * 3. Store updates trigger re-renders in subscribed components
 */

import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../../store";
import { findMessageById } from "./utils";

/**
 * Primary chat hook that coordinates UI state with the Zustand store
 * 
 * State Flow:
 * - Uses specific selectors from useChatStore to minimize re-renders
 * - Maintains local UI state for message editing
 * - Coordinates message streaming and cancellation
 * - Handles conversation management
 * 
 * @returns Chat state and actions for use in components
 */
export function useChat() {
  // Selectively subscribe to store state to optimize re-renders
  // Each selector creates a separate subscription to the store
  const messages = useChatStore((state) => state.messages);
  const conversations = useChatStore((state) => state.conversations);
  const currentConversationId = useChatStore(
    (state) => state.currentConversationId,
  );
  const isLoading = useChatStore((state) => state.isLoading);
  const error = useChatStore((state) => state.error);
  const initialized = useChatStore((state) => state.initialized);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const loadConversations = useChatStore((state) => state.loadConversations);
  const loadConversation = useChatStore((state) => state.loadConversation);
  const setCurrentConversationId = useChatStore(
    (state) => state.setCurrentConversationId,
  );
  const createConversation = useChatStore((state) => state.createConversation);
  const updateConversation = useChatStore((state) => state.updateConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const setMessages = useChatStore((state) => state.setMessages);

  // Prevent component rendering before store initialization
  // Returns safe default values to avoid undefined errors
  if (!initialized) {
    return {
      messages: [],
      conversations: [],
      currentConversationId: null,
      isLoading: true,
      error: null,
      editingMessageId: null,
      sendMessage: async () => {},
      handleEdit: async () => {},
      startEdit: () => {},
      cancelMessage: async () => {},
      loadConversations: async () => {},
      loadConversation: async () => {},
      setCurrentConversationId: async () => {},
      updateConversation: async () => {},
      deleteConversation: async () => {},
      clearChat: async () => {},
    };
  }

  // Get streaming state from last message
  // const isStreaming = messages[messages.length - 1]?.status === 'streaming';

  // Local UI state
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);

  /**
   * Handles message editing with optimistic updates
   * 
   * Flow:
   * 1. Updates message content optimistically in UI
   * 2. Sends edit to backend via Tauri
   * 3. Reloads conversation to sync with backend
   * 4. Handles errors by reverting optimistic update
   * 
   * @param messageId ID of message to edit
   * @param newContent Updated message content
   */
  const handleEdit = useCallback(
    async (messageId: number, newContent: string) => {
      try {
        const messageIndex = findMessageById(messages, messageId);
        if (messageIndex === -1) return;

        // Update message optimistically
        const updatedMessages = [...messages];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          content: newContent,
          isEditing: false,
        };
        setMessages(updatedMessages);

        // Save to backend
        await invoke("edit_message", {
          messageId: messageId.toString(),
          newContent,
        });
        setEditingMessageId(null);

        // Reload conversation to get updated messages
        if (currentConversationId) {
          await loadConversation(currentConversationId);
        }
      } catch (error) {
        console.error("Failed to edit message:", error);

        // Revert on error
        const messageIndex = findMessageById(messages, messageId);
        if (messageIndex !== -1) {
          const updatedMessages = [...messages];
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            isEditing: false,
          };
          setMessages(updatedMessages);
        }
        setEditingMessageId(null);
      }
    },
    [messages, setMessages, currentConversationId, loadConversation],
  );

  /**
   * Initiates message editing mode
   * 
   * State Updates:
   * - Sets isEditing flag on message
   * - Updates local editingMessageId state
   * - Triggers MessageEditor component display
   * 
   * @param messageId ID of message to edit
   */
  const startEdit = useCallback(
    (messageId: number) => {
      const messageIndex = findMessageById(messages, messageId);
      if (messageIndex !== -1) {
        const updatedMessages = [...messages];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          isEditing: true,
        };
        setMessages(updatedMessages);
        setEditingMessageId(messageId);
      }
    },
    [messages, setMessages],
  );

  /**
   * Cancels ongoing message streaming
   * 
   * Flow:
   * 1. Signals backend to stop generation
   * 2. Store handles streaming cleanup:
   *    - Updates message status
   *    - Resets streaming state
   *    - Updates UI accordingly
   */
  const cancelMessage = useCallback(async () => {
    try {
      await invoke("cancel_message");
    } catch (error) {
      console.error("Failed to cancel message:", error);
    }
  }, []);

  /**
   * Clears current chat and starts new conversation
   * 
   * State Updates:
   * 1. Creates new conversation in store
   * 2. Resets message list
   * 3. Updates conversation list
   * 4. Sets new conversation as active
   */
  const clearChat = useCallback(async () => {
    // TODO: what if we're in the middle of a conversation?
    // Should we clear the conversation and messages?
    try {
      await createConversation(); // createConversation now handles setting currentConversationId
      await loadConversations();
    } catch (error) {
      console.error("Failed to clear chat:", error);
    }
  }, [createConversation, loadConversations]);

  // Expose chat functionality to components
  return {
    // State
    messages,
    conversations,
    currentConversationId,
    isLoading,
    error,
    editingMessageId,

    // Message actions
    sendMessage,
    handleEdit,
    startEdit,
    cancelMessage,

    // Conversation actions
    loadConversations,
    loadConversation,
    setCurrentConversationId,
    updateConversation,
    deleteConversation,
    clearChat,
  };
}
