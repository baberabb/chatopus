import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  content: string;
  role: "user" | "assistant";
  timestamp: string;
}

export function ChatMessage({ content, role, timestamp }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex items-start space-x-3 py-2 rounded-lg",
        role === "assistant"
          ? "bg-muted/50 dark:bg-gray-800"
          : "bg-background dark:bg-gray-900"
      )}
    >
      <Avatar className="mt-0.5">
        <AvatarImage
          src={role === "user" ? "/user-avatar.png" : "/assistant-avatar.png"}
        />
        <AvatarFallback>{role === "user" ? "U" : "A"}</AvatarFallback>
      </Avatar>
      <div className="space-y-1">
        <div className="flex items-center">
          <p className="text-sm font-medium leading-none text-foreground dark:text-gray-200">
            {role === "user" ? "You" : "Assistant"}
          </p>
          <p className="text-xs text-muted-foreground dark:text-gray-400 ml-2">
            {timestamp}
          </p>
        </div>
        <p className="text-sm text-foreground dark:text-gray-300">{content}</p>
      </div>
    </div>
  );
}
