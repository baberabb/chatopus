import React, { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  ThumbsUp,
  Paperclip,
  Zap,
  CornerRightUp,
  Copy,
  Check,
  Play,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import SyntaxHighlighter from "react-syntax-highlighter";
import { darcula } from "react-syntax-highlighter/dist/esm/styles/hljs";
import "highlight.js/styles/atom-one-dark.css";
import { useZustandTheme } from "../store";
import Avatar from "@mui/material/Avatar";
import { create } from "zustand";
import { ulid } from "ulidx";
import ErrorBoundary from "./ErrorBoundary";

interface Reaction {
  thumbsUp: number;
}

interface Message {
  id: string;
  content: string;
  role: string;
  timestamp: string;
  reactions?: Reaction;
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

// Avatar helper functions
function stringToColor(string: string) {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  return color;
}

function stringAvatar(name: string | undefined) {
  if (!name) {
    return {
      sx: { bgcolor: stringToColor("UN") },
      children: "UN",
    };
  }
  const nameParts = name.split(" ");
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[1][0]}`
      : nameParts[0][0];
  return {
    sx: { bgcolor: stringToColor(name) },
    children: initials,
  };
}

// Store for managing streaming state
interface StreamingState {
  isStreaming: boolean;
  setIsStreaming: (isStreaming: boolean) => void;
}

const useStreamingStore = create<StreamingState>((set) => ({
  isStreaming: false,
  setIsStreaming: (isStreaming) => set({ isStreaming }),
}));

// Components
const UserAvatar: React.FC<{ user: string; imageUrl?: string }> = ({
  user,
  imageUrl,
}) => {
  const user_ = user.toLowerCase();
  const avatarProps = React.useMemo(() => stringAvatar(user_), [user_]);
  return imageUrl ? (
    <Avatar alt={user} src={imageUrl} />
  ) : (
    <Avatar {...avatarProps} />
  );
};

const CopyButton = ({ text }: { text: string }) => {
  const { theme } = useZustandTheme();
  const [isCopied, setIsCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="absolute top-2 right-2 p-1 rounded bg-opacity-50 hover:bg-opacity-75 transition-colors"
      style={{ backgroundColor: theme.surface }}
    >
      {isCopied ? (
        <Check size={16} className="text-green-400" />
      ) : (
        <Copy size={16} className="text-gray-300" />
      )}
    </button>
  );
};

const CodeBlock: React.FC<{ language: string; value: string }> = ({
  language,
  value,
}) => {
  const { theme } = useZustandTheme();
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const runCode = async () => {
    setIsRunning(true);
    setOutput(null);
    try {
      const result = await invoke("run_code", { code: value });
      setOutput(result as string);
    } catch (error) {
      console.error("Error running code:", error);
      setOutput(`Error: ${error}`);
    }
    setIsRunning(false);
  };

  const codeWithOutput = output ? `${value}\n\n// Output:\n${output}` : value;

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
        {codeWithOutput}
      </SyntaxHighlighter>
      <CopyButton text={codeWithOutput} />
      <button
        onClick={runCode}
        className="absolute top-2 right-12 p-1 rounded bg-opacity-50 hover:bg-opacity-75 transition-colors"
        style={{ backgroundColor: theme.surface }}
      >
        <Play
          size={16}
          className={isRunning ? "text-yellow-400" : "text-gray-300"}
        />
      </button>
    </div>
  );
};

