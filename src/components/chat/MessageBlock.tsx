import React, { useState, useRef, useEffect } from "react";
import { ThumbsUp, Copy, Pencil, Check, X } from "lucide-react";
import { useZustandTheme } from "@/store.ts";
import { Message } from "./types";
import { UserAvatar } from "./UserAvatar";
import { MessageContent } from "./MessageContent";

interface MessageBlockProps {
  message: Message;
  onReact: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  isStreaming: boolean;
  conversationId: string | null;
}

export const MessageBlock: React.FC<MessageBlockProps> = React.memo(
  ({ message, onReact, onEdit, isStreaming, conversationId }) => {
    const { theme } = useZustandTheme();
    const [isHovered, setIsHovered] = useState(false);
    const [editContent, setEditContent] = useState(message.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      if (message.isEditing && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          textareaRef.current.value.length,
          textareaRef.current.value.length
        );
      }
    }, [message.isEditing]);

    const handleSave = () => {
      if (onEdit && editContent.trim() !== "") {
        onEdit(message.id, editContent);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        handleSave();
      } else if (e.key === "Escape") {
        setEditContent(message.content);
        onEdit?.(message.id, message.content);
      }
    };

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
            {message.isEditing ? (
              <div className="flex-grow">
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full min-h-[100px] p-2 rounded border border-gray-300 dark:border-gray-600 bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Edit your message..."
                />
                <div className="flex justify-end space-x-2 mt-2">
                  <button
                    onClick={() => {
                      setEditContent(message.content);
                      onEdit?.(message.id, message.content);
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <X size={16} className="text-gray-500" />
                  </button>
                  <button
                    onClick={handleSave}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <Check size={16} className="text-green-500" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <MessageContent message={message} isStreaming={isStreaming} />
                <div className="flex-shrink-0 w-16 flex space-x-1">
                  {!isStreaming && message.role === "user" && (
                    <>
                      <button
                        onClick={() => onEdit?.(message.id, message.content)}
                        className={`text-gray-400 hover:text-blue-500 transition-colors duration-200 ${
                          isHovered ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => onReact(message.id)}
                        className={`text-gray-400 hover:text-yellow-500 transition-colors duration-200 ${
                          isHovered ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        <ThumbsUp size={16} />
                      </button>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(message.content)
                        }
                        className={`transition-opacity duration-200 ${
                          isHovered ? "opacity-100" : "opacity-0"
                        }`}
                        aria-label="Copy message"
                      >
                        <Copy
                          size={16}
                          style={{ color: theme.textSecondary }}
                        />
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.reactions?.thumbsUp ===
        nextProps.message.reactions?.thumbsUp &&
      prevProps.isStreaming === nextProps.isStreaming &&
      prevProps.message.isEditing === nextProps.message.isEditing &&
      prevProps.conversationId === nextProps.conversationId
    );
  }
);

MessageBlock.displayName = "MessageBlock";
