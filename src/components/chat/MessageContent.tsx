import React, { useMemo, useEffect, useState } from "react";
import { ThumbsUp, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useStreamEvents } from "../../hooks/useStreamEvents";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import { useThemeStore } from "../../store";
import { Message, FileAttachment } from "../../types";
import { CodeBlock } from "./CodeBlock";
import { formatMessageRole } from "./utils";
import { logger } from "../../utils/logger";

interface MessageContentProps {
  message: Message;
  isStreaming?: boolean;
}

const markdownPlugins = [remarkGfm, remarkBreaks, remarkMath];

const AttachmentPreview: React.FC<{ attachment: FileAttachment }> = ({
  attachment,
}) => {
  const { theme } = useThemeStore();
  const isImage = attachment.type.startsWith("image/");

  return (
    <div
      className="relative group flex items-start gap-2 p-2 rounded-lg max-w-xs"
      style={{ backgroundColor: `${theme.surface}80` }}
    >
      {isImage && attachment.previewUrl ? (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <img
            src={attachment.previewUrl}
            alt={attachment.name}
            className="max-w-full rounded-lg max-h-48 object-contain"
          />
        </a>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm truncate max-w-[180px]">
            {attachment.name}
          </span>
          <a
            href={attachment.url}
            download={attachment.name}
            className="p-1 rounded hover:bg-opacity-10 hover:bg-white"
            title="Download file"
          >
            <Download size={16} />
          </a>
        </div>
      )}
    </div>
  );
};

export const MessageContent: React.FC<MessageContentProps> = ({
  message,
  isStreaming: initialStreaming = false,
}) => {
  const [isStreaming, setIsStreaming] = useState(initialStreaming);

  useStreamEvents(() => {
    setIsStreaming(false);
  });
  const { theme } = useThemeStore();
  const isAssistant = message.role === "assistant";

  const markdownComponents = {
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
          isStreaming={isStreaming}
        />
      );
    },
  };

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
      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {message.attachments.map((attachment) => (
            <AttachmentPreview key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}
      <div
        className="prose prose-slate dark:prose-invert prose-code:before:content-none prose-code:after:content-none max-w-none font-sans leading-relaxed tracking-normal break-words text-[hsl(var(--chat-content))]"
        aria-live={isStreaming ? "polite" : "off"}
      >
        <ReactMarkdown
          remarkPlugins={markdownPlugins}
          components={markdownComponents}
        >
          {Array.isArray(message.content)
            ? message.content[0]?.text || ""
            : message.content}
        </ReactMarkdown>
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

MessageContent.displayName = "MessageContent";
