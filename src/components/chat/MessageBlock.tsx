import React, { useState } from "react";
import { ThumbsUp, Copy } from "lucide-react";
import { useZustandTheme } from "@/store.ts";
import { Message } from "./types";
import { UserAvatar } from "./UserAvatar";
import { MessageContent } from "./MessageContent";

interface MessageBlockProps {
  message: Message;
  onReact: (messageId: string) => void;
  isStreaming: boolean;
}

export const MessageBlock: React.FC<MessageBlockProps> = ({
  message,
  onReact,
  isStreaming,
}) => {
  const { theme } = useZustandTheme();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="flex hover:bg-opacity-50 transition-colors duration-200 py-3 px-4 hover:bg-transparent"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ backgroundColor: isHovered ? theme.surface : "transparent" }}
    >
      <div className="w-10 flex-shrink-0 flex justify-center">
        <UserAvatar user={message.role} />
      </div>
      <div className="flex-grow min-w-0 pl-3 pr-2">
        <div className="flex items-start">
          <MessageContent message={message} isStreaming={isStreaming} />
          <div className="flex-shrink-0 w-12 flex space-x-1">
            {!isStreaming && (
              <>
                <button
                  onClick={() => onReact(message.id)}
                  className={`text-gray-400 hover:text-yellow-500 transition-colors duration-200 ${
                    isHovered ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <ThumbsUp size={16} />
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(message.content)}
                  className={`transition-opacity duration-200 ${
                    isHovered ? "opacity-100" : "opacity-0"
                  }`}
                  aria-label="Copy message"
                >
                  <Copy size={16} style={{ color: theme.textSecondary }} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
