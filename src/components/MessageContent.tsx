import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkMath from 'remark-math'
import { CodeBlock } from './CodeBlock'

interface MessageContentProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  };
  isStreaming: boolean;
}

export const MessageContent: React.FC<MessageContentProps> = ({
  message,
  isStreaming,
}) => {
  if (!message || typeof message.content === "undefined") {
    return <div>Error: Invalid message data</div>;
  }

  return (
    <div className="flex-1 min-w-0 overflow-hidden">
      <div className="flex items-baseline mb-1">
        <span className="text-sm font-medium mr-2">
          {message.role === 'user' ? 'You' : 'Assistant'}
        </span>
        <span className="text-xs text-muted-foreground">
          {message.timestamp}
        </span>
      </div>
      <div className="prose prose-slate dark:prose-invert prose-code:before:content-none prose-code:after:content-none max-w-none font-sans leading-relaxed tracking-normal break-words">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              return !inline && match ? (
                <CodeBlock language={match[1]} value={String(children)} />
              ) : (
                <code
                  className={`${className} bg-muted rounded px-1 py-0.5`}
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
    </div>
  );
};

