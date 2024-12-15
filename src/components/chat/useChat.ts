import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Message } from "@/store.ts";
import { useChatStore, useModelStore } from "@/store.ts";

export function useChat() {
  // TODO: fix
  const { config } = useModelStore();
  const { 
    messages, 
    currentConversationId,
    setMessages, 
    setCurrentConversationId,
    addMessage, 
    updateLastMessage,
    clearMessages
  } = useChatStore();
  
  const [input, setInput] = useState("");
  const [streamBuffer, setStreamBuffer] = useState("");
  const [error, setError] = useState<{
    message: string;
    details?: string;
  } | null>(null);
  const [lastAttemptedMessage, setLastAttemptedMessage] = useState<string>("");
  // TODO: fix
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load messages when conversation changes
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        if (currentConversationId) {
          const messages = await invoke<Message[]>("load_conversation_messages", {
            conversationId: parseInt(currentConversationId, 10)
          });
          setMessages(messages);
        } else {
          const messages = await invoke<Message[]>("get_chat_history");
          setMessages(messages);
        }
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
      if (currentConversationId) {
        const messages = await invoke<Message[]>("load_conversation_messages", {
          conversationId: parseInt(currentConversationId, 10)
        });
        setMessages(messages);
      } else {
        const messages = await invoke<Message[]>("get_chat_history");
        setMessages(messages);
      }

      if (!streamingEnabled && response && response.reply) {
        if (existingMessageId) {
          const messageIndex = messages.findIndex(
            (msg) => msg.id === existingMessageId
          );
          if (messageIndex !== -1) {
            const updatedMessages = [...messages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              content: response.reply,
            };
            setMessages(updatedMessages);
          }
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
    input,
    setInput,
    isStreaming,
    isLoading,
    error,
    lastAttemptedMessage,
    setLastAttemptedMessage,
    processMessage,
    clearChat,
    setMessages,
    setCurrentConversationId
  };
}
