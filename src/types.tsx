export type ThemeType = "light" | "dark";

export interface Theme {
  background: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  shadowColor: string;
}

export type ParameterType = "number" | "boolean" | "select" | "string";

export interface ParameterConfig {
  type: ParameterType;
  label: string;
  description?: string;
  default: any;
  validation?: {
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  };
}

export interface ProviderConfig {
  name: string;
  models: string[];
  parameters: Record<string, ParameterConfig>;
  customParameters?: Record<string, ParameterConfig>;
}

export interface ProviderSettings {
  api_key: string;
  model: string;
  parameters: Record<string, any>;
  customParameters?: Record<string, any>;
}

export interface CustomParameterFormData {
  name: string;
  type: ParameterType;
  label: string;
  description?: string;
  default: any;
  validation?: {
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  };
}

export type ProviderType = "anthropic" | "openai" | "openrouter";

export interface ModelConfig {
  active_provider: ProviderType;
  providers: Record<ProviderType, ProviderSettings>;
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