const MessageContent: React.FC<{ message: Message; isStreaming: boolean }> = ({
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
          {message.role}
        </span>
        <span className="text-xs" style={{ color: theme.textSecondary }}>
          {message.timestamp}
        </span>
      </div>
      <div className="prose prose-slate dark:prose-invert prose-code:before:content-none prose-code:after:content-none max-w-none font-sans leading-relaxed tracking-normal break-words">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
          components={{
            // @ts-ignore
            code({
              className,
              children,
              ...props
            }: {
              className?: string;
              children: React.ReactNode;
            }) {
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

const MessageBlock: React.FC<{
  message: Message;
  onReact: (messageId: string) => void;
  isStreaming: boolean;
}> = ({ message, onReact, isStreaming }) => {
  const { theme } = useZustandTheme();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="flex hover:bg-opacity-50 transition-colors duration-200 py-3 px-4 hover:bg-transparent"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ backgroundColor: isHovered ? theme.surface : "transparent" }}
    >
      <div className="w-10 flex-shrink-0 flex justify-center">
        <UserAvatar user={message.role} />
      </div>
      <div className="flex-grow min-w-0 pl-3 pr-2">
        <div className="flex items-start">
          <MessageContent message={message} isStreaming={isStreaming} />
          <div className="flex-shrink-0 w-12 flex space-x-1">
            {!isStreaming && (
              <>
                <button
                  onClick={() => onReact(message.id)}
                  className={`text-gray-400 hover:text-yellow-500 transition-colors duration-200 ${
                    isHovered ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <ThumbsUp size={16} />
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(message.content)}
                  className={`transition-opacity duration-200 ${
                    isHovered ? "opacity-100" : "opacity-0"
                  }`}
                  aria-label="Copy message"
                >
                  <Copy size={16} style={{ color: theme.textSecondary }} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export function ChatContainer({ selectedArchivedChat }: ChatContainerProps) {
  const { theme } = useZustandTheme();
  const { isStreaming, setIsStreaming } = useStreamingStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streamBuffer, setStreamBuffer] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);

  // Effect to handle archived chat selection
  useEffect(() => {
    if (selectedArchivedChat) {
      const archivedMessage: Message = {
        id: selectedArchivedChat.id,
        content: selectedArchivedChat.preview,
        role: "assistant",
        timestamp: selectedArchivedChat.timestamp,
        reactions: { thumbsUp: 0 },
      };
      setMessages([archivedMessage]);
    }
  }, [selectedArchivedChat]);

  useEffect(() => {
    const unlisten = listen("stream-response", (event) => {
      const chunk = event.payload as string;
      setStreamBuffer((prevBuffer) => prevBuffer + chunk);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    if (isStreaming && streamBuffer) {
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.role === "assistant") {
          lastMessage.content = streamBuffer;
        } else {
          newMessages.push({
            id: ulid(),
            content: streamBuffer,
            role: "assistant",
            timestamp: new Date().toLocaleTimeString(),
            reactions: { thumbsUp: 0 },
          });
        }
        return newMessages;
      });
    }
  }, [streamBuffer, isStreaming]);

  const handleSend = async () => {
    if (input && !isStreaming) {
      const newMessage: Message = {
        id: ulid(),
        content: input,
        role: "user",
        timestamp: new Date().toLocaleTimeString(),
        reactions: { thumbsUp: 0 },
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setInput("");
      setIsStreaming(true);
      setStreamBuffer("");

      try {
        await invoke("process_message", { message: input });
      } catch (error) {
        console.error("Error in process_message:", error);
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            id: ulid(),
            content:
              "An error occurred while processing your message. Please try again.",
            role: "assistant",
            timestamp: new Date().toLocaleTimeString(),
            reactions: { thumbsUp: 0 },
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    }
  };

  const handleReact = (messageId: string) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              reactions: {
                ...msg.reactions,
                thumbsUp: (msg.reactions?.thumbsUp || 0) + 1,
              },
            }
          : msg
      )
    );
  };

  return (
    <ErrorBoundary>
      <div
        className="relative h-full"
        style={{ backgroundColor: theme.background, color: theme.text }}
      >
        {/* Message list with bottom padding to prevent content being hidden behind input */}
        <div className="absolute inset-0 bottom-[76px] overflow-hidden">
          <div
            className="h-full overflow-y-auto py-4 px-4"
            style={{ backgroundColor: theme.background }}
            ref={messageListRef}
          >
            {messages.map((msg, index) => (
              <React.Fragment key={msg.id}>
                {index > 0 && messages[index - 1].role !== msg.role && (
                  <div className="h-4" />
                )}
                <MessageBlock
                  message={msg}
                  onReact={handleReact}
                  isStreaming={isStreaming && index === messages.length - 1}
                />
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Input area fixed at the bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-opacity-80 backdrop-blur-sm"
          style={{
            backgroundColor: theme.background,
            borderTop: `1px solid ${theme.border}`,
          }}
        >
          <div className="p-4">
            <div
              className="flex items-end rounded-lg"
              style={{
                backgroundColor: theme.surface,
                boxShadow: `0 2px 4px -2px ${theme.shadowColor}, 0 1px 2px -1px ${theme.shadowColor}`,
              }}
            >
              <button className="p-3 text-gray-400 hover:text-white transition-colors">
                <Paperclip size={20} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 bg-transparent p-3 focus:outline-none resize-none min-h-[44px] max-h-[200px] font-sans leading-tight overflow-y-auto"
                style={{ color: theme.text }}
                placeholder="Type a message..."
                rows={1}
                disabled={isStreaming}
              />
              <button
                className="p-3 text-gray-400 hover:text-white transition-colors"
                onClick={handleSend}
                disabled={isStreaming}
              >
                {isStreaming ? <Zap size={20} /> : <CornerRightUp size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
