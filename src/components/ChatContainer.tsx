/**
 * ChatContainer.tsx
 *
 * A comprehensive chat interface component that manages message display, user interactions,
 * and real-time message streaming. This component serves as the main container for the chat
 * functionality in the application.
 *
 * Key Features:
 * - Real-time message streaming with visual feedback
 * - Support for markdown rendering with code syntax highlighting
 * - Message reactions (thumbs up) and copy functionality
 * - Error handling with retry capability
 * - Theme-aware styling using Zustand store
 * - Code execution capability for code blocks
 * - Chat history persistence
 *
 * Component Structure:
 * - ChatContainer (main component)
 *   ├─ MessageBlock (individual message wrapper)
 *   │  ├─ UserAvatar (displays user/assistant avatar)
 *   │  └─ MessageContent (renders message with markdown)
 *   │     └─ CodeBlock (handles code syntax highlighting)
 *   └─ Input area (message input with attachments)
 *
 * State Management:
 * - Uses Zustand for theme and chat message state
 * - Maintains streaming state for real-time updates
 * - Handles message retry and error states
 *
 * Props:
 * @prop {ArchivedChat} selectedArchivedChat - Optional archived chat to display
 *
 * Key Interactions:
 * - Message sending/receiving
 * - Message reactions
 * - Code block copying and execution
 * - Error handling and message retry
 * - Real-time message streaming
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { ThumbsUp, Paperclip, Zap, CornerRightUp, Copy } from "lucide-react";
import { ulid } from "ulidx";
import { create } from "zustand";
import ErrorBoundary from "./ErrorBoundary";
import { ErrorDisplay } from "./ErrorDisplay";
import { useModel } from "../contexts/ModelContext";
import { ModelSelector } from "./ModelSelector";
import { cn } from "../lib/utils";
import { useZustandTheme, useChatStore, Message } from "../store";
import { MessageContent } from "./MessageContent";
import Avatar from "@mui/material/Avatar";

/**
 * Interface representing an archived chat entry
 */
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

interface StreamingState {
  isStreaming: boolean;
  activeModelId: string | null;
  setIsStreaming: (isStreaming: boolean) => void;
  setActiveModelId: (modelId: string | null) => void;
}

const useStreamingStore = create<StreamingState>((set) => ({
  isStreaming: false,
  activeModelId: null,
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setActiveModelId: (modelId) => set({ activeModelId: modelId }),
}));

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
interface UserAvatarProps {
  user: string;
  imageUrl?: string;
  model?: {
    id: string;
    name: string;
    provider: string;
  };
}
const UserAvatar: React.FC<UserAvatarProps> = ({ user, imageUrl, model }) => {
  const displayName = model
    ? `${model.name} (${model.provider})`
    : user.toLowerCase();
  const avatarProps = React.useMemo(
    () => stringAvatar(displayName),
    [displayName]
  );
  return imageUrl ? (
    <Avatar alt={user} src={imageUrl} />
  ) : (
    <Avatar {...avatarProps} />
  );
};

