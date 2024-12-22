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
}
