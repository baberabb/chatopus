import { Message } from '../../types';

export interface Conversation {
  id: number;
  title: string;
  preview: string;
  model: string;
  messageCount: number;
  timestamp: string;
  systemMessage?: string;
}

export interface ConversationState {
  // Core state
  conversations: Map<number, Conversation>;
  currentId: number | null;
  
  // Status
  loading: boolean;
  error: string | null;

  // Actions
  loadConversations: () => Promise<void>;
  setCurrentConversation: (id: number | null) => Promise<void>;
  createConversation: () => Promise<number>;
  deleteConversation: (id: number) => Promise<void>;
  updateConversation: (id: number, updates: Partial<Conversation>) => Promise<void>;
}

// Response types from backend
export interface ConversationResponse {
  id: number;
  title: string;
  preview: string;
  model: string;
  messageCount: number;
  timestamp: string;
  systemMessage?: string;
}

export interface CreateConversationResponse {
  id: number;
}
