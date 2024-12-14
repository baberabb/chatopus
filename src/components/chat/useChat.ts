import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ulid } from "ulidx";
import { Message } from "./types";
import { useChatStore, useModelStore } from "../../store";

export function useChat() {
  const { config } = useModelStore();
  const { messages, addMessage, updateLastMessage, setMessages } = useChatStore();
  const [input, setInput] = useState("");
  const [streamBuffer, setStreamBuffer] = useState("");
  const [error, setError] = useState<{
    message: string;
    details?: string;
  } | null>(null);
  const [lastAttemptedMessage, setLastAttemptedMessage] = useState<string>("");
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

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

  const processMessage = async (messageText: string, existingMessageId?: string) => {
    try {
      setError(null);
      const config = await invoke<any>("get_config");
      const streamingEnabled = config.providers[config.active_provider].streaming;
      const currentModelName = config.providers[config.active_provider].model;

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
            id: ulid(),
            content: "",
            role: "assistant",
            model: currentModelName,
            timestamp: new Date().toLocaleTimeString(),
            reactions: { thumbsUp: 0 },
          });
        }
      }

      const response = await invoke<{ reply: string }>("process_message", {
        message: messageText,
      });

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
        } else {
          addMessage({
            id: ulid(),
            content: response.reply,
            role: "assistant",
            model: currentModelName,
            timestamp: new Date().toLocaleTimeString(),
            reactions: { thumbsUp: 0 },
          });
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
      setRetryingMessageId(null);
    }
  };

  return {
    messages,
    input,
    setInput,
    isStreaming,
    error,
    lastAttemptedMessage,
    setLastAttemptedMessage,
    processMessage,
    setMessages,
  };
}