const MessageBlock: React.FC<{
  message: Message;
  onReact: (messageId: string) => void;
  isStreaming: boolean;
  isActiveModel: boolean;
}> = ({ message, onReact, isStreaming, isActiveModel }) => {
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
        <UserAvatar user={message.role} model={message.model} />
      </div>
      <div className="flex-grow min-w-0 pl-3 pr-2">
        <div className="flex items-start">
          <MessageContent
            message={{
              role: message.role,
              content: message.content,
              timestamp: message.timestamp,
              model: message.model,
            }}
            isStreaming={isStreaming && isActiveModel}
          />
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
  const { selectedModels } = useModel();
  const { isStreaming, activeModelId, setIsStreaming, setActiveModelId } =
    useStreamingStore();
  const { messages, addMessage, setMessages } = useChatStore();
  const [input, setInput] = useState("");
  const [error, setError] = useState<{
    message: string;
    details?: string;
  } | null>(null);
  const [lastAttemptedMessage, setLastAttemptedMessage] = useState<string>("");
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(
    null
  );
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const history = await invoke<Message[]>("get_chat_history");
        const formattedHistory = history.map((msg) => ({
          ...msg,
          id: ulid(),
          timestamp: new Date().toLocaleTimeString(),
          reactions: { thumbsUp: 0 },
        }));
        setMessages(formattedHistory);
      } catch (error) {
        console.error("Error loading chat history:", error);
      }
    };

    if (!selectedArchivedChat) {
      loadChatHistory();
    }
  }, [setMessages, selectedArchivedChat]);

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
  }, [selectedArchivedChat, setMessages]);

  const updateMessage = useCallback(
    (messageId: string, updateFn: (prevContent: string) => string) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId
            ? { ...msg, content: updateFn(msg.content) }
            : msg
        )
      );
    },
    [setMessages]
  );

  const processMessage = async (
    messageText: string,
    existingMessageId?: string
  ) => {
    let unlistenFn: UnlistenFn | undefined;

    try {
      setError(null);
      const config = await invoke<any>("get_config");
      const streamingEnabled =
        config.providers[config.active_provider].streaming;
      console.log("DEBUG: Streaming enabled:", streamingEnabled);

      // Create message IDs for each model upfront
      const modelMessageIds = selectedModels.reduce(
        (acc, model) => {
          acc[model.id] = ulid();
          return acc;
        },
        {} as { [key: string]: string }
      );

      if (streamingEnabled) {
        setIsStreaming(true);

        // Create placeholder messages for each selected model
        selectedModels.forEach((model) => {
          addMessage({
            id: modelMessageIds[model.id],
            content: "",
            role: "assistant",
            timestamp: new Date().toLocaleTimeString(),
            model: {
              id: model.id,
              name: model.name,
              provider: model.provider,
            },
            reactions: { thumbsUp: 0 },
          });
        });

        // Listen for model-specific streaming responses
        unlistenFn = await listen<{ modelId: string; chunk: string }>(
          "stream-response",
          (event) => {
            const { modelId, chunk } = event.payload;
            const messageId = modelMessageIds[modelId];
            if (messageId) {
              setActiveModelId(modelId);
              updateMessage(messageId, (prevContent) => prevContent + chunk);
            }
          }
        );
      }

      const selectedModelsForBackend = selectedModels.map((model) => ({
        id: model.id,
        provider: model.provider,
      }));

      const response = await invoke<{ replies: { [key: string]: string } }>(
        "process_message",
        {
          message: messageText,
          selectedModels: selectedModelsForBackend,
        }
      );
      console.log("DEBUG: Response received:", response);

      if (!streamingEnabled && response && response.replies) {
        // Add individual messages for each model's response
        Object.entries(response.replies).forEach(([modelId, reply]) => {
          const model = selectedModels.find((m) => m.id === modelId);
          if (model) {
            addMessage({
              id: modelMessageIds[modelId],
              content: reply,
              role: "assistant",
              timestamp: new Date().toLocaleTimeString(),
              model: {
                id: model.id,
                name: model.name,
                provider: model.provider,
              },
              reactions: { thumbsUp: 0 },
            });
          }
        });
      }
    } catch (error: any) {
      console.error("Error in process_message:", error);
      const errorDetails = error?.details || null;
      setError({
        message:
          error?.message || "An error occurred while processing your message.",
        details: errorDetails,
      });
    } finally {
      if (unlistenFn) {
        unlistenFn();
      }
      setIsStreaming(false);
      setActiveModelId(null);
      setRetryingMessageId(null);
    }
  };

  const handleSend = async () => {
    if (input && !isStreaming && selectedModels.length > 0) {
      const newMessage: Message = {
        id: ulid(),
        content: input,
        role: "user",
        timestamp: new Date().toLocaleTimeString(),
        reactions: { thumbsUp: 0 },
      };
      addMessage(newMessage);
      setLastAttemptedMessage(input);
      setInput("");
      await processMessage(input);
    }
  };

  const handleRetry = async () => {
    if (lastAttemptedMessage) {
      // Find the last assistant message to update
      const lastAssistantIndex = [...messages]
        .reverse()
        .findIndex((msg) => msg.role === "assistant");
      if (lastAssistantIndex !== -1) {
        const messageIndex = messages.length - 1 - lastAssistantIndex;
        const messageId = messages[messageIndex].id;
        setRetryingMessageId(messageId);
        await processMessage(lastAttemptedMessage, messageId);
      } else {
        // If no assistant message found, proceed as normal
        await processMessage(lastAttemptedMessage);
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

  // Rest of the component remains the same...

  return (
    <ErrorBoundary>
      <div
        className="relative h-full"
        style={{ backgroundColor: theme.background, color: theme.text }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-14 flex items-center px-4 bg-opacity-80 backdrop-blur-sm z-10"
          style={{
            backgroundColor: theme.surface,
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <ModelSelector />
        </div>

        <div className="absolute inset-0 top-14 bottom-[76px] overflow-hidden">
          <div
            className="h-full overflow-y-auto py-4 px-4"
            style={{ backgroundColor: theme.background }}
            ref={messageListRef}
          >
            {messages.map((msg, index) => (
              <React.Fragment key={msg.id}>
                {index > 0 &&
                  (messages[index - 1].role !== msg.role ||
                    (messages[index - 1].role === "assistant" &&
                      messages[index - 1].model?.id !== msg.model?.id)) && (
                    <div className="h-4" />
                  )}
                <MessageBlock
                  message={msg}
                  onReact={handleReact}
                  isStreaming={isStreaming}
                  isActiveModel={msg.model?.id === activeModelId}
                />
              </React.Fragment>
            ))}
            {error && (
              <ErrorDisplay
                message={error.message}
                details={error.details}
                onRetry={handleRetry}
              />
            )}
          </div>
        </div>

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
                placeholder={
                  selectedModels.length > 0
                    ? `Message ${selectedModels.map((m) => m.name).join(", ")}`
                    : "Select models to start chatting..."
                }
                rows={1}
                disabled={isStreaming || selectedModels.length === 0}
              />
              <button
                className={cn(
                  "p-3 transition-colors",
                  selectedModels.length > 0
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-600 cursor-not-allowed"
                )}
                onClick={handleSend}
                disabled={isStreaming || selectedModels.length === 0}
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
