/**
 * MessageContent.tsx
 * Renders the content of a chat message with support for markdown, code blocks,
 * file attachments, and reactions.
 *
 * Streaming Architecture:
 * 1. Message Flow
 * - Receives streaming state from MessageBlock
 * - Passes streaming state to child CodeBlock components
 * - Updates content in real-time during streaming
 *
 * 2. Content Processing
 * - Parses markdown content using ReactMarkdown
 * - Detects and renders code blocks with syntax highlighting
 * - Maintains formatting during streaming updates
 *
 * 3. Component Hierarchy
 * MessageBlock → MessageContent → CodeBlock
 * - MessageBlock: Manages message-level streaming state
 * - MessageContent: Processes content and coordinates updates
 * - CodeBlock: Handles real-time code rendering
 *
 * This component ensures proper synchronization between streaming updates
 * and UI rendering, particularly for code blocks which require special
 * handling to maintain proper formatting during streaming.
 */

import React, { useMemo } from "react";
import { ThumbsUp, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import { useZustandTheme } from "../../store";
import { Message, FileAttachment, ContentBlock } from "../../types";
import { CodeBlock } from "./CodeBlock";
import { formatMessageRole } from "./utils";
import { useStreaming } from "../../hooks/useStreaming";

/**
 * Props for the MessageContent component
 * @interface MessageContentProps
 * @property {Message} message - The message object containing content and metadata
 * @property {boolean} isStreaming - Whether content is being streamed
 *                                  This prop is passed down to CodeBlock components
 *                                  to optimize their rendering behavior
 */
interface MessageContentProps {
  message: Message;
  isStreaming?: boolean;
}

// Markdown plugins configuration
const markdownPlugins = [remarkGfm, remarkBreaks, remarkMath];

/**
 * Props for the AttachmentPreview component
 * @interface AttachmentPreviewProps
 * @property {FileAttachment} attachment - The file attachment to preview
 */
interface AttachmentPreviewProps {
  attachment: FileAttachment;
}

/**
 * Renders a preview of a file attachment with download capability
 * @component
 */
const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachment,
}) => {
  const { theme } = useZustandTheme();
  const isImage = attachment.type.startsWith("image/");

  return (
    <div
      className="relative group flex items-start gap-2 p-2 rounded-lg max-w-xs"
      style={{ backgroundColor: `${theme.surface}80` }}
      role="figure"
      aria-label={`Attachment: ${attachment.name}`}
    >
      {isImage && attachment.previewUrl ? (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
          aria-label={`View ${attachment.name} in new tab`}
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
            title={`Download ${attachment.name}`}
            aria-label={`Download ${attachment.name}`}
          >
            <Download size={16} aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
};

/**
 * Formats message content for display, handling both string and ContentBlock[] types
 * @param content - The message content to format
 * @returns Formatted content string
 */
const formatMessageContent = (content: string | ContentBlock[]): string => {
  if (typeof content === "string") return content;
  return content.map((block) => block.text || "").join("\n");
};

/**
 * MessageContent component renders the main content of a chat message
 * including markdown, code blocks, attachments, and reactions
 * @component
 */
export const MessageContent: React.FC<MessageContentProps> = ({
  message,
  isStreaming = false,
}) => {
  const { theme } = useZustandTheme();
  const isAssistant = message.role === "assistant";

  // Markdown component configuration
  const markdownComponents = useMemo(
    () => ({
      code: ({
        className,
        children,
        ...props
      }: {
        className?: string;
        children: React.ReactNode;
        [key: string]: any;
      }) => {
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
    }),
    [isStreaming]
  );

  // Format message content for display
  const displayContent = useMemo(
    () => formatMessageContent(message.content),
    [message.content]
  );

  return (
    <div
      className="flex-1 min-w-0 overflow-hidden"
      role="article"
      aria-label={`${message.role}'s message`}
    >
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
        <div
          className="flex flex-wrap gap-2 mb-2"
          role="group"
          aria-label="Message attachments"
        >
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
          {displayContent}
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
