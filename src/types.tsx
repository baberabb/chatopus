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
export interface Message {
  id: number;
  content: string;
  role: string;
  timestamp: string;
  model?: string;
  reactions?: {
    thumbsUp: number;
  };
  isEditing?: boolean;
  status?: "streaming" | "complete" | "error";
  error?: string;
}

// Conversation types
export interface Conversation {
  id: number;
  title: string;
  preview: string;
  model: string;
  messageCount: number;
  timestamp: string;
}

// Provider types
export interface ProviderSettings {
  api_key: string;
  model: string;
  parameters: Record<string, any>;
  customParameters: Record<string, any>;
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
  // State
  messages: Message[];
  conversations: Conversation[];
  currentConversationId: number | null;
  error: string | null;
  isLoading: boolean;

  // Message actions
  sendMessage: (content: string) => Promise<void>;
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
    updates: Partial<Conversation>
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
  config: ModelConfig;
  initialized: boolean;
  setConfig: (config: ModelConfig) => void;
  updateProviderSettings: (
    provider: ProviderType,
    settings: ProviderSettings
  ) => void;
  setActiveProvider: (provider: ProviderType) => void;
}
