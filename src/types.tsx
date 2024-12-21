export type ThemeType = "light" | "dark";

export interface Theme {
  background: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  shadowColor: string;
}

export interface ProviderSettings {
  api_key: string;
  model: string;
  max_tokens: number;
  streaming: boolean;
}

export interface ModelConfig {
  active_provider: string;
  providers: {
    [key: string]: ProviderSettings;
  };
}

export interface Reaction {
  thumbsUp: number;
}

export interface Message {
  id: number;
  text: string;
  user: string;
  timestamp: string;
  reactions: Reaction;
}

export interface MessageBlockProps {
  message: Message;
  onReact: (messageId: number, reactionType: keyof Reaction) => void;
  isStreaming: boolean;
}

// export interface MessageBlockProps {
//   message: Message;
//   onReact: (messageId: number, reactionType: keyof Reaction) => void;
// }

export interface MessageListProps {
  messages: Message[];
  onReact: (messageId: number, reactionType: keyof Reaction) => void;
}

export interface InputAreaProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  handleSend: () => void;
  isStreaming: boolean;
}
