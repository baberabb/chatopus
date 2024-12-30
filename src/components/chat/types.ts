import { Message } from "../../types";

// Re-export Message type
export type { Message };

// Component-specific types
export interface MessageBlockProps {
  message: Message;
  onReact: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  isStreaming: boolean;
  conversationId?: string | null;
}

export interface MessageEditorProps {
  content: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export interface MessageActionsProps {
  onEdit: () => void;
  onReact: () => void;
  onCopy: () => void;
  isVisible: boolean;
}

export interface MessageContentProps {
  message: Message;
  isStreaming: boolean;
}
