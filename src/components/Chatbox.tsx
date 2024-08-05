import React, {
  useState,
  useRef,
  useEffect,
  ErrorInfo,
  useCallback,
} from "react";
import { ThumbsUp, Plus, Gift, Smile } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "@/globals.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// import hljs from 'highlight.js';
import "highlight.js/styles/atom-one-dark.css";
import SyntaxHighlighter from "react-syntax-highlighter";
import { darcula } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { Copy, Check, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import { useTheme } from "@/ThemeContext";


// Types
interface Reaction {
  thumbsUp: number;
}

interface Message {
  id: number;
  text: string;
  user: string;
  timestamp: string;
  reactions: Reaction;
}

// Error Boundary
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("Caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <details className="whitespace-pre-wrap">
            <summary className="cursor-pointer mb-2">
              {this.state.error && this.state.error.toString()}
            </summary>
            <p className="mt-2">
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </p>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

interface UserAvatarProps {
  user: string;
  imageUrl?: string;
}

interface MessageContentProps {
  message: Message;
  isStreaming: boolean;
}

interface ReactionButtonProps {
  onClick: () => void;
}

interface MessageBlockProps {
  message: Message;
  onReact: (messageId: number, reactionType: keyof Reaction) => void;
  isStreaming: boolean;
}
const getInitials = (name: string): string => {
  try {
    if (name.trim() === '') {
      throw new Error('Invalid input');
    }

    return name
        .trim()
        .split(" ")
        .map((word) => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
  } catch (error) {
    return "UN";
  }
};

const getAvatarColor = (name: string) => {
  const colors = [
    "bg-red-500",
    "bg-blue-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-pink-500",
    "bg-purple-500",
    "bg-indigo-500",
    "bg-teal-500",
  ];
  const index = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
};

const UserAvatar: React.FC<UserAvatarProps> = ({ user, imageUrl }) => {
  const initials = getInitials(user);
  const avatarColor = user ? getAvatarColor(user) : "bg-gray-500"; // Default color if user is undefined

  return (
      <Avatar className="h-10 w-10 rounded-full overflow-hidden">
        {imageUrl ? (
            <AvatarImage src={imageUrl} alt={user || "User"} className="rounded-full" />
        ) : (
            <AvatarFallback
                className={`${avatarColor} text-white flex h-full w-full items-center justify-center text-sm font-medium`}
            >
              {initials}
            </AvatarFallback>
        )}
      </Avatar>
  );
};


// CopyButton component with updated styling
const CopyButton = ({ text }: { text: string }) => {
  const { theme } = useTheme();
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

interface CodeBlockProps {
  language: string;
  value: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const { theme } = useTheme();
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const runCode = async () => {
    setIsRunning(true);
    setOutput(null);
    const id = "02ae396a-2c93-516c-a53e-a0f69768a8e6";
    try {
      const result = await invoke("run_code", { id, code: value });
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

const MessageContent: React.FC<MessageContentProps> = ({
  message,
  isStreaming,
}) => {
  const { theme } = useTheme();

  return (
    <div className="flex-1 min-w-0 overflow-hidden">
      <div className="flex items-baseline mb-1">
        <span
          className="text-sm font-medium mr-2"
          style={{ color: theme.text }}
        >
          {message.user}
        </span>
        <span className="text-xs" style={{ color: theme.textSecondary }}>
          {message.timestamp}
        </span>
      </div>
      <div className="prose prose-slate dark:prose-invert prose-code:before:content-none prose-code:after:content-none max-w-none font-sans leading-relaxed tracking-normal break-words">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath, ]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              return !inline && match ? (
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
          {message.text}
        </ReactMarkdown>
        {isStreaming && message.user === "AI" && (
          <span className="inline-block animate-pulse">▋</span>
        )}
      </div>
      {message.reactions?.thumbsUp > 0 && (
        <ReactionCount count={message.reactions.thumbsUp} />
      )}
    </div>
  );
};

// ReactionCount component with updated styling
const ReactionCount = ({ count }: { count: number }) => {
  const { theme } = useTheme();

  return (
    <div
      className="mt-2 inline-flex items-center rounded-full px-2 py-1"
      style={{ backgroundColor: theme.surface }}
    >
      <ThumbsUp size={14} className="text-yellow-400 mr-1" />
      <span className="text-xs" style={{ color: theme.text }}>
        {count}
      </span>
    </div>
  );
};

const ReactionButton: React.FC<
  ReactionButtonProps & { className?: string }
> = ({ onClick, className }) => (
  <button
    onClick={onClick}
    className={`text-gray-400 hover:text-yellow-500 transition-colors duration-200 ${className}`}
  >
    <ThumbsUp size={16} />
  </button>
);

const MessageBlock: React.FC<MessageBlockProps> = ({
  message,
  onReact,
  isStreaming,
}) => {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);
  const handleReact = useCallback(
    () => onReact(message.id, "thumbsUp"),
    [onReact, message.id],
  );

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(message.text);
    // You might want to add some feedback here, like a toast notification
  }, [message.text]);

  return (
    <div
      className="flex hover:bg-opacity-50 transition-colors duration-200 py-3 px-4"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ backgroundColor: isHovered ? theme.surface : "transparent" }}
    >
      <div className="w-10 flex-shrink-0 flex justify-center">
        <UserAvatar user={message.user} />
      </div>
      <div className="flex-grow min-w-0 pl-3 pr-2">
        <div className="flex items-start">
          <MessageContent message={message} isStreaming={isStreaming} />
          <div className="flex-shrink-0 w-12 flex space-x-1">
            {!isStreaming && (
              <>
                <ReactionButton
                  onClick={handleReact}
                  className={`transition-opacity duration-200 ${isHovered ? "opacity-100" : "opacity-0"}`}
                />
                <button
                  onClick={handleCopy}
                  className={`transition-opacity duration-200 ${isHovered ? "opacity-100" : "opacity-0"}`}
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


// Message List Component
const MessageList = React.forwardRef<
  HTMLDivElement,
  {
    messages: Message[];
    onReact: (messageId: number, reactionType: keyof Reaction) => void;
    isStreaming: boolean;
  }
>(({ messages, onReact, isStreaming }, ref) => {
  const { theme } = useTheme();
  return (
    <div
      className="flex-1 overflow-y-auto py-4"
      style={{ backgroundColor: theme.background }}
    >
      {messages.map((msg, index) => (
        <React.Fragment key={msg.id}>
          {index > 0 && messages[index - 1].user !== msg.user && (
            <div className="h-4" />
          )}
          <MessageBlock
            message={msg}
            onReact={onReact}
            isStreaming={isStreaming && index === messages.length - 1}
          />
        </React.Fragment>
      ))}
      <div ref={ref} />
    </div>
  );
});
// Input Area Component
const InputArea: React.FC<{
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  handleSend: () => void;
  isStreaming: boolean;
}> = ({ input, setInput, handleSend, isStreaming }) => {
  const { theme } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, [input]);

  return (
    <div className="px-4 pb-4 pt-2">
      <div
        className="flex items-end rounded-lg"
        style={{ backgroundColor: theme.surface }}
      >
        <button className="p-3 text-gray-400 hover:text-white transition-colors">
          <Plus size={20} />
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          className="flex-1 bg-transparent p-3 focus:outline-none resize-none min-h-[44px] max-h-[200px] font-sans leading-tight overflow-y-auto"
          style={{ color: theme.text }}
          placeholder="Message #language-model-chat"
          rows={1}
          disabled={isStreaming}
        />
        <button className="p-3 text-gray-400 hover:text-white transition-colors">
          <Gift size={20} />
        </button>
        <button className="p-3 text-gray-400 hover:text-white transition-colors">
          <Smile size={20} />
        </button>
      </div>
    </div>
  );
};
// Main DiscordLikeChat Component
const DiscordLikeChat: React.FC = () => {
  const { theme } = useTheme();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("Component mounted");
    invoke<Message[]>("get_chat_history")
      .then((history: Message[]) => setMessages(history))
      .catch((error) => console.error("Error getting chat history:", error));

    const unlisten = listen("stream-response", (event) => {
      const chunk = event.payload as string;
      console.log("Received chunk:", chunk);
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
        if (lastMessage.user === "AI") {
          lastMessage.text = streamBuffer;
        } else {
          newMessages.push({
            id: Date.now(),
            text: streamBuffer,
            user: "AI",
            timestamp: new Date().toLocaleTimeString(),
            reactions: { thumbsUp: 0 },
          });
        }
        return newMessages;
      });
    }
  }, [streamBuffer, isStreaming]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (input.trim() && !isStreaming) {
      const newMessage = {
        id: Date.now(),
        text: input,
        user: "You",
        timestamp: new Date().toLocaleTimeString(),
        reactions: { thumbsUp: 0 },
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setInput("");
      setIsStreaming(true);
      setStreamBuffer("");

      try {
        await invoke<{ reply: string }>("process_message", {
          message: input,
        });
      } catch (error) {
        console.error("Error in process_message:", error);
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            id: Date.now(),
            text: "An error occurred while processing your message. Please try again.",
            user: "AI",
            timestamp: new Date().toLocaleTimeString(),
            reactions: { thumbsUp: 0 },
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    }
  };

  const handleReact = (messageId: number, reactionType: keyof Reaction) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              reactions: {
                ...msg.reactions,
                [reactionType]: (msg.reactions[reactionType] || 0) + 1,
              },
            }
          : msg,
      ),
    );
  };

  return (
    <ErrorBoundary>
      <div
        className="flex flex-col h-full"
        style={{ backgroundColor: theme.background, color: theme.text }}
      >
        <div className="flex-grow overflow-hidden flex flex-col">
          <MessageList
            messages={messages}
            ref={messagesEndRef}
            onReact={handleReact}
            isStreaming={isStreaming}
          />
        </div>
        <div className="mt-auto">
          <InputArea
            input={input}
            setInput={setInput}
            handleSend={handleSend}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default DiscordLikeChat;
