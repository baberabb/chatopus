import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../../store";
import { Message, ChatState } from "../../types";
import { findMessageById } from "./utils";

export function useChat() {
  // Use specific selectors to avoid unnecessary rerenders
  const messages = useChatStore((state) => state.messages);
  const conversations = useChatStore((state) => state.conversations);
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const isLoading = useChatStore((state) => state.isLoading);
  const error = useChatStore((state) => state.error);
  const initialized = useChatStore((state) => state.initialized);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const loadConversations = useChatStore((state) => state.loadConversations);
  const loadConversation = useChatStore((state) => state.loadConversation);
  const setCurrentConversationId = useChatStore((state) => state.setCurrentConversationId);
  const createConversation = useChatStore((state) => state.createConversation);
  const updateConversation = useChatStore((state) => state.updateConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const setMessages = useChatStore((state) => state.setMessages);

  // Return early if store is not initialized
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
  const isStreaming = messages[messages.length - 1]?.status === 'streaming';

  // Local UI state
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);

  // Message editing
  const handleEdit = useCallback(async (messageId: number, newContent: string) => {
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
      await invoke("edit_message", { messageId: messageId.toString(), newContent });
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
  }, [messages, setMessages, currentConversationId, loadConversation]);

  // Start editing
  const startEdit = useCallback((messageId: number) => {
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
  }, [messages, setMessages]);

  // Cancel message
  const cancelMessage = useCallback(async () => {
    try {
      await invoke("cancel_message");
    } catch (error) {
      console.error("Failed to cancel message:", error);
    }
  }, []);

  // Clear chat
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
