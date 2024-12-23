import { Message } from "./types";

// Create temporary ID for optimistic updates
export const createTempId = () => `temp_${crypto.randomUUID()}`;

// Create optimistic message
export const createOptimisticMessage = (
  content: string,
  role: string,
  status: Message['status'] = 'pending'
): Message => ({
  id: createTempId(),
  content,
  role,
  timestamp: new Date().toISOString(),
  status,
});

// Create optimistic assistant message
export const createOptimisticAssistantMessage = (): Message => ({
  id: createTempId(),
  content: '',
  role: 'assistant',
  timestamp: new Date().toISOString(),
  status: 'streaming',
});

// Helper to check if message is optimistic
export const isOptimisticMessage = (id: string) => id.startsWith('temp_');

// Helper to update message ID after backend save
export const updateMessageId = (messages: Message[], tempId: string, realId: string): Message[] => 
  messages.map(msg => 
    msg.id === tempId 
      ? { ...msg, id: realId }
      : msg
  );

// Helper to roll back optimistic message
export const rollbackMessage = (messages: Message[], tempId: string): Message[] =>
  messages.filter(msg => msg.id !== tempId);

// Helper to update message status
export const updateMessageStatus = (
  messages: Message[],
  messageId: string,
  status: Message['status']
): Message[] =>
  messages.map(msg =>
    msg.id === messageId 
      ? { ...msg, status }
      : msg
  );

// Helper to update message content
export const updateMessageContent = (
  messages: Message[],
  messageId: string,
  content: string
): Message[] =>
  messages.map(msg =>
    msg.id === messageId 
      ? { ...msg, content }
      : msg
  );
