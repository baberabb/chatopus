import React, { useRef, useEffect, useState } from "react";
import { useThemeStore } from "../../store";
import { useStreaming } from "../../hooks/useStreaming";
import { Message, FileAttachment, Conversation } from "../../types";
import { useModel } from "../../contexts/ModelContext";
import ErrorBoundary from "../ErrorBoundary";
import { SystemMessageEditor } from "./SystemMessageEditor";
import { InputArea } from "./InputArea";
import { ErrorDisplay } from "../ErrorDisplay";
import { MessageBlock } from "./MessageBlock";
import { useChat } from "./useChat";
import { JupyterConnect } from "../JupyterConnect";
import { logger } from "../../utils/logger";
import { scrollToBottom } from "./utils";

interface StreamingInputProps {
  onSend: (content: string, attachments?: FileAttachment[]) => Promise<void>;
  onCancel: () => Promise<void>;
}

// Separate component that handles streaming state
const StreamingInput: React.FC<StreamingInputProps> = ({
  onSend,
  onCancel,
}) => {
  const streaming = useStreaming();
  const isStreaming = streaming.isStreaming();
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (
    content: string,
    attachments?: FileAttachment[]
  ) => {
    try {
      setError(null);
      await onSend(content, attachments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      throw err; // Re-throw to let InputArea handle UI state
    }
  };

  return (
    <>
      <InputArea
        onSend={handleSend}
        isStreaming={isStreaming}
        isCancellable={isStreaming}
        onCancel={onCancel}
      />
      {error && (
        <div className="absolute bottom-20 left-0 right-0 px-4">
          <div className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        </div>
      )}
    </>
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
  const { theme } = useThemeStore();
  const { currentModel } = useModel();
  const messageListRef = useRef<HTMLDivElement>(null);
  const streaming = useStreaming();
  const isStreaming = streaming.isStreaming();
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Handle scroll events
  useEffect(() => {
    const container = messageListRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop <=
        container.clientHeight + 100;
      setShouldAutoScroll(isAtBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const {
    messages,
    currentId,
    currentConversation,
    isLoading,
    error,
    sendMessage,
    handleEdit,
    cancelMessage,
    updateConversation,
  } = useChat();

  // Get the latest message content for scroll tracking
  const latestMessageContent = messages[messages.length - 1]?.content || "";

  // Scroll to bottom when messages change or during streaming
  useEffect(() => {
    if (!shouldAutoScroll) return;

    if (isStreaming) {
      // Smooth scroll during streaming
      scrollToBottom(messageListRef.current, true);
    } else {
      // For non-streaming cases, add a small delay to allow DOM to update
      const isLatestMessageFromUser =
        messages[messages.length - 1]?.role === "user";

      // Only add delay for assistant messages that were previously streaming
      const wasStreaming =
        messages[messages.length - 1]?.status === "streaming";
      if (!isLatestMessageFromUser && wasStreaming) {
        setTimeout(() => {
          scrollToBottom(messageListRef.current, true);
        }, 100); // Small delay to let DOM update
      } else {
        scrollToBottom(messageListRef.current, !isLatestMessageFromUser);
      }
    }
  }, [messages.length, latestMessageContent, isStreaming, shouldAutoScroll]);

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

        {/* System message editor */}
        {currentId && (
          <SystemMessageEditor
            systemMessage={currentConversation?.systemMessage}
            onUpdate={(message) => {
              if (currentId) {
                updateConversation(currentId, {
                  systemMessage: message,
                });
              }
            }}
            disabled={isLoading || isStreaming}
          />
        )}

        {/* Message list */}
        <div
          className="flex-1 min-h-0 overflow-y-auto pt-4 pb-24 chat-messages"
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
                <StreamingMessage
                  message={msg}
                  onReact={handleReact}
                  onEdit={handleEdit}
                  conversationId={currentId}
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
                  const content =
                    typeof lastUserMessage.content === "string"
                      ? lastUserMessage.content
                      : lastUserMessage.content
                          .map((block) => block.text || "")
                          .join("\n");
                  sendMessage(content);
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
