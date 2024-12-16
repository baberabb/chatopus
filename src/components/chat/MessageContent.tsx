import React from "react";
import { ThumbsUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import { useZustandTheme } from "@/store.ts";
import { Message } from "./types";
import { CodeBlock } from "./CodeBlock";

interface MessageContentProps {
  message: Message;
  isStreaming: boolean;
}

export const MessageContent: React.FC<MessageContentProps> = ({
  message,
  isStreaming,
}) => {
  const { theme } = useZustandTheme();

  return (
    <div className="flex-1 min-w-0 overflow-hidden">
      <div className="flex items-baseline mb-1">
        <span
          className="text-sm font-medium mr-2"
          style={{ color: theme.text }}
        >
          {message.role === "user" ? "You" : message.model || "Assistant"}
        </span>
        <span className="text-xs" style={{ color: theme.textSecondary }}>
          {message.timestamp}
        </span>
      </div>
      <div className="prose prose-slate dark:prose-invert prose-code:before:content-none prose-code:after:content-none max-w-none font-sans leading-relaxed tracking-normal break-words">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const inline = !match;
              return !inline ? (
                <CodeBlock language={match[1]} value={String(children)} />
              ) : (
                <code
                  className={`${className} bg-slate-100 dark:bg-slate-800 rounded px-1 py-0.5`}
                  {...props}
                >
                  {children}
                </code>
              );
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
        {isStreaming && message.role === "assistant" && (
          <span className="inline-block animate-pulse">▋</span>
        )}
      </div>
      {message.reactions && message.reactions.thumbsUp > 0 && (
        <div
          className="mt-2 inline-flex items-center rounded-full px-2 py-1"
          style={{ backgroundColor: theme.surface }}
        >
          <ThumbsUp size={14} className="text-yellow-400 mr-1" />
          <span className="text-xs" style={{ color: theme.text }}>
            {message.reactions.thumbsUp}
          </span>
        </div>
      )}
    </div>
  );
};
