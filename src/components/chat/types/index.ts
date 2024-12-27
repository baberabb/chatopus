import { FileAttachment, Message, ContentBlock } from '../../../types';

// Re-export types from root types
export type { FileAttachment, Message, ContentBlock };

/**
 * Props for the streaming input component that handles message sending and cancellation
 */
export interface StreamingInputProps {
  /** Callback to send a new message */
  onSend: (content: string, attachments?: FileAttachment[]) => Promise<void>;
  /** Callback to cancel the current streaming message */
  onCancel: () => Promise<void>;
}

/**
 * Props for the streaming message component that displays a message with streaming state
 */
export interface StreamingMessageProps {
  /** The message to display */
  message: Message;
  /** Callback when a reaction is added to the message */
  onReact: (messageId: number) => void;
  /** Callback to edit the message content */
  onEdit: (messageId: number, content: string) => Promise<void>;
  /** ID of the current conversation */
  conversationId: number | null;
}

/**
 * Props for the chat container scroll handler
 */
export interface ScrollHandlerProps {
  /** Reference to the message list container */
  messageListRef: React.RefObject<HTMLDivElement | null>;
  /** Whether auto-scrolling is enabled */
  shouldAutoScroll: boolean;
  /** Current messages in the chat */
  messages: Message[];
  /** Whether a message is currently streaming */
  isStreaming: boolean;
}
