import React, { useRef, useEffect } from "react";
import { Paperclip, Zap, CornerRightUp } from "lucide-react";
import { useZustandTheme } from "@/store.ts";
import { useModel } from "../../contexts/ModelContext";
import ErrorBoundary from "../ErrorBoundary";
import { ErrorDisplay } from "../ErrorDisplay";
import { MessageBlock } from "./MessageBlock";
import { useChat } from "./useChat";

export function ChatContainer() {
  const { theme } = useZustandTheme();
  const { currentModel } = useModel();
  const messageListRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    setInput,
    isStreaming,
    isLoading,
    error,
    lastAttemptedMessage,
    setLastAttemptedMessage,
    processMessage,
    // clearChat,
  } = useChat();

  const handleSend = async () => {
    if (input && !isStreaming) {
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
    // TODO: Implement reaction persistence
    console.log("React to message:", messageId);
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

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
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex justify-center items-center h-full text-gray-500">
                Start a new conversation
              </div>
            ) : (
              messages.map((msg, index) => (
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
              ))
            )}
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
