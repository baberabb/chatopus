import React, { useRef, useState } from "react";
import { useZustandTheme, useChatStore } from "../../../store";
import { useModel } from "../../../contexts/ModelContext";
import ErrorBoundary from "../../ErrorBoundary";
import { SystemMessageEditor } from "../system/SystemMessageEditor";
import { ErrorDisplay } from "../../ErrorDisplay";
import { JupyterConnect } from "../../JupyterConnect";
import { useChat } from "../hooks/useChat";
import { StreamingInput } from "../streaming/StreamingInput";
import { StreamingMessage } from "../streaming/StreamingMessage";
import { useScrollHandler } from "../hooks/useScrollHandler";
import { useStreaming } from "../../../hooks/useStreaming";

/**
 * ChatContainer is the main component that manages the chat interface.
 * It handles message display, user input, streaming state, and scroll behavior.
 *
 * Features:
 * - Displays chat messages with streaming support
 * - Handles message sending and cancellation
 * - Manages auto-scrolling behavior
 * - Supports system message editing
 * - Handles error states and loading
 * - Integrates with Jupyter notebooks
 *
 * @component
 * @example
 * ```tsx
 * <ChatContainer />
 * ```
 */
export function ChatContainer() {
  const { theme } = useZustandTheme();
  const { currentModel } = useModel();
  const messageListRef = useRef<HTMLDivElement>(null);
  const streaming = useStreaming();
  const isStreaming = streaming.isStreaming();
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

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

  // Get message editing functionality
  const { handleEdit } = useChat();

  // Setup scroll handling
  const { setupScrollListener } = useScrollHandler({
    messageListRef,
    shouldAutoScroll,
    messages,
    isStreaming,
  });

  // Handle scroll events
  React.useEffect(() => {
    const cleanup = setupScrollListener();
    return () => cleanup?.();
  }, []);

  // Show loading state while store is initializing
  if (!initialized) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
      </div>
    );
  }

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
