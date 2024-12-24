import React, { useRef, useEffect, useState } from "react";
import { useThemeStore } from "../../store";
import { useStreaming } from "../../hooks/useStreaming";
import { Message, FileAttachment, ContentBlock } from "../../types";
import { useModel } from "../../contexts/ModelContext";
import { useConversations } from "../../store/conversation";
import { useMessages } from "../../store/message";
import ErrorBoundary from "../ErrorBoundary";
import { SystemMessageEditor } from "./SystemMessageEditor";
import { InputArea } from "./InputArea";
import { ErrorDisplay } from "../ErrorDisplay";
import { MessageBlock } from "./MessageBlock";
import { JupyterConnect } from "../JupyterConnect";
import { scrollToBottom } from "./utils";

interface StreamingInputProps {
  onSend: (content: string, attachments?: FileAttachment[]) => Promise<void>;
  onCancel: () => Promise<void>;
}

const StreamingInput: React.FC<StreamingInputProps> = ({
  onSend,
  onCancel,
}) => {
  const streamingState = useStreaming();
  const isStreamingMessage = streamingState.isStreaming();
  return (
    <InputArea
      onSend={onSend}
      isStreaming={isStreamingMessage}
      isCancellable={isStreamingMessage}
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

const StreamingMessage: React.FC<StreamingMessageProps> = ({
  message,
  onReact,
  onEdit,
  conversationId,
}) => {
  const streamingState = useStreaming();
  const isStreamingMessage = streamingState.isStreaming();
  return (
    <MessageBlock
      message={message}
      onReact={onReact}
      onEdit={onEdit}
      conversationId={conversationId}
      isStreaming={message.status === "streaming" && isStreamingMessage}
    />
  );
};

export function NewChatContainer() {
  const { theme } = useThemeStore();
  const { currentModel } = useModel();
  const messageListRef = useRef<HTMLDivElement>(null);
  const streamingState = useStreaming();
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Get state from stores
  const {
    currentConversation,
    currentId: currentConversationId,
    loading: conversationLoading,
    error: conversationError,
    updateSystemMessage,
  } = useConversations();

  const {
    messages,
    isStreaming,
    loading: messageLoading,
    error: messageError,
    send: sendMessage,
    edit: handleEdit,
    cancelMessage,
    load: loadMessages,
  } = useMessages(currentConversationId);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      loadMessages();
    }
  }, [currentConversationId, loadMessages]);

  // Combine loading and error states
  const loading = conversationLoading || messageLoading;
  const error = messageError || conversationError;

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

  // Get the latest message content for scroll tracking
  const latestMessageContent = messages[messages.length - 1]?.content || "";

  // Scroll to bottom when messages change or during streaming
  useEffect(() => {
    if (!shouldAutoScroll) return;

    if (isStreaming) {
      scrollToBottom(messageListRef.current, true);
    } else {
      const isLatestMessageFromUser =
        messages[messages.length - 1]?.role === "user";
      const wasStreaming =
        messages[messages.length - 1]?.status === "streaming";

      if (!isLatestMessageFromUser && wasStreaming) {
        setTimeout(() => {
          scrollToBottom(messageListRef.current, true);
        }, 100);
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
        {currentConversationId && (
          <SystemMessageEditor
            systemMessage={currentConversation?.systemMessage}
            onUpdate={(message) => {
              if (currentConversationId) {
                updateSystemMessage(currentConversationId, message);
              }
            }}
            disabled={loading || isStreaming}
          />
        )}

        {/* Message list */}
        <div
          className="flex-1 min-h-0 overflow-y-auto pt-4 pb-24 chat-messages"
          style={{ backgroundColor: theme.background }}
          ref={messageListRef}
        >
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center items-center h-full text-gray-500">
              Start a new conversation
            </div>
          ) : (
            messages.map((msg: Message) => (
              <React.Fragment key={msg.id}>
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
                  .find((msg: Message) => msg.role === "user");
                if (lastUserMessage) {
                  const content =
                    typeof lastUserMessage.content === "string"
                      ? lastUserMessage.content
                      : (lastUserMessage.content as ContentBlock[])
                          .map((block: ContentBlock) => block.text || "")
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
