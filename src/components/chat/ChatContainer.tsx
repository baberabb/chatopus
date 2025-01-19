/**
 * ChatContainer.tsx
 * Main chat interface component that orchestrates the chat UI and state management.
 *
 * Store Integration:
 * 1. Chat State (via useChat):
 *    - Messages array for display
 *    - Conversation metadata
 *    - Loading and error states
 *    - Message actions (send, edit, cancel)
 *
 * 2. Theme State:
 *    - Current theme type (light/dark)
 *    - Theme variables for styling
 *
 * 3. Model State:
 *    - Current model configuration
 *    - Provider settings
 *
 * State Flow:
 * - User input → store.sendMessage → optimistic update → streaming → final state
 * - Message edits → store.handleEdit → optimistic update → backend sync
 * - Streaming updates → store events → UI updates
 *
 * Key Features:
 * - Real-time message streaming with optimistic updates
 * - Auto-scrolling with user override control
 * - Message editing and reaction support
 * - Error handling and retry functionality
 * - System message management
 */

import React, { useRef, useEffect, useState } from "react";
import { useZustandTheme } from "../../store";
import { useRightSidebar } from "../../contexts/RightSidebarContext";
import { ChevronDown } from "lucide-react";
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
import { SidebarTrigger } from "../ui/sidebar";

/**
 * Props for the StreamingInput component
 * @interface StreamingInputProps
 * @property {function} onSend - Callback function to send a new message
 * @property {function} onCancel - Callback function to cancel ongoing message streaming
 * State Management:
 * - onSend: Triggers store.sendMessage which:
 *   1. Creates optimistic messages in store
 *   2. Updates UI immediately
 *   3. Sends to backend and streams response
 *   4. Updates message IDs with permanent ones
 *
 * - onCancel: Triggers store.cancelMessage which:
 *   1. Stops backend generation
 *   2. Updates message status in store
 *   3. Cleans up streaming state
 *   4. Updates UI to show cancellation
 */
interface StreamingInputProps {
  onSend: (content: string, attachments?: FileAttachment[]) => Promise<void>;
  onCancel: () => Promise<void>;
}

/**
 * StreamingInput component manages message input and streaming state
 *
 * Store Integration:
 * - Uses streaming state from store to show loading
 * - Handles message submission to store
 * - Manages cancellation state and UI
 */
const StreamingInput: React.FC<StreamingInputProps> = ({
  onSend,
  onCancel,
}) => {
  const { isStreaming } = useStreaming();
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
 * State Flow:
 * - Message content from store displayed in UI
 * - Streaming status controls animation
 * - Edit mode triggers store update flow
 * - Reactions update message metadata
 *
 * Store Integration:
 * - Displays message content from store
 * - Shows streaming state for assistant messages
 * - Handles message edits through store
 * - Updates reactions in store (TODO)
 */
interface StreamingMessageProps {
  message: Message;
  onReact: (messageId: number) => void;
  onEdit: (messageId: number, content: string) => Promise<void>;
  conversationId: number | null;
  modelName?: string;
}

/**
 * StreamingMessage component handles individual message rendering and state
 *
 * Store Integration:
 * - Subscribes to message updates from store
 * - Shows real-time content during streaming
 * - Manages edit state transitions
 * - Handles reaction updates
 */
const StreamingMessage: React.FC<StreamingMessageProps> = React.memo(
  ({ message, onReact, onEdit, conversationId, modelName }) => {
    const { isStreaming } = useStreaming();
    return (
      <MessageBlock
        message={message}
        onReact={onReact}
        onEdit={onEdit}
        conversationId={conversationId}
        isStreaming={message.status === "streaming" && isStreaming}
        modelName={modelName}
      />
    );
  },
  (prevProps, nextProps) => prevProps.message === nextProps.message
);

/**
 * Main chat container component orchestrating the entire chat interface
 *
 * State Management Flow:
 * 1. Initializes with store state via useChat
 * 2. Manages local UI state for scrolling
 * 3. Coordinates between:
 *    - Message display and updates
 *    - Input and streaming state
 *    - Error handling and retries
 *    - System message management
 * 4. Updates store through actions
 * 5. Reflects store changes in UI
 */
export function ChatContainer() {
  const { theme } = useZustandTheme();
  const { currentModel } = useModel();
  const { isOpen, width } = useRightSidebar();
  const messageListRef = useRef<HTMLDivElement>(null);
  const { isStreaming } = useStreaming();
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Handle scroll events to determine auto-scroll behavior
  useEffect(() => {
    const container = messageListRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop <=
        container.clientHeight + 100;
      setShouldAutoScroll(isAtBottom);
      setShowScrollButton(!isAtBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const {
    handleEdit,
    messages,
    currentConversationId,
    isLoading,
    error,
    sendMessage,
    cancelMessage,
  } = useChat();
  const latestMessageContent = messages[messages.length - 1]?.content || "";
  const isLatestMessageFromUser =
    messages[messages.length - 1]?.role === "user";
  const wasStreaming = messages[messages.length - 1]?.status === "streaming";

  // Handle auto-scrolling behavior
  useEffect(() => {
    if (!shouldAutoScroll) return;

    if (isStreaming) {
      // Smooth scroll during streaming
      scrollToBottom(messageListRef.current, true);
    } else {
      if (!isLatestMessageFromUser && wasStreaming) {
        setTimeout(() => {
          scrollToBottom(messageListRef.current, true);
        }, 100);
      } else {
        scrollToBottom(messageListRef.current, !isLatestMessageFromUser);
      }
    }
  }, [
    messages.length,
    latestMessageContent,
    isStreaming,
    shouldAutoScroll,
    isLatestMessageFromUser,
    wasStreaming,
  ]);

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
        className="flex flex-col h-[100vh] transition-[margin] duration-500 ease-out"
        style={{
          backgroundColor: theme.background,
          color: theme.text,
          marginRight: isOpen ? `${width}px` : 0,
        }}
      >
        {/* Model header */}
        <div
          className="flex-none h-10 flex items-center justify-between px-4 bg-opacity-80 backdrop-blur-sm"
          style={{
            backgroundColor: theme.surface,
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <div className="flex items-center gap-4">
            <SidebarTrigger className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-opacity-10 hover:bg-white transition-colors" />
            <span className="text-sm font-medium" style={{ color: theme.text }}>
              {currentModel?.name || "No model selected"}
            </span>
            <JupyterConnect />
          </div>
        </div>

        {/* System message editor */}
        {currentConversationId && (
          <SystemMessageEditor disabled={isLoading || isStreaming} />
        )}

        {/* Message list */}
        <div className="flex-1 overflow-hidden relative">
          <div
            className="absolute inset-0 overflow-y-auto pt-4 pb-32 chat-messages"
            style={{ backgroundColor: theme.background }}
            ref={messageListRef}
            data-lenis-prevent
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
                  key={msg.localIndex}
                  message={msg}
                  onReact={handleReact}
                  onEdit={handleEdit}
                  conversationId={currentConversationId}
                  modelName={currentModel?.name}
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

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={() => scrollToBottom(messageListRef.current, true)}
            className="fixed bottom-24 right-8 p-2 rounded-full bg-gray-800 text-white shadow-lg hover:bg-gray-700 transition-colors"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
      </div>
    </ErrorBoundary>
  );
}
