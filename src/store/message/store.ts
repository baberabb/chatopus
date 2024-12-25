import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { MessageState, MessageResponse, SendMessageResponse } from './types';
import { Message, FileAttachment, ContentBlock } from '../../types';

type MessageStatus = 'streaming' | 'complete' | 'error';

export const useMessageStore = create<MessageState>((set, get) => ({
  // Core state
  messagesByConversation: new Map(),
  
  // Streaming state
  streaming: {
    conversationId: null,
    messageId: null,
    status: 'idle',
    isActive: false,
  },
  
  // Status
  loading: false,
  error: null,

  // Actions
  loadMessages: async (conversationId: number) => {
    set({ loading: true, error: null });
    try {
      const messages = await invoke<MessageResponse[]>('load_conversation_messages', {
        conversationId,
      });
      
      set(state => ({
        messagesByConversation: new Map(state.messagesByConversation).set(
          conversationId,
          messages as Message[]
        ),
        loading: false,
      }));
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load messages',
        loading: false,
      });
    }
  },

  // Helper to clear streaming state
  clearStreaming: () => {
    set(state => ({
      streaming: {
        conversationId: null,
        messageId: null,
        status: 'idle',
        isActive: false,
      }
    }));
  },

  sendMessage: async (conversationId: number | null, content: string, attachments?: FileAttachment[]) => {
    // Reset any previous errors
    set({ error: null });

    // Create temporary user message
    const tempUserMessage: Message = {
      id: Date.now() as number, // Temporary ID
      content: [{ type: 'text', text: content }],
      role: 'user',
      timestamp: new Date().toISOString(),
      attachments,
      status: 'complete' as MessageStatus,
    };

    let tempMessages = [tempUserMessage];

    try {
      // Create temporary assistant message for streaming
      const tempAssistantMessage: Message = {
        id: (Date.now() + 1) as number, // Different temporary ID
        content: [] as ContentBlock[],
        role: 'assistant',
        timestamp: new Date().toISOString(),
        status: 'streaming' as MessageStatus,
      };

      tempMessages.push(tempAssistantMessage);

      console.log('Sending message:', {
        message: content,
        conversation_id: conversationId || null
      });
      
      // Set initial streaming state
      set(state => ({
        streaming: {
          conversationId: conversationId,
          messageId: tempAssistantMessage.id,
          status: 'streaming',
          isActive: true,
        }
      }));
      
      // Send message to backend
      const response = await invoke<SendMessageResponse>('process_message', {
        request: {
          message: content,
          conversation_id: conversationId || undefined,
        }
      }).catch(error => {
        console.error('Backend error:', error);
        if (error.message?.includes('conversation')) {
          throw new Error('Failed to create conversation');
        }
        throw error;
      });

      // Update messages with real IDs and content
      const updatedMessages = tempMessages.map(msg => {
        if (msg.id === tempUserMessage.id) {
          return { ...msg, id: response.user_message_id };
        }
        if (msg.id === tempAssistantMessage.id) {
          return {
            ...msg,
            id: response.assistant_message_id,
            content: response.reply,
            status: 'complete' as MessageStatus,
          };
        }
        return msg;
      });

      // Update state with new conversation ID and messages
      const updatedConversationId = response.conversation_id;
      set(state => {
        // Get existing messages for the conversation if any
        const existingMessages = state.messagesByConversation.get(updatedConversationId) || [];
        
        // Combine existing messages with new ones
        const allMessages = [...existingMessages, ...updatedMessages];
        
        return {
          messagesByConversation: new Map(state.messagesByConversation).set(
            updatedConversationId,
            allMessages
          ),
          streaming: {
            conversationId: updatedConversationId,
            messageId: null,
            status: 'idle',
            isActive: false,
          }
        };
      });
    } catch (error) {
      // Update streaming state and set error
      set(state => ({
        streaming: {
          conversationId: null,
          messageId: null,
          status: 'error',
          isActive: false,
        },
        error: error instanceof Error ? error.message : 'Failed to send message',
      }));
    }
  },

  editMessage: async (conversationId: number, messageId: number, content: string) => {
    set({ error: null });
    try {
      await invoke('edit_message', {
        messageId: messageId.toString(),
        newContent: content,
      });

      set(state => {
        const conversationMessages = state.messagesByConversation.get(conversationId) || [];
        const updatedMessages = conversationMessages.map(msg =>
          msg.id === messageId ? { ...msg, content: [{ type: 'text', text: content }] } : msg
        );

        return {
          messagesByConversation: new Map(state.messagesByConversation).set(
            conversationId,
            updatedMessages
          ),
        };
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to edit message',
      });
    }
  },

  cancelMessage: async () => {
    try {
      await invoke('cancel_message');
      set(state => {
        const { conversationId, messageId } = state.streaming;
        if (!conversationId || !messageId) return state;

        const conversationMessages = state.messagesByConversation.get(conversationId) || [];
        const updatedMessages = conversationMessages.map(msg =>
          msg.id === messageId ? { ...msg, status: 'complete' as MessageStatus } : msg
        );

        return {
          messagesByConversation: new Map(state.messagesByConversation).set(
            conversationId,
            updatedMessages
          ),
          streaming: {
            conversationId: null,
            messageId: null,
            status: 'idle',
            isActive: false,
          },
        };
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to cancel message',
        streaming: {
          conversationId: null,
          messageId: null,
          status: 'idle',
          isActive: false,
        },
      });
    }
  },

  appendStreamChunk: (chunk: string) => {
    set(state => {
      const { conversationId, messageId } = state.streaming;
      if (!conversationId || !messageId) return state;

      const conversationMessages = state.messagesByConversation.get(conversationId) || [];
      const updatedMessages = conversationMessages.map(msg =>
        msg.id === messageId
          ? { 
              ...msg, 
              content: typeof msg.content === 'string' 
                ? msg.content + chunk
                : [...msg.content, { type: 'text', text: chunk }]
            }
          : msg
      );

      return {
        messagesByConversation: new Map(state.messagesByConversation).set(
          conversationId,
          updatedMessages
        ),
        streaming: {
          ...state.streaming,
          isActive: true,
        }
      };
    });
  },

  setStreamComplete: () => {
    set(state => ({
      streaming: {
        ...state.streaming,
        isActive: false,
        status: 'complete' as MessageStatus,
      }
    }));
  },

  setStreamStart: () => {
    set(state => ({
      streaming: {
        ...state.streaming,
        isActive: true,
        status: 'streaming' as MessageStatus,
      }
    }));
  },

  clearMessages: (conversationId: number) => {
    set(state => ({
      messagesByConversation: new Map(state.messagesByConversation).set(
        conversationId,
        []
      ),
    }));
  },
}));
