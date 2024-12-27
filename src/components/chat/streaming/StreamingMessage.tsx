import React from "react";
import { useStreaming } from "../../../hooks/useStreaming";
import { MessageBlock } from "../core/MessageBlock";
import { StreamingMessageProps } from "../types/index";

/**
 * StreamingMessage component handles the display of chat messages with streaming state.
 * It wraps the MessageBlock component and adds streaming-specific functionality.
 *
 * @component
 * @example
 * ```tsx
 * <StreamingMessage
 *   message={message}
 *   onReact={(messageId) => handleReaction(messageId)}
 *   onEdit={async (messageId, content) => {
 *     await updateMessage(messageId, content);
 *   }}
 *   conversationId={currentConversationId}
 * />
 * ```
 */
export const StreamingMessage: React.FC<StreamingMessageProps> = ({
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
