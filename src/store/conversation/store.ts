import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { ConversationState, Conversation, ConversationResponse } from './types';
import { SendMessageResponse } from '../message/types';

export const useConversationStore = create<ConversationState>((set, get) => ({
  // State
  conversations: new Map(),
  currentId: null,
  loading: false,
  error: null,

  // Actions
  loadConversations: async () => {
    set({ loading: true, error: null });
    try {
      const response = await invoke<ConversationResponse[]>('get_conversations');
      const conversations = new Map(
        response.map(conv => [conv.id, conv as Conversation])
      );
      set({ conversations, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load conversations',
        loading: false 
      });
    }
  },

  setCurrentConversation: async (id: number | null) => {
    set({ currentId: id, error: null });
    if (id) {
      try {
        await invoke('load_conversation_messages', { conversationId: id });
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to load conversation',
          currentId: null
        });
      }
    }
  },

  createConversation: async () => {
    set({ loading: true, error: null });
    try {
      // Create new conversation using clear_chat_history
      const id = await invoke<number>('clear_chat_history');
      const newConv: Conversation = {
        id,
        title: 'New Chat',
        preview: '',
        model: '',
        messageCount: 0,
        timestamp: new Date().toISOString(),
      };
      set(state => ({
        conversations: new Map(state.conversations).set(id, newConv),
        currentId: id,
        loading: false
      }));
      return id;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create conversation',
        loading: false 
      });
      throw error;
    }
  },

  deleteConversation: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await invoke('delete_conversation', { conversationId: id });
      set(state => {
        const newConversations = new Map(state.conversations);
        newConversations.delete(id);
        return {
          conversations: newConversations,
          currentId: state.currentId === id ? null : state.currentId,
          loading: false
        };
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete conversation',
        loading: false 
      });
      throw error;
    }
  },

  updateConversation: async (id: number, updates: Partial<Conversation>) => {
    set({ loading: true, error: null });
    try {
      await invoke('update_conversation', { 
        conversationId: id, 
        updates 
      });
      set(state => {
        const conversation = state.conversations.get(id);
        if (!conversation) return state;

        const newConversations = new Map(state.conversations);
        newConversations.set(id, { ...conversation, ...updates });
        
        return {
          conversations: newConversations,
          loading: false
        };
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update conversation',
        loading: false 
      });
      throw error;
    }
  }
}));
