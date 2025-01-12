/**
 * MessageBlock.tsx
 * Renders an individual message in the chat interface with support for editing,
 * reactions, and hover interactions.
 */

import React, { useState } from "react";
import { useZustandTheme } from "../../store";
import { Message } from "../../types";
import { UserAvatar } from "./UserAvatar";
import { MessageContent } from "./MessageContent";
import { MessageActions } from "./MessageActions";
import { MessageEditor } from "./MessageEditor";
import { formatContentBlocks } from "./utils";

/**
 * Props for the MessageBlock component
 * @interface MessageBlockProps
 * @property {Message} message - The message object to display
 * @property {function} onReact - Callback function for message reactions
 * @property {function} onEdit - Optional callback function for editing messages
 * @property {number | null} conversationId - Optional ID of the current conversation
 * @property {boolean} isStreaming - Optional flag indicating if the message is currently streaming
 */
interface MessageBlockProps {
  message: Message;
  onReact: (localIndex: number) => void;
  onEdit?: (localIndex: number, newContent: string) => void;
  conversationId?: number | null;
  isStreaming?: boolean;
  modelName?: string;
}

/**
 * MessageBlock component displays a single message with user avatar, content,
 * and interactive elements like edit and react buttons
 * @component
 */
export const MessageBlock: React.FC<MessageBlockProps> = ({
  message,
  onReact,
  onEdit,
  isStreaming = false,
  modelName,
}) => {
  const { theme } = useZustandTheme();
  const [isHovered, setIsHovered] = useState(false);

  /**
   * Handles copying message content to clipboard
   * Includes error handling for clipboard operations
   */
  const handleCopy = async () => {
    try {
      const formattedContent = formatContentBlocks(message.content);
      await navigator.clipboard.writeText(formattedContent);
    } catch (error) {
      console.error("Failed to copy message:", error);
      // Could integrate with a toast notification system here
    }
  };

  /**
   * Determines if message actions should be visible
   * Only shows actions for user messages when hovered
   */
  const shouldShowActions =
    isHovered && message.role === "user" && !isStreaming;

  return (
    <div
      data-message-index={message.localIndex}
      className="flex hover:bg-opacity-50 transition-colors duration-200 py-3 px-4 hover:bg-transparent"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ backgroundColor: isHovered ? theme.surface : "transparent" }}
    >
      {/* Avatar section */}
      <div className="w-10 flex-shrink-0 flex flex-col items-center">
        <UserAvatar user={message.role} />
      </div>

      {/* Message content section */}
      <div className="flex-grow min-w-0 pl-3 pr-4">
        {message.isEditing ? (
          <MessageEditor
            content={formatContentBlocks(message.content)}
            onSave={(content) => onEdit?.(message.localIndex, content)}
            onCancel={() =>
              onEdit?.(message.localIndex, formatContentBlocks(message.content))
            }
          />
        ) : (
          <div className="flex justify-between">
            <MessageContent message={message} isStreaming={isStreaming} />
            <MessageActions
              onEdit={() =>
                onEdit?.(
                  message.localIndex,
                  formatContentBlocks(message.content)
                )
              }
              onReact={() => onReact(message.localIndex)}
              onCopy={handleCopy}
              isVisible={shouldShowActions}
            />
          </div>
        )}
      </div>
    </div>
  );
};
