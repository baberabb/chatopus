import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { MessageState, MessageResponse, SendMessageResponse } from './types';
import { Message, FileAttachment } from '../../types';

type MessageStatus = 'streaming' | 'complete' | 'error';

export const useMessageStore = create<MessageState>((set, get) => ({
  // Core state
  messagesByConversation: new Map(),
  
  // Streaming state
  streaming: {
    conversationId: null,
    messageId: null,
    status: 'idle',
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

  sendMessage: async (conversationId: number, content: string, attachments?: FileAttachment[]) => {
    // Reset any previous errors
    set({ error: null });

    // Create temporary user message
    const tempUserMessage: Message = {
      id: Date.now(), // Temporary ID
      content,
      role: 'user',
      timestamp: new Date().toISOString(),
      attachments,
      status: 'complete' as MessageStatus,
    };

    // Add user message optimistically
    set(state => {
      const conversationMessages = state.messagesByConversation.get(conversationId) || [];
      const newMessages = [...conversationMessages, tempUserMessage];
      return {
        messagesByConversation: new Map(state.messagesByConversation).set(
          conversationId,
          newMessages
        ),
      };
    });

    try {
      // Create temporary assistant message for streaming
      const tempAssistantMessage: Message = {
        id: Date.now() + 1, // Different temporary ID
        content: '',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        status: 'streaming' as MessageStatus,
      };

      // Add assistant message
      set(state => {
        const conversationMessages = state.messagesByConversation.get(conversationId) || [];
        const newMessages = [...conversationMessages, tempAssistantMessage];
        return {
          messagesByConversation: new Map(state.messagesByConversation).set(
            conversationId,
            newMessages
          ),
          streaming: {
            conversationId,
            messageId: tempAssistantMessage.id,
            status: 'streaming',
          },
        };
      });

      // Send message to backend
      const response = await invoke<SendMessageResponse>('process_message', {
        message: content,
        conversationId,
      });

      // Update messages with real IDs and content
      set(state => {
        const conversationMessages = state.messagesByConversation.get(conversationId) || [];
        const updatedMessages = conversationMessages.map(msg => {
          if (msg.id === tempUserMessage.id) {
            return { ...msg, id: response.userMessageId };
          }
          if (msg.id === tempAssistantMessage.id) {
            return {
              ...msg,
              id: response.assistantMessageId,
              content: response.reply.content,
              status: 'complete' as MessageStatus,
            };
          }
          return msg;
        });

        return {
          messagesByConversation: new Map(state.messagesByConversation).set(
            conversationId,
            updatedMessages
          ),
          streaming: {
            conversationId: null,
            messageId: null,
            status: 'idle',
          },
        };
      });
    } catch (error) {
      // Update streaming state and set error
      set(state => ({
        streaming: {
          conversationId: null,
          messageId: null,
          status: 'error',
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
          msg.id === messageId ? { ...msg, content } : msg
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
          ? { ...msg, content: msg.content + chunk }
          : msg
      );

      return {
        messagesByConversation: new Map(state.messagesByConversation).set(
          conversationId,
          updatedMessages
        ),
      };
    });
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
