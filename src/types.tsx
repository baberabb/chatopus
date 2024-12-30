// Theme types
export interface Theme {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  shadowColor: string;
}

export type ThemeType = "light" | "dark";

// Message types
export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  previewUrl?: string;
}

export interface ContentBlock {
  type: string;
  text?: string;
  image_url?: string;
}

export interface Message {
  id: number;
  content: string | ContentBlock[];
  role: string;
  timestamp: string;
  model?: string;
  reactions?: {
    thumbsUp: number;
  };
  isEditing?: boolean;
  status?: "streaming" | "complete" | "error";
  error?: string;
  attachments?: FileAttachment[];
}

// Conversation types
export interface Conversation {
  id: number;
  title: string;
  preview: string;
  model: string;
  messageCount: number;
  timestamp: string;
  systemMessage?: string;
}

// Provider types
export interface ParameterConfig {
  type: "string" | "number" | "boolean" | "select";
  label: string;
  description?: string;
  default?: string | number | boolean;
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
}

export interface ProviderSettings {
  api_key: string;
  model: string;
  parameters: Record<string, string | number | boolean>;
  customParameters: Record<string, string | number | boolean>;
  api_version?: string;
  base_url?: string;
  timeout_seconds?: number;
  retry_attempts?: number;
  additional_headers?: Record<string, string>;
}

export type ProviderType = "anthropic" | "openai" | "openrouter";

export interface ModelConfig {
  active_provider: ProviderType;
  providers: Record<ProviderType, ProviderSettings>;
}

// Store state types
export interface ChatState {
  // Core message state
  messages: Message[];
  error: string | null;
  isLoading: boolean;
  initialized: boolean;

  // Conversation metadata
  conversations: Conversation[];
  currentConversationId: number | null;

  // System message state
  systemMessage: string | null;

  // Message actions
  sendMessage: (
    content: string,
    attachments?: FileAttachment[],
  ) => Promise<void>;
  appendStreamChunk: (chunk: string) => void;
  setMessages: (messages: Message[]) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;
  cancelMessage: () => Promise<void>;

  // Conversation actions
  loadConversations: () => Promise<void>;
  loadConversation: (id: number) => Promise<void>;
  setCurrentConversationId: (id: number | null) => Promise<void>;
  createConversation: () => Promise<number>;
  updateConversation: (
    id: number,
    updates: Partial<Conversation>,
  ) => Promise<void>;
  deleteConversation: (id: number) => Promise<void>;
}

export interface ThemeStore {
  themeType: ThemeType;
  theme: Theme;
  toggleTheme: () => void;
  initialized: boolean;
}

export interface ModelStore {
  config: ModelConfig | null;
  initialized: boolean;
  setConfig: (config: ModelConfig) => void;
  updateProviderSettings: (
    provider: ProviderType,
    settings: ProviderSettings,
  ) => void;
  setActiveProvider: (provider: ProviderType) => void;
}
