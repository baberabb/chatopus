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
    setCurrentConversation,
    createConversation,
    deleteConversation,
    updateConversation
  } = useConversationStore();

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
    if (!currentId) return;
    await sendMessage(currentId, content, attachments);
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
