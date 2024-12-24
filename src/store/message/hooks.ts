import { useMemo } from 'react';
import { useMessageStore } from './store';
import { Message } from '../../types';

export function useMessages(conversationId: number | null) {
  const {
    messagesByConversation,
    streaming,
    loading,
    error,
    loadMessages,
    sendMessage,
    editMessage,
    cancelMessage,
  } = useMessageStore();

  // Get messages for current conversation
  const messages = useMemo(() => 
    conversationId ? messagesByConversation.get(conversationId) || [] : [],
    [messagesByConversation, conversationId]
  );

  // Get latest message
  const latestMessage = useMemo(() => 
    messages[messages.length - 1],
    [messages]
  );

  // Check if currently streaming in this conversation
  const isStreaming = useMemo(() => 
    streaming.conversationId === conversationId && streaming.status === 'streaming',
    [streaming, conversationId]
  );

  // Utility functions
  const send = async (content: string) => {
    if (!conversationId) return;
    await sendMessage(conversationId, content);
  };

  const edit = async (messageId: number, content: string) => {
    if (!conversationId) return;
    await editMessage(conversationId, messageId, content);
  };

  const load = async () => {
    if (!conversationId) return;
    await loadMessages(conversationId);
  };

  return {
    // State
    messages,
    latestMessage,
    isStreaming,
    loading,
    error,

    // Actions
    send,
    edit,
    load,
    cancelMessage,
  };
}
