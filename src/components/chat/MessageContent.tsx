import React, { useMemo } from "react";
import { ThumbsUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import { useZustandTheme } from "../../store";
import { Message } from "./types";
import { CodeBlock } from "./CodeBlock";
import { formatMessageRole } from "./utils";

interface MessageContentProps {
  message: Message;
  isStreaming: boolean;
}

const markdownPlugins = [remarkGfm, remarkBreaks, remarkMath];

export const MessageContent: React.FC<MessageContentProps> = ({
  message,
  isStreaming,
}) => {
  const { theme } = useZustandTheme();
  const isAssistant = message.role === "assistant";
  const showCursor = isStreaming && isAssistant;

  const markdownComponents = useMemo(
    () => ({
      // @ts-ignore
      code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || "");
        const inline = !match;
        return inline ? (
          <code
            className={`${className} bg-slate-100 dark:bg-slate-800 rounded px-1 py-0.5`}
            {...props}
          >
            {children}
          </code>
        ) : (
          <CodeBlock
            language={match[1]}
            value={String(children)}
            isStreaming={showCursor}
          />
        );
      },
    }),
    [showCursor]
  );

  return (
    <div className="flex-1 min-w-0 overflow-hidden">
      <div className="flex items-baseline mb-1">
        <span
          className="text-sm font-medium mr-2"
          style={{ color: theme.text }}
        >
          {formatMessageRole(message.role, message.model)}
        </span>
        <time
          className="text-xs"
          style={{ color: theme.textSecondary }}
          dateTime={message.timestamp}
        >
          {message.timestamp}
        </time>
      </div>
      <div
        className="prose prose-slate dark:prose-invert prose-code:before:content-none prose-code:after:content-none max-w-none font-sans leading-relaxed tracking-normal break-words"
        aria-live={showCursor ? "polite" : "off"}
      >
        <ReactMarkdown
          remarkPlugins={markdownPlugins}
          components={markdownComponents}
        >
          {message.content}
        </ReactMarkdown>
        {showCursor && (
          <span className="inline-block animate-pulse" aria-hidden="true">
            ▋
          </span>
        )}
      </div>
      {(message.reactions?.thumbsUp ?? 0) > 0 && (
        <div
          className="mt-2 inline-flex items-center rounded-full px-2 py-1"
          style={{ backgroundColor: theme.surface }}
          role="status"
          aria-label={`${message.reactions?.thumbsUp ?? 0} thumbs up reactions`}
        >
          <ThumbsUp
            size={14}
            className="text-yellow-400 mr-1"
            aria-hidden="true"
          />
          <span className="text-xs" style={{ color: theme.text }}>
            {message.reactions?.thumbsUp ?? 0}
          </span>
        </div>
      )}
    </div>
  );
};
