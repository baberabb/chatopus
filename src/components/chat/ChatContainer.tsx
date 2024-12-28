/**
 * ChatContainer.tsx
 * Main chat interface component that handles message display, input, and streaming functionality.
 *
 * Key features:
 * - Displays messages in a scrollable container
 * - Handles message streaming state
 * - Manages auto-scrolling behavior
 * - Supports message editing and reactions
 * - Displays system messages and error states
 */

import React, { useRef, useEffect, useState } from "react";
import { useZustandTheme, useChatStore } from "../../store";
import { useStreaming } from "../../hooks/useStreaming";
import { Message, FileAttachment } from "../../types";
import { useModel } from "../../contexts/ModelContext";
import ErrorBoundary from "../ErrorBoundary";
import { SystemMessageEditor } from "./SystemMessageEditor";
import { InputArea } from "./InputArea";
import { ErrorDisplay } from "../ErrorDisplay";
import { MessageBlock } from "./MessageBlock";
import { useChat } from "./useChat";
import { JupyterConnect } from "../JupyterConnect";
import { scrollToBottom } from "./utils";

/**
 * Props for the StreamingInput component
 * @interface StreamingInputProps
 * @property {function} onSend - Callback function to send a new message
 * @property {function} onCancel - Callback function to cancel ongoing message streaming
 */
interface StreamingInputProps {
  onSend: (content: string, attachments?: FileAttachment[]) => Promise<void>;
  onCancel: () => Promise<void>;
}

/**
 * StreamingInput component handles the chat input area and streaming state
 * @component
 */
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

/**
 * Props for the StreamingMessage component
 * @interface StreamingMessageProps
 * @property {Message} message - The message object to display
 * @property {function} onReact - Callback function for message reactions
 * @property {function} onEdit - Callback function for editing messages
 * @property {number | null} conversationId - ID of the current conversation
 */
interface StreamingMessageProps {
  message: Message;
  onReact: (messageId: number) => void;
  onEdit: (messageId: number, content: string) => Promise<void>;
  conversationId: number | null;
}

/**
 * StreamingMessage component handles individual message display and streaming state
 * @component
 */
const StreamingMessage: React.FC<StreamingMessageProps> = React.memo(
  ({ message, onReact, onEdit, conversationId }) => {
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
  },
  (prevProps, nextProps) => prevProps.message === nextProps.message
);

/**
 * Main chat container component that orchestrates the chat interface
 * @component
 */
export function ChatContainer() {
  const { theme } = useZustandTheme();
  const { currentModel } = useModel();
  const messageListRef = useRef<HTMLDivElement>(null);
  const streaming = useStreaming();
  const isStreaming = streaming.isStreaming();
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Handle scroll events to determine auto-scroll behavior
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

  // Use store directly to avoid potential timing issues with selectors
  const store = useChatStore();
  const {
    messages,
    currentConversationId,
    isLoading,
    error,
    initialized,
    sendMessage,
    cancelMessage,
  } = store;

  // Show loading state while store is initializing
  if (!initialized) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
      </div>
    );
  }

  const { handleEdit } = useChat();
  const latestMessageContent = messages[messages.length - 1]?.content || "";

  // Handle auto-scrolling behavior
  useEffect(() => {
    if (!shouldAutoScroll) return;

    if (isStreaming) {
      // Smooth scroll during streaming
      scrollToBottom(messageListRef.current, true);
    } else {
      const isLatestMessageFromUser =
        messages[messages.length - 1]?.role === "user";
      const wasStreaming =
        messages[messages.length - 1]?.status === "streaming";

      // Add delay for assistant messages that were previously streaming
      if (!isLatestMessageFromUser && wasStreaming) {
        setTimeout(() => {
          scrollToBottom(messageListRef.current, true);
        }, 100);
      } else {
        scrollToBottom(messageListRef.current, !isLatestMessageFromUser);
      }
    }
  }, [messages.length, latestMessageContent, isStreaming, shouldAutoScroll]);

  /**
   * Handles message reactions (TODO: Implement persistence)
   * @param messageId - ID of the message being reacted to
   */
  const handleReact = (messageId: number) => {
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
        {currentConversationId && (
          <SystemMessageEditor disabled={isLoading || isStreaming} />
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
            messages.map((msg) => (
              <StreamingMessage
                key={msg.id}
                message={msg}
                onReact={handleReact}
                onEdit={handleEdit}
                conversationId={currentConversationId}
              />
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
