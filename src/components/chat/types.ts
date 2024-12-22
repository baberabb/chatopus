export interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  model?: string;
  reactions?: {
    thumbsUp: number;
  };
  isEditing?: boolean;
  status?: 'pending' | 'streaming' | 'complete' | 'error';
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  model: string;
  messageCount: number;
  timestamp: string;
}
