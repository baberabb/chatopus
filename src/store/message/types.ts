import { Message, FileAttachment, ContentBlock } from '../../types';

export interface MessageState {
  // Core state
  messagesByConversation: Map<number, Message[]>;
  
  // Streaming state
  streaming: {
    conversationId: number | null;
    messageId: number | null;
    status: 'idle' | 'streaming' | 'error' | 'complete';
    isActive: boolean;
  };
  
  // Status
  loading: boolean;
  error: string | null;

  // Actions
  loadMessages: (conversationId: number) => Promise<void>;
  sendMessage: (conversationId: number | null, content: string, attachments?: FileAttachment[]) => Promise<void>;
  editMessage: (conversationId: number, messageId: number, content: string) => Promise<void>;
  cancelMessage: () => Promise<void>;
  appendStreamChunk: (chunk: string) => void;
  clearMessages: (conversationId: number) => void;
  setStreamComplete: () => void;
  setStreamStart: () => void;
  clearStreaming: () => void;
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
  reply: ContentBlock[];
  user_message_id: number;
  assistant_message_id: number;
  conversation_id: number;
}
