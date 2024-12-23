import { Message } from "./types";
import { logger } from "../utils/logger";

let tempIdCounter = -1;

// Create temporary ID for optimistic updates (negative numbers)
const createTempId = () => {
  tempIdCounter--;
  return tempIdCounter;
};

// Create optimistic message
export const createOptimisticMessage = (
  content: string,
  role: string,
  status: Message['status'] = 'complete'
): Message => ({
  id: createTempId(),
  content,
  role,
  timestamp: new Date().toISOString(),
  status,
});

// Create optimistic assistant message
export const createOptimisticAssistantMessage = (): Message => {
  const message: Message = {
    id: createTempId(),
    role: 'assistant',
    content: '',
    timestamp: new Date().toISOString(),
    status: 'streaming'
  };
  
  // Log optimistic message creation
  logger.state('Store', {
    action: 'create_optimistic_message',
    message
  });

  return message;
};

// Helper to check if message is optimistic
export const isOptimisticMessage = (id: number) => id < 0;

// Helper to update message ID after backend save
export const updateMessageId = (messages: Message[], tempId: number, realId: number): Message[] => 
  messages.map(msg => 
    msg.id === tempId 
      ? { ...msg, id: realId }
      : msg
  );

// Helper to roll back optimistic message
export const rollbackMessage = (messages: Message[], tempId: number): Message[] =>
  messages.filter(msg => msg.id !== tempId);

// Helper to update message status
export const updateMessageStatus = (
  messages: Message[],
  messageId: number,
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
  messageId: number,
  content: string
): Message[] =>
  messages.map(msg =>
    msg.id === messageId 
      ? { ...msg, content }
      : msg
  );
