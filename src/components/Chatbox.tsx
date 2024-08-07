import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { useZustandTheme } from "@/store.ts";
// import { atom, useAtom } from "jotai";
// @ts-ignore
import { trace, info, error, attachConsole } from "@tauri-apps/plugin-log";
import { create } from "zustand";
import { useInView } from "react-intersection-observer";
import { ulid } from "ulidx";
import ErrorBoundary from "@/components/ErrorBoundary";
import TypingAnimation from "@/components/magicui/typing-animation.tsx";

// taken from https://tuffstuff9.hashnode.dev/intuitive-scrolling-for-chatbot-message-streaming
//use for scroll
interface ChatScrollAnchorProps {
  trackVisibility: boolean;
  isAtBottom: boolean;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
}

export function ChatScrollAnchor({
  trackVisibility,
  isAtBottom,
  scrollAreaRef,
}: ChatScrollAnchorProps) {
  const { ref, inView, entry } = useInView({
    trackVisibility,
    delay: 100,
  });

  React.useEffect(() => {
    if (isAtBottom && trackVisibility && !inView) {
      if (!scrollAreaRef.current) return;

      const scrollAreaElement = scrollAreaRef.current;

      scrollAreaElement.scrollTop =
        scrollAreaElement.scrollHeight - scrollAreaElement.clientHeight;
    }
  }, [inView, entry, isAtBottom, trackVisibility]);

  return <div ref={ref} className="h-px w-full" />;
}

// Types
interface Reaction {
  thumbsUp: number;
}

interface Message {
  id: string;
  content: string;
  role: string;
  timestamp: string;
  reactions: Reaction;
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
  onReact: (messageId: string, reactionType: keyof Reaction) => void;
  isStreaming: boolean;
}
const getInitials = (name: string): string => {
  try {
    if (name.trim() === "") {
      throw new Error("Invalid input");
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
        <AvatarImage
          src={imageUrl}
          alt={user || "User"}
          className="rounded-full"
        />
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

interface CodeBlockProps {
  language: string;
  value: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const { theme } = useZustandTheme();
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

interface MessageContentProps {
  message: {
    role: string;
    content: string;
    timestamp: string;
    reactions?: { thumbsUp: number };
  };
  isStreaming: boolean;
}

const MessageContent: React.FC<MessageContentProps> = ({
  message,
  isStreaming,
}) => {
  const { theme } = useZustandTheme();

  if (!message || typeof message.content === "undefined") {
    return <div>Error: Invalid message data</div>;
  }

  // info(`Rendering MessageContent: ${message.id}, ${message.text}`);

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
            span: ({ node, ...props }) => <span {...props} />,
          }}
        >
          {contentWithBlinker}
        </ReactMarkdown>
      </div>
      {message.reactions?.thumbsUp > 0 && (
        <ReactionCount count={message.reactions.thumbsUp} />
      )}
    </div>
  );
};

// ReactionCount component with updated styling
const ReactionCount = ({ count }: { count: number }) => {
  const { theme } = useZustandTheme();

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
  const { theme } = useZustandTheme();
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);
  const handleReact = useCallback(
    () => onReact(message.id, "thumbsUp"),
    [onReact, message.id],
  );

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(message.content);
    // You might want to add some feedback here, like a toast notification
  }, [message.content]);

  return (
    <div
      className="flex hover:bg-opacity-50 transition-colors duration-200 py-3 px-4 hover:bg-transparent"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
    onReact: (messageId: string, reactionType: keyof Reaction) => void;
  }
>(({ messages, onReact }, ref) => {
  const { theme } = useZustandTheme();
  const { isStreaming } = useStreamingStore();
  return (
    <div
      className="flex-1 overflow-y-auto py-4"
      style={{ backgroundColor: theme.background }}
    >
      {messages.map((msg, index) => (
        <React.Fragment key={msg.id}>
          {/*This condition checks if it's not the first message (index > 0) and if the current message's user is different from the previous message's user. If both are true, it adds a spacing div.*/}
          {index > 0 && messages[index - 1].role !== msg.role && (
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
}> = ({ input, setInput, handleSend }) => {
  const { theme } = useZustandTheme();
  const { isStreaming } = useStreamingStore();

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
          // input area message
          placeholder="yap!"
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

interface StreamingState {
  isStreaming: boolean;
  setIsStreaming: (isStreaming: boolean) => void;
  messages: Message[];
  setMessages: (
    messages: Message[] | ((prevMessages: Message[]) => Message[]),
  ) => void;
}

export const useStreamingStore = create<StreamingState>((set) => ({
  isStreaming: false,
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  messages: [],
  setMessages: (messages) =>
    set((state) => ({
      messages:
        typeof messages === "function" ? messages(state.messages) : messages,
    })),
}));

// Main DiscordLikeChat Component
const DiscordLikeChat: React.FC = () => {
  const { theme } = useZustandTheme();
  const { isStreaming, setIsStreaming, messages, setMessages } =
    useStreamingStore();

  const [input, setInput] = useState("");
  // const [messages, setMessages] = useState<Message[]>([]);
  const [streamBuffer, setStreamBuffer] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);

  useEffect(() => {
    // trace("Component mounted");
    invoke<Message[]>("get_chat_history")
      .then((history: Message[]) => setMessages(history))
      .catch((error) => info("Error getting chat history:", error));

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
        if (lastMessage.role === "AI") {
          lastMessage.content = streamBuffer;
        } else {
          newMessages.push({
            id: ulid(),
            content: streamBuffer,
            role: "AI",
            timestamp: new Date().toLocaleTimeString(),
            reactions: { thumbsUp: 0 },
          });
        }
        return newMessages;
      });
    }
  }, [streamBuffer, isStreaming]);

  const handleScroll = () => {
    if (!scrollAreaRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
    const atBottom = scrollHeight - clientHeight <= scrollTop + 1;

    setIsAtBottom(atBottom);
  };

  useEffect(() => {
    if (isStreaming) {
      if (!scrollAreaRef.current) return;

      const scrollAreaElement = scrollAreaRef.current;

      scrollAreaElement.scrollTop =
        scrollAreaElement.scrollHeight - scrollAreaElement.clientHeight;

      setIsAtBottom(true);
    }
  }, [isStreaming]);

  const handleSend = async () => {
    if (input && !isStreaming) {
      // user names and input is set here
      const newMessage = {
        id: ulid(),
        content: input,
        role: "You",
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
            id: ulid(),
            content:
              "An error occurred while processing your message. Please try again.",
            role: "AI",
            timestamp: new Date().toLocaleTimeString(),
            reactions: { thumbsUp: 0 },
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    }
  };

  const handleReact = (messageId: string, reactionType: keyof Reaction) => {
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
          <div
            ref={scrollAreaRef}
            className="flex-1 overflow-y-auto"
            onScroll={handleScroll} // Attach the handleScroll function here
          >
            <MessageList messages={messages} onReact={handleReact} />
            <ChatScrollAnchor
              trackVisibility={isStreaming}
              isAtBottom={isAtBottom}
              scrollAreaRef={scrollAreaRef}
            />
            <ChatScrollAnchor
              trackVisibility={isStreaming}
              isAtBottom={isAtBottom}
              scrollAreaRef={scrollAreaRef}
            />
          </div>
        </div>
        <div className="mt-auto">
          <InputArea
            input={input}
            setInput={setInput}
            handleSend={handleSend}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default DiscordLikeChat;
