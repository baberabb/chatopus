import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Message, useChatStore } from "../../store";
import { findMessageById } from "./utils";

export function useChat() {
  const {
    // State
    messages,
    conversations,
    currentConversationId,
    isStreaming,
    isLoading,
    error,
    
    // Message actions
    sendMessage,
    
    // Conversation actions
    loadConversations,
    loadConversation,
    setCurrentConversationId,
    createConversation,
    updateConversation,
    deleteConversation,
    
    // Other actions
    setMessages,
    clearMessages,
  } = useChatStore();

  // Local UI state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Message editing
  const handleEdit = useCallback(async (messageId: string, newContent: string) => {
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
      await invoke("edit_message", { messageId, newContent });
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
  const startEdit = useCallback((messageId: string) => {
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
    try {
      const newId = await createConversation();
      await setCurrentConversationId(newId);
      await loadConversations();
    } catch (error) {
      console.error("Failed to clear chat:", error);
    }
  }, [createConversation, setCurrentConversationId, loadConversations]);

  return {
    // State
    messages,
    conversations,
    currentConversationId,
    isStreaming,
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
