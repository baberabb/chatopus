import { Message, FileAttachment } from '../../types';

export interface MessageState {
  // Core state
  messagesByConversation: Map<number, Message[]>;
  
  // Streaming state
  streaming: {
    conversationId: number | null;
    messageId: number | null;
    status: 'idle' | 'streaming' | 'error';
  };
  
  // Status
  loading: boolean;
  error: string | null;

  // Actions
  loadMessages: (conversationId: number) => Promise<void>;
  sendMessage: (conversationId: number, content: string, attachments?: FileAttachment[]) => Promise<void>;
  editMessage: (conversationId: number, messageId: number, content: string) => Promise<void>;
  cancelMessage: () => Promise<void>;
  appendStreamChunk: (chunk: string) => void;
  clearMessages: (conversationId: number) => void;
}

// Response types from backend
export interface MessageResponse {
  id: number;
  conversationId: number;
  content: string;
  role: string;
  timestamp: string;
  model?: string;
  status?: 'streaming' | 'complete' | 'error';
  error?: string;
}

export interface SendMessageResponse {
  reply: {
    content: string;
    role: string;
  };
  userMessageId: number;
  assistantMessageId: number;
}
