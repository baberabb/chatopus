import React, { useRef, useEffect } from "react";
import { useZustandTheme } from "../../store";
import { useModel } from "../../contexts/ModelContext";
import ErrorBoundary from "../ErrorBoundary";
import { InputArea } from "./InputArea";
import { ErrorDisplay } from "../ErrorDisplay";
import { MessageBlock } from "./MessageBlock";
import { useChat } from "./useChat";
import { JupyterConnect } from "../JupyterConnect";

export function ChatContainer() {
  const { theme } = useZustandTheme();
  const { currentModel } = useModel();
  const messageListRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    currentConversationId,
    isStreaming,
    isLoading,
    error,
    lastAttemptedMessage,
    setLastAttemptedMessage,
    processMessage,
    handleEdit,
    isCancellable,
    cancelMessage,
    // clearChat,
  } = useChat();

  const handleSend = async (message: string) => {
    setLastAttemptedMessage(message);
    await processMessage(message);
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
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium" style={{ color: theme.text }}>
              {currentModel?.name || "No model selected"}
            </span>
            <div style={{ color: theme.text }}>
              <JupyterConnect />
            </div>
          </div>
        </div>

        {/* Message list */}
        <div className="absolute inset-0 top-10 bottom-[76px] overflow-hidden">
          <div
            className="h-full overflow-y-auto py-4"
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
                    onEdit={handleEdit}
                    isStreaming={isStreaming && index === messages.length - 1}
                    conversationId={currentConversationId}
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

        <InputArea
          onSend={handleSend}
          isStreaming={isStreaming}
          isCancellable={isCancellable}
          onCancel={cancelMessage}
        />
      </div>
    </ErrorBoundary>
  );
}
