/**
 * StreamingMessage.tsx
 * Component for displaying individual chat messages with streaming support
 *
 * Features:
 * - Displays message content with streaming animation
 * - Handles message reactions
 * - Supports message editing
 * - Memoized for performance
 */

import React from "react";
import { Message } from "../../../types";
import { MessageBlock } from "../MessageBlock";

interface StreamingMessageProps {
  /** The message object to display */
  message: Message;
  /** Callback function for message reactions */
  onReact: (messageId: number) => void;
  /** Callback function for editing messages */
  onEdit: (messageId: number, content: string) => Promise<void>;
  /** ID of the current conversation */
  conversationId: number | null;
}

/**
 * StreamingMessage component handles individual message display and streaming state
 * @component
 */
export const StreamingMessage: React.FC<StreamingMessageProps> = React.memo(
  ({ message, onReact, onEdit, conversationId }) => {
    const isMessageStreaming = message.status === "streaming";

    return (
      <MessageBlock
        message={message}
        onReact={onReact}
        onEdit={onEdit}
        conversationId={conversationId}
        isStreaming={isMessageStreaming}
      />
    );
  },
  (prevProps, nextProps) => prevProps.message === nextProps.message
);

StreamingMessage.displayName = "StreamingMessage";
