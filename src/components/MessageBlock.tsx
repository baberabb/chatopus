import React, { useState } from "react";
import { ThumbsUp } from "lucide-react";
import { MessageBlockProps, MessageListProps } from "@/types";
import "@/globals.css";

export const MessageBlock: React.FC<MessageBlockProps> = ({
  message,
  onReact,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="flex items-start group rounded-md -mx-4 mb-2 p-2 hover:bg-gray-700 transition-colors duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`w-10 h-10 rounded-full mr-4 ${message.user === "You" ? "bg-blue-500" : "bg-red-500"} flex items-center justify-center flex-shrink-0`}
      >
        {message.user[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline mb-1">
          <span className="font-medium text-white mr-2">{message.user}</span>
          <span className="text-xs text-gray-400">{message.timestamp}</span>
        </div>
        <p className="text-gray-300 whitespace-pre-wrap break-words font-poppins">
          {message.text}
        </p>
        {message.reactions && message.reactions.thumbsUp > 0 && (
          <div className="mt-2 inline-flex items-center bg-gray-800 rounded-full px-2 py-1">
            <ThumbsUp size={16} className="text-yellow-500 mr-1" />
            <span className="text-xs text-gray-300">
              {message.reactions.thumbsUp}
            </span>
          </div>
        )}
      </div>
      {isHovered && (
        <button
          onClick={() => onReact(message.id, "thumbsUp")}
          className="text-gray-400 hover:text-yellow-500 transition-colors duration-200"
        >
          <ThumbsUp size={16} />
        </button>
      )}
    </div>
  );
};

export const MessageList = React.forwardRef<HTMLDivElement, MessageListProps>(
  ({ messages, onReact }, ref) => (
    <div className="flex-1 overflow-y-auto py-4 px-4">
      {messages.map((msg) => (
        <MessageBlock
          key={msg.id}
          message={msg}
          onReact={onReact}
          isStreaming={true}
        />
      ))}
      <div ref={ref} />
    </div>
  ),
);
