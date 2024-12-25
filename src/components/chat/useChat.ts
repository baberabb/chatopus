import { useConversationStore } from "../../store/conversation";
import { useMessageStore } from "../../store/message";
import { FileAttachment } from "../../types";

export function useChat() {
  const {
    conversations,
    currentId,
    loading: conversationLoading,
    error: conversationError,
    loadConversations,
    setCurrentConversation: setCurrentConversationBase,
    createConversation,
    deleteConversation,
    updateConversation
  } = useConversationStore();

  // Wrap setCurrentConversation to also load messages
  const setCurrentConversation = async (id: number | null) => {
    await setCurrentConversationBase(id);
    if (id) {
      await loadMessages(id);
    }
  };

  const {
    messagesByConversation,
    loading: messageLoading,
    error: messageError,
    streaming,
    loadMessages,
    sendMessage,
    editMessage,
    cancelMessage,
  } = useMessageStore();

  const currentConversation = currentId 
    ? conversations.get(currentId)
    : null;

  const messages = currentId 
    ? messagesByConversation.get(currentId) || []
    : [];

  const isLoading = conversationLoading || messageLoading;
  const error = messageError || conversationError;

  const handleSendMessage = async (content: string, attachments?: FileAttachment[]) => {
    try {
      // If no current conversation, create one first
      if (!currentId) {
        const newId = await createConversation();
        await setCurrentConversation(newId);
      }
      
      // Send message
      await sendMessage(currentId, content, attachments);
      
      // Reload conversations to get any updates
      await loadConversations();
      
      // Reload messages to ensure they're up to date
      if (currentId) {
        await loadMessages(currentId);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  };

  const handleEditMessage = async (messageId: number, content: string) => {
    if (!currentId) return;
    await editMessage(currentId, messageId, content);
  };

  return {
    // State
    currentConversation,
    conversations,
    currentId,
    messages,
    isLoading,
    error,
    streaming,
    
    // Conversation actions
    loadConversations,
    setCurrentConversation,
    createConversation,
    deleteConversation,
    updateConversation,
    
    // Message actions
    loadMessages,
    sendMessage: handleSendMessage,
    handleEdit: handleEditMessage,
    cancelMessage,
  };
}
