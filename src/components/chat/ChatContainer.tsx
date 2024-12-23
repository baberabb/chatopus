import React, { useRef, useEffect } from "react";
import { useZustandTheme } from "../../store";
import { useStreaming } from "../../hooks/useStreaming";
import { Message } from "../../types";
import { useModel } from "../../contexts/ModelContext";
import ErrorBoundary from "../ErrorBoundary";
import { InputArea } from "./InputArea";
import { ErrorDisplay } from "../ErrorDisplay";
import { MessageBlock } from "./MessageBlock";
import { useChat } from "./useChat";
import { JupyterConnect } from "../JupyterConnect";
import { logger } from "../../utils/logger";
import { scrollToBottom } from "./utils";

interface StreamingInputProps {
  onSend: (content: string) => Promise<void>;
  onCancel: () => Promise<void>;
}

// Separate component that handles streaming state
const StreamingInput: React.FC<StreamingInputProps> = ({
  onSend,
  onCancel,
}) => {
  const streaming = useStreaming();
  const isStreaming = streaming.isStreaming();
  return (
    <InputArea
      onSend={onSend}
      isStreaming={isStreaming}
      isCancellable={isStreaming}
      onCancel={onCancel}
    />
  );
};

interface StreamingMessageProps {
  message: Message;
  onReact: (messageId: number) => void;
  onEdit: (messageId: number, content: string) => Promise<void>;
  conversationId: number | null;
}

// Separate component that handles streaming state
const StreamingMessage: React.FC<StreamingMessageProps> = ({
  message,
  onReact,
  onEdit,
  conversationId,
}) => {
  const streaming = useStreaming();
  const isStreaming = streaming.isStreaming();
  return (
    <MessageBlock
      message={message}
      onReact={onReact}
      onEdit={onEdit}
      conversationId={conversationId}
      isStreaming={message.status === "streaming" && isStreaming}
    />
  );
};

export function ChatContainer() {
  const { theme } = useZustandTheme();
  const { currentModel } = useModel();
  const messageListRef = useRef<HTMLDivElement>(null);
  const streaming = useStreaming();
  const isStreaming = streaming.isStreaming();

  const {
    messages,
    currentConversationId,
    isLoading,
    error,
    sendMessage,
    handleEdit,
    cancelMessage,
  } = useChat();

  // Get the latest message content for scroll tracking
  const latestMessageContent = messages[messages.length - 1]?.content || "";

  // Scroll to bottom when messages change or during streaming
  useEffect(() => {
    if (isStreaming) {
      // Smooth scroll during streaming
      scrollToBottom(messageListRef.current, true);
    } else {
      // Instant scroll for user messages, smooth for assistant
      const isLatestMessageFromUser =
        messages[messages.length - 1]?.role === "user";
      scrollToBottom(messageListRef.current, !isLatestMessageFromUser);
    }
  }, [messages.length, latestMessageContent, isStreaming]);

  const handleReact = (messageId: number) => {
    // TODO: Implement reaction persistence
    console.log("React to message:", messageId);
  };

  return (
    <ErrorBoundary>
      <div
        className="flex flex-col h-full"
        style={{ backgroundColor: theme.background, color: theme.text }}
      >
        {/* Model header */}
        <div
          className="flex-none h-10 flex items-center px-4 bg-opacity-80 backdrop-blur-sm"
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
        <div
          className="flex-1 min-h-0 overflow-y-auto py-4 chat-messages"
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
                <StreamingMessage
                  message={msg}
                  onReact={handleReact}
                  onEdit={handleEdit}
                  conversationId={currentConversationId}
                />
              </React.Fragment>
            ))
          )}
          {error && (
            <ErrorDisplay
              message={error}
              onRetry={() => {
                // Retry last message
                const lastUserMessage = [...messages]
                  .reverse()
                  .find((msg) => msg.role === "user");
                if (lastUserMessage) {
                  sendMessage(lastUserMessage.content);
                }
              }}
            />
          )}
        </div>

        <StreamingInput onSend={sendMessage} onCancel={cancelMessage} />
      </div>
    </ErrorBoundary>
  );
}
