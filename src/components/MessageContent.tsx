import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import SyntaxHighlighter from "react-syntax-highlighter";
import { darcula } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { useZustandTheme } from "../store";

interface MessageContentProps {
  message: {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    model?: {
      id: string;
      name: string;
      provider: string;
    };
  };
  isStreaming: boolean;
}

const CodeBlock: React.FC<{ language: string; value: string }> = ({
  language,
  value,
}) => {
  const { theme } = useZustandTheme();
  return (
    <div className="relative font-mono text-sm">
      <SyntaxHighlighter
        style={darcula}
        language={language}
        PreTag="div"
        customStyle={{
          backgroundColor: theme.surface,
          padding: "1rem",
          borderRadius: "0.375rem",
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

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
          {message.role === "user" ? "You" : message.model?.name || "Assistant"}
        </span>
        <span className="text-xs text-muted-foreground">
          {message.timestamp}
        </span>
        {message.model && (
          <span className="text-xs text-muted-foreground ml-2">
            via {message.model.provider}
          </span>
        )}
      </div>
      <div className="prose prose-slate dark:prose-invert prose-code:before:content-none prose-code:after:content-none max-w-none font-sans leading-relaxed tracking-normal break-words">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
          components={{
            code({ className, children }) {
              const match = /language-(\w+)/.exec(className || "");
              const inline = !match;
              return !inline ? (
                <CodeBlock language={match[1]} value={String(children)} />
              ) : (
                <code className={`${className} bg-muted rounded px-1 py-0.5`}>
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
