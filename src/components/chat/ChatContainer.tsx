/**
 * ChatContainer.tsx
 * Main chat interface component that orchestrates the chat experience.
 *
 * Architecture:
 * - Uses modular components for messages and input
 * - Implements custom hooks for complex behaviors
 * - Manages global state through store integration
 *
 * Features:
 * - Real-time message streaming
 * - Automatic scrolling behavior
 * - Error handling and recovery
 * - System message support
 * - Message editing and reactions
 * - Theme integration
 */

import React, { useRef } from "react";
import { useZustandTheme, useChatStore } from "../../store";
import { useStreaming } from "../../hooks/useStreaming";
import { useModel } from "../../contexts/ModelContext";
import { useChat } from "./useChat";
import { useAutoScroll } from "./hooks/useAutoScroll";

// Component imports
import ErrorBoundary from "../ErrorBoundary";
import { SystemMessageEditor } from "./SystemMessageEditor";
import { ErrorDisplay } from "../ErrorDisplay";
import { JupyterConnect } from "../JupyterConnect";
import { StreamingMessage } from "./messages/StreamingMessage";
import { StreamingInput } from "./input/StreamingInput";

/**
 * Main chat container component that orchestrates the chat interface
 * @component
 */
export function ChatContainer() {
  const { theme } = useZustandTheme();
  const { currentModel } = useModel();
  const messageListRef = useRef<HTMLDivElement>(null);
  const { isStreaming } = useStreaming();

  // Use store directly to avoid potential timing issues with selectors
  const {
    messages,
    currentConversationId,
    isLoading,
    error,
    initialized,
    sendMessage,
    cancelMessage,
  } = useChatStore();

  const { handleEdit } = useChat();

  // // Initialize auto-scroll behavior
  // useAutoScroll({
  //   containerRef: messageListRef,
  //   messages,
  //   isStreaming,
  // });

  // Handle message reactions (TODO: Implement persistence)
  const handleReact = (messageId: number) => {
    console.log("React to message:", messageId);
  };

  // Show loading state while store is initializing
  if (!initialized) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
      </div>
    );
  }

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
