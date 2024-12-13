"use client";

import React, { useState, useCallback } from "react";
import { ChatHistory } from "./ChatHistory";
import { ChatInputOther } from "./ChatInputOther";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: string;
}

interface ArchivedChat {
  id: string;
  title: string;
  preview: string;
  model: string;
  messageCount: number;
  timestamp: string;
}

interface ChatContainerProps {
  selectedArchivedChat?: ArchivedChat;
}

export function ChatContainer({ selectedArchivedChat }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Effect to handle archived chat selection
  React.useEffect(() => {
    if (selectedArchivedChat) {
      // Create a message from the archived chat preview
      const archivedMessage: Message = {
        id: selectedArchivedChat.id,
        content: selectedArchivedChat.preview,
        role: "assistant",
        timestamp: selectedArchivedChat.timestamp,
      };
      setMessages([archivedMessage]);
    }
  }, [selectedArchivedChat]);

  const handleSendMessage = useCallback((message: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      content: message,
      role: "user",
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setIsStreaming(true);

    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          "This is a mock response. In a real application, this would be the assistant's reply.",
        role: "assistant",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsStreaming(false);
    }, 1000);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background dark:bg-gray-900">
      <div className="flex-grow overflow-hidden relative">
        <ChatHistory messages={messages} isStreaming={isStreaming} />
      </div>
      <ChatInputOther onSendMessage={handleSendMessage} />
    </div>
  );
}

