import React, { useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Paperclip, Zap, CornerRightUp } from "lucide-react";
import { ulid } from "ulidx";
import { useZustandTheme } from "../../store";
import { useModel } from "../../contexts/ModelContext";
import ErrorBoundary from "../ErrorBoundary";
import { ErrorDisplay } from "../ErrorDisplay";
import { MessageBlock } from "./MessageBlock";
import { ChatContainerProps, Message } from "./types";
import { useChat } from "./useChat";

export function ChatContainer({ selectedArchivedChat }: ChatContainerProps) {
  const { theme } = useZustandTheme();
  const { currentModel } = useModel();
  const messageListRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    setInput,
    isStreaming,
    error,
    lastAttemptedMessage,
    setLastAttemptedMessage,
    processMessage,
    setMessages,
  } = useChat();

  // Load chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const history = await invoke<Message[]>("get_chat_history");
        const formattedHistory = history.map((msg) => ({
          ...msg,
          id: ulid(),
          timestamp: new Date().toLocaleTimeString(),
          reactions: { thumbsUp: 0 },
        }));
        setMessages(formattedHistory);
      } catch (error) {
        console.error("Error loading chat history:", error);
      }
    };

    if (!selectedArchivedChat) {
      loadChatHistory();
    }
  }, [setMessages, selectedArchivedChat]);

  // Effect to handle archived chat selection
  useEffect(() => {
    if (selectedArchivedChat) {
      const archivedMessage: Message = {
        id: selectedArchivedChat.id,
        content: selectedArchivedChat.preview,
        role: "assistant",
        timestamp: selectedArchivedChat.timestamp,
        reactions: { thumbsUp: 0 },
      };
      setMessages([archivedMessage]);
    }
  }, [selectedArchivedChat, setMessages]);

  const handleSend = async () => {
    if (input && !isStreaming) {
      const newMessage: Message = {
        id: ulid(),
        content: input,
        role: "user",
        timestamp: new Date().toLocaleTimeString(),
        reactions: { thumbsUp: 0 },
      };
      setMessages([...messages, newMessage]);
      setLastAttemptedMessage(input);
      setInput("");
      await processMessage(input);
    }
  };

  const handleRetry = async () => {
    if (lastAttemptedMessage) {
      const lastAssistantIndex = [...messages]
        .reverse()
        .findIndex((msg) => msg.role === "assistant");
      if (lastAssistantIndex !== -1) {
        const messageIndex = messages.length - 1 - lastAssistantIndex;
        const messageId = messages[messageIndex].id;
        await processMessage(lastAttemptedMessage, messageId);
      } else {
        await processMessage(lastAttemptedMessage);
      }
    }
  };

  const handleReact = (messageId: string) => {
    setMessages(
      messages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              reactions: {
                ...msg.reactions,
                thumbsUp: (msg.reactions?.thumbsUp || 0) + 1,
              },
            }
          : msg
      )
    );
  };

  return (
    <ErrorBoundary>
      <div
        className="relative h-full"
        style={{ backgroundColor: theme.background, color: theme.text }}
      >
        {/* Model header */}
        <div
          className="absolute top-0 left-0 right-0 h-10 flex items-center px-4 bg-opacity-80 backdrop-blur-sm z-10"
          style={{
            backgroundColor: theme.surface,
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <span className="text-sm font-medium" style={{ color: theme.text }}>
            {currentModel?.name || "No model selected"}
          </span>
        </div>

        {/* Message list */}
        <div className="absolute inset-0 top-10 bottom-[76px] overflow-hidden">
          <div
            className="h-full overflow-y-auto py-4 px-4"
            style={{ backgroundColor: theme.background }}
            ref={messageListRef}
          >
            {messages.map((msg, index) => (
              <React.Fragment key={msg.id}>
                {index > 0 && messages[index - 1].role !== msg.role && (
                  <div className="h-4" />
                )}
                <MessageBlock
                  message={msg}
                  onReact={handleReact}
                  isStreaming={isStreaming && index === messages.length - 1}
                />
              </React.Fragment>
            ))}
            {error && (
              <ErrorDisplay
                message={error.message}
                details={error.details}
                onRetry={handleRetry}
              />
            )}
          </div>
        </div>

        {/* Input area */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-opacity-80 backdrop-blur-sm"
          style={{
            backgroundColor: theme.background,
            borderTop: `1px solid ${theme.border}`,
          }}
        >
          <div className="p-4">
            <div
              className="flex items-end rounded-lg"
              style={{
                backgroundColor: theme.surface,
                boxShadow: `0 2px 4px -2px ${theme.shadowColor}, 0 1px 2px -1px ${theme.shadowColor}`,
              }}
            >
              <button className="p-3 text-gray-400 hover:text-white transition-colors">
                <Paperclip size={20} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 bg-transparent p-3 focus:outline-none resize-none min-h-[44px] max-h-[200px] font-sans leading-tight overflow-y-auto"
                style={{ color: theme.text }}
                placeholder="Type a message..."
                rows={1}
                disabled={isStreaming}
              />
              <button
                className="p-3 text-gray-400 hover:text-white transition-colors"
                onClick={handleSend}
                disabled={isStreaming}
              >
                {isStreaming ? <Zap size={20} /> : <CornerRightUp size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
