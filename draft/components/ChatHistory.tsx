import React, { useRef, useEffect } from "react";
import { ChatMessage } from "./ChatMessage";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: string;
}

interface ChatHistoryProps {
  messages: Message[];
  isStreaming: boolean;
}

export const ChatHistory = React.forwardRef<HTMLDivElement, ChatHistoryProps>(
  ({ messages, isStreaming }, ref) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    return (
      <div className="chat-history flex flex-col h-full overflow-y-auto px-4 py-3 bg-background dark:bg-gray-900">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center flex-grow text-muted-foreground dark:text-gray-400">
            No messages yet. Start a conversation!
          </div>
        ) : (
          messages.map((msg, index) => (
            <React.Fragment key={msg.id}>
              {index > 0 && messages[index - 1].role !== msg.role && (
                <div className="h-4" />
              )}
              <ChatMessage
                content={msg.content}
                role={msg.role}
                timestamp={msg.timestamp}
              />
            </React.Fragment>
          ))
        )}
        <div ref={ref} />
        <div ref={messagesEndRef} />
      </div>
    );
  }
);

ChatHistory.displayName = "ChatHistory";
