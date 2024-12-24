import React, { useState, useEffect } from "react";
import { useThemeStore } from "../../store";
import { Message } from "./types";
import { UserAvatar } from "./UserAvatar";
import { MessageContent } from "./MessageContent";
import { MessageActions } from "./MessageActions";
import { MessageEditor } from "./MessageEditor";
import { logger } from "../../utils/logger";

interface MessageBlockProps {
  message: Message;
  onReact: (messageId: number) => void;
  onEdit?: (messageId: number, newContent: string) => void;
  conversationId?: number | null;
  isStreaming?: boolean;
}

export const MessageBlock: React.FC<MessageBlockProps> = ({
  message,
  onReact,
  onEdit,
  conversationId,
  isStreaming = false,
}) => {
  const { theme } = useThemeStore();
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = () => {
    const content = Array.isArray(message.content)
      ? message.content.map((block) => block.text || "").join("\n")
      : message.content;
    navigator.clipboard.writeText(content);
  };

  return (
    <div
      data-message-id={message.id}
      className="flex hover:bg-opacity-50 transition-colors duration-200 py-3 px-4 hover:bg-transparent"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ backgroundColor: isHovered ? theme.surface : "transparent" }}
    >
      <div className="w-10 flex-shrink-0 flex justify-center">
        <UserAvatar user={message.role} />
      </div>
      <div className="flex-grow min-w-0 pl-3 pr-4">
        {message.isEditing ? (
          <MessageEditor
            content={
              Array.isArray(message.content)
                ? message.content.map((block) => block.text || "").join("\n")
                : message.content
            }
            onSave={(content) => onEdit?.(message.id, content)}
            onCancel={() => {
              const content = Array.isArray(message.content)
                ? message.content.map((block) => block.text || "").join("\n")
                : message.content;
              onEdit?.(message.id, content);
            }}
          />
        ) : (
          <div className="flex justify-between">
            <MessageContent message={message} isStreaming={isStreaming} />
            <MessageActions
              onEdit={() => {
                const content = Array.isArray(message.content)
                  ? message.content.map((block) => block.text || "").join("\n")
                  : message.content;
                onEdit?.(message.id, content);
              }}
              onReact={() => onReact(message.id)}
              onCopy={handleCopy}
              isVisible={isHovered && message.role === "user"}
            />
          </div>
        )}
      </div>
    </div>
  );
};
