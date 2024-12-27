import React, { useState, useEffect } from "react";
import { useZustandTheme } from "../../../store";
import { Message, ContentBlock } from "../types/index";
import { UserAvatar } from "../common/UserAvatar";
import { MessageContent } from "../content/MessageContent";
import { MessageActions } from "../actions/MessageActions";
import { MessageEditor } from "../actions/MessageEditor";
// import { logger } from "../../../utils/logger";

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
  const { theme } = useZustandTheme();
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = () => {
    const content = Array.isArray(message.content)
      ? message.content.map((block) => block.text || "").join("\n")
      : message.content;
    navigator.clipboard.writeText(content);
  };

  const getMessageContent = (content: string | ContentBlock[]): string => {
    return Array.isArray(content)
      ? content.map((block) => block.text || "").join("\n")
      : content;
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
            content={getMessageContent(message.content)}
            onSave={(content) => onEdit?.(message.id, content)}
            onCancel={() =>
              onEdit?.(message.id, getMessageContent(message.content))
            }
          />
        ) : (
          <div className="flex justify-between">
            <MessageContent message={message} isStreaming={isStreaming} />
            <MessageActions
              onEdit={() =>
                onEdit?.(message.id, getMessageContent(message.content))
              }
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
