import React, { useState } from "react";
import { useZustandTheme } from "../../store";
import { Message } from "./types";
import { UserAvatar } from "./UserAvatar";
import { MessageContent } from "./MessageContent";
import { MessageActions } from "./MessageActions";
import { MessageEditor } from "./MessageEditor";

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
  isStreaming = false,
}) => {
  const { theme } = useZustandTheme();
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
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
            content={message.content}
            onSave={(content) => onEdit?.(message.id, content)}
            onCancel={() => onEdit?.(message.id, message.content)}
          />
        ) : (
          <div className="flex justify-between">
            <MessageContent message={message} isStreaming={isStreaming} />
            <MessageActions
              onEdit={() => onEdit?.(message.id, message.content)}
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
