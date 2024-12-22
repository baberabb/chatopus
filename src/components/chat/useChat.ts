import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Message, useChatStore } from "../../store";

export function useChat() {
  // TODO: fix
  // const { config } = useModelStore();
  const { 
    messages, 
    currentConversationId,
    setMessages, 
    setCurrentConversationId,
    addMessage, 
    updateLastMessage,
    clearMessages
  } = useChatStore();
  
  const [streamBuffer, setStreamBuffer] = useState("");
  const [error, setError] = useState<{
    message: string;
    details?: string;
  } | null>(null);
  const [lastAttemptedMessage, setLastAttemptedMessage] = useState<string>("");
  // TODO: fix
  // const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [_, setRetryingMessageId] = useState<string | null>(null);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load messages when conversation changes
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        let loadedMessages: Message[];
        if (currentConversationId) {
          console.log("Loading messages for conversation ID:", currentConversationId);
          loadedMessages = await invoke<Message[]>("load_conversation_messages", {
            conversationId: parseInt(currentConversationId, 10)
          });
        } else {
          // When no conversation exists, get_chat_history will create one
          loadedMessages = await invoke<Message[]>("get_chat_history");
          // Get the latest conversation ID after chat history is loaded
          const conversations = await invoke<{id: number}[]>("get_conversations");
          if (conversations && conversations.length > 0) {
            setCurrentConversationId(conversations[0].id.toString());
          }
        }
        setMessages(loadedMessages);
      } catch (error: any) {
        console.error("Error loading messages:", error);
        setError({
          message: "Failed to load messages",
          details: error?.message,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [currentConversationId]);

  useEffect(() => {
    const unlisten = listen("stream-response", (event) => {
      const chunk = event.payload as string;
      setStreamBuffer((prevBuffer) => prevBuffer + chunk);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    if (isStreaming && streamBuffer) {
      updateLastMessage(streamBuffer);
    }
  }, [streamBuffer, isStreaming, updateLastMessage]);

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
  };

  const processMessage = async (messageText: string, existingMessageId?: string) => {
    try {
      setError(null);
      const config = await invoke<any>("get_config");
      const streamingEnabled = config.providers[config.active_provider].streaming;
      const currentModelName = config.providers[config.active_provider].model;

      // Always add user message immediately
      if (!existingMessageId) {
        addMessage({
          id: "temp-user-" + Date.now(),
          content: messageText,
          role: "user",
          timestamp: getCurrentTime(),
          reactions: { thumbsUp: 0 },
        });
      }

      if (streamingEnabled) {
        setStreamBuffer("");
        setIsStreaming(true);
        if (existingMessageId) {
          const messageIndex = messages.findIndex(
            (msg) => msg.id === existingMessageId
          );
          if (messageIndex !== -1) {
            const updatedMessages = [...messages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              content: "",
            };
            setMessages(updatedMessages);
          }
        } else {
          addMessage({
            id: "temp-assistant-" + Date.now(),
            content: "",
            role: "assistant",
            model: currentModelName,
            timestamp: getCurrentTime(),
            reactions: { thumbsUp: 0 },
          });
        }
      }

      const response = await invoke<{ reply: string }>("process_message", {
        message: messageText,
      });

      // After successful processing, reload messages to get proper DB IDs
      let updatedMessages: Message[];
      if (currentConversationId) {
        updatedMessages = await invoke<Message[]>("load_conversation_messages", {
          conversationId: parseInt(currentConversationId, 10)
        });
      } else {
        updatedMessages = await invoke<Message[]>("get_chat_history");
        // Get the latest conversation ID after chat history is loaded
        const conversations = await invoke<{id: number}[]>("get_conversations");
        if (conversations && conversations.length > 0) {
          setCurrentConversationId(conversations[0].id.toString());
        }
      }
      setMessages(updatedMessages);

      if (!streamingEnabled && response && response.reply && existingMessageId) {
        const messageIndex = updatedMessages.findIndex(
          (msg: Message) => msg.id === existingMessageId
        );
        if (messageIndex !== -1) {
          const newMessages = [...updatedMessages];
          newMessages[messageIndex] = {
            ...newMessages[messageIndex],
            content: response.reply,
          };
          setMessages(newMessages);
        }
      }
    } catch (error: any) {
      console.error("Error in process_message:", error);
      const errorDetails = error?.details || null;
      setError({
        message: error?.message || "An error occurred while processing your message.",
        details: errorDetails,
      });
    } finally {
      setIsStreaming(false);
      // TODO: fix- not callable
      setRetryingMessageId(null);
    }
  };

  const handleEdit = async (messageId: string, newContent: string) => {
    try {
      setError(null);
      
      // If messageId matches editingMessageId, this is a save operation
      // Otherwise, this is toggling edit mode
      if (messageId === editingMessageId) {
        // Update message in UI immediately
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          const updatedMessages = [...messages];
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            content: newContent,
            isEditing: false
          };
          setMessages(updatedMessages);
        }
        
        // Call backend to update message
        await invoke("edit_message", {
          messageId,
          newContent
        });

        setEditingMessageId(null);
      } else {
        // Toggle edit mode
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          const updatedMessages = [...messages];
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            isEditing: true
          };
          setMessages(updatedMessages);
        }
        setEditingMessageId(messageId);
      }
    } catch (error: any) {
      console.error("Error editing message:", error);
      setError({
        message: "Failed to edit message",
        details: error?.message
      });
      
      // Revert UI state on error
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      if (messageIndex !== -1) {
        const updatedMessages = [...messages];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          isEditing: false
        };
        setMessages(updatedMessages);
      }
      setEditingMessageId(null);
    }
  };

  const clearChat = async () => {
    try {
      await invoke("clear_chat_history");
      clearMessages();
      setCurrentConversationId(null);
    } catch (error: any) {
      console.error("Error clearing chat history:", error);
      setError({
        message: "Failed to clear chat history",
        details: error?.message,
      });
    }
  };

  return {
    messages,
    currentConversationId,
    isStreaming,
    isLoading,
    error,
    lastAttemptedMessage,
    setLastAttemptedMessage,
    processMessage,
    clearChat,
    setMessages,
    setCurrentConversationId,
    handleEdit,
    editingMessageId
  };
}
