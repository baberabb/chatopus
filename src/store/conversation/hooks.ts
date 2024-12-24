import { useMemo } from 'react';
import { useConversationStore } from './store';
import { Conversation } from './types';

export function useConversations() {
  const {
    conversations,
    currentId,
    loading,
    error,
    loadConversations,
    setCurrentConversation,
    createConversation,
    deleteConversation,
    updateConversation,
  } = useConversationStore();

  // Derived state
  const currentConversation = useMemo(() => 
    currentId ? conversations.get(currentId) : null,
    [conversations, currentId]
  );

  const sortedConversations = useMemo(() => 
    Array.from(conversations.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [conversations]
  );

  // Utility functions
  const switchToConversation = async (id: number) => {
    if (id === currentId) return;
    await setCurrentConversation(id);
  };

  const createNewConversation = async () => {
    const id = await createConversation();
    await switchToConversation(id);
    return id;
  };

  const updateTitle = async (id: number, title: string) => {
    await updateConversation(id, { title });
  };

  const updateSystemMessage = async (id: number, systemMessage: string) => {
    await updateConversation(id, { systemMessage });
  };

  return {
    // Core state
    conversations,
    currentId,
    loading,
    error,

    // Derived state
    currentConversation,
    sortedConversations,

    // Actions
    loadConversations,
    switchToConversation,
    createNewConversation,
    deleteConversation,
    updateTitle,
    updateSystemMessage,
  };
}
