import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Message, useChatStore } from "../../store";
import { createTempMessage, findMessageById } from "./utils";

interface ChatError {
  message: string;
  details?: string;
}

export function useChat() {
  const {
    messages,
    currentConversationId,
    setMessages,
    setCurrentConversationId,
    addMessage,
    updateLastMessage,
    clearMessages,
  } = useChatStore();

  const [streamBuffer, setStreamBuffer] = useState("");
  const [error, setError] = useState<ChatError | null>(null);
  const [lastAttemptedMessage, setLastAttemptedMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancellable, setIsCancellable] = useState(false);

  const handleError = useCallback((error: any, customMessage: string) => {
    console.error(`Error: ${customMessage}:`, error);
    setError({
      message: customMessage,
      details: error?.message || error?.toString(),
    });
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let loadedMessages: Message[];
      if (currentConversationId) {
        loadedMessages = await invoke<Message[]>("load_conversation_messages", {
          conversationId: parseInt(currentConversationId, 10),
        });
      } else {
        loadedMessages = await invoke<Message[]>("get_chat_history");
        const conversations = await invoke<{ id: number }[]>("get_conversations");
        if (conversations?.length > 0) {
          setCurrentConversationId(conversations[0].id.toString());
        }
      }
      setMessages(loadedMessages);
    } catch (error: any) {
      handleError(error, "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId, setMessages, setCurrentConversationId, handleError]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const unlisten = listen("stream-response", (event) => {
      const chunk = event.payload as string;
      setStreamBuffer((prev) => prev + chunk);
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

  const cancelMessage = async () => {
    try {
      await invoke("cancel_message");
      setIsCancellable(false);
    } catch (error: any) {
      handleError(error, "Failed to cancel message");
    }
  };

  const processMessage = async (messageText: string, existingMessageId?: string) => {
    try {
      setError(null);
      const config = await invoke<any>("get_config");
      const { streaming: streamingEnabled, model: currentModelName } = config.providers[config.active_provider];

      if (!existingMessageId) {
        addMessage(createTempMessage(messageText, "user"));
      }

      if (streamingEnabled) {
        setStreamBuffer("");
        setIsStreaming(true);
        setIsCancellable(true);

        if (existingMessageId) {
          const messageIndex = findMessageById(messages, existingMessageId);
          if (messageIndex !== -1) {
            const updatedMessages = [...messages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              content: "",
            };
            setMessages(updatedMessages);
          }
        } else {
          addMessage(createTempMessage("", "assistant", currentModelName));
        }
      }

      const response = await invoke<{ reply: string }>("process_message", {
        message: messageText,
      });

      await loadMessages();

      if (!streamingEnabled && response?.reply && existingMessageId) {
        const messageIndex = findMessageById(messages, existingMessageId);
        if (messageIndex !== -1) {
          const updatedMessages = [...messages];
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            content: response.reply,
          };
          setMessages(updatedMessages);
        }
      }
    } catch (error: any) {
      handleError(error, "Failed to process message");
    } finally {
      setIsStreaming(false);
      setIsCancellable(false);
    }
  };

  const handleEdit = async (messageId: string, newContent: string) => {
    try {
      setError(null);
      const isSaveOperation = messageId === editingMessageId;

      if (isSaveOperation) {
        const messageIndex = findMessageById(messages, messageId);
        if (messageIndex !== -1) {
          const updatedMessages = [...messages];
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            content: newContent,
            isEditing: false,
          };
          setMessages(updatedMessages);
        }

        await invoke("edit_message", { messageId, newContent });
        setEditingMessageId(null);
      } else {
        const messageIndex = findMessageById(messages, messageId);
        if (messageIndex !== -1) {
          const updatedMessages = [...messages];
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            isEditing: true,
          };
          setMessages(updatedMessages);
        }
        setEditingMessageId(messageId);
      }
    } catch (error: any) {
      handleError(error, "Failed to edit message");
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
  };

  const clearChat = async () => {
    try {
      await invoke("clear_chat_history");
      clearMessages();
      setCurrentConversationId(null);
    } catch (error: any) {
      handleError(error, "Failed to clear chat history");
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
    editingMessageId,
    isCancellable,
    cancelMessage,
  };
}
