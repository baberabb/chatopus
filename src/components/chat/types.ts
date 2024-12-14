export interface Message {
  id: string;
  content: string;
  role: string;
  model?: string;
  timestamp: string;
  reactions?: {
    thumbsUp: number;
  };
}

export interface ArchivedChat {
  id: string;
  title: string;
  preview: string;
  model: string;
  messageCount: number;
  timestamp: string;
}

export interface ChatContainerProps {
  selectedArchivedChat?: ArchivedChat;
}

export interface StreamingState {
  isStreaming: boolean;
  setIsStreaming: (isStreaming: boolean) => void;
}
