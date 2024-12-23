import { Message, Conversation } from "../store";

export interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  isLoading: boolean;
  currentConversationId: string | null;
}

export class StateGuard {
  private state: ChatState;

  constructor(state: ChatState) {
    this.state = state;
  }

  canSendMessage(): { allowed: boolean; reason?: string } {
    if (this.state.isStreaming) {
      return {
        allowed: false,
        reason: "Cannot send message while streaming",
      };
    }

    if (this.state.isLoading) {
      return {
        allowed: false,
        reason: "Cannot send message while loading",
      };
    }

    return { allowed: true };
  }

  canEditMessage(messageId: string): { allowed: boolean; reason?: string } {
    if (this.state.isStreaming) {
      return {
        allowed: false,
        reason: "Cannot edit message while streaming",
      };
    }

    const message = this.state.messages.find(msg => msg.id === messageId);
    if (!message) {
      return {
        allowed: false,
        reason: "Message not found",
      };
    }

    if (message.status === 'streaming') {
      return {
        allowed: false,
        reason: "Cannot edit streaming message",
      };
    }

    return { allowed: true };
  }

  canSwitchConversation(): { allowed: boolean; reason?: string } {
    if (this.state.isStreaming) {
      return {
        allowed: false,
        reason: "Cannot switch conversation while streaming",
      };
    }

    if (this.state.isLoading) {
      return {
        allowed: false,
        reason: "Cannot switch conversation while loading",
      };
    }

    return { allowed: true };
  }

  canDeleteConversation(conversationId: string): { allowed: boolean; reason?: string } {
    if (this.state.isStreaming && this.state.currentConversationId === conversationId) {
      return {
        allowed: false,
        reason: "Cannot delete active conversation while streaming",
      };
    }

    return { allowed: true };
  }

  canCreateConversation(): { allowed: boolean; reason?: string } {
    if (this.state.isStreaming) {
      return {
        allowed: false,
        reason: "Cannot create conversation while streaming",
      };
    }

    if (this.state.isLoading) {
      return {
        allowed: false,
        reason: "Cannot create conversation while loading",
      };
    }

    return { allowed: true };
  }

  // Helper to ensure operations are allowed
  static assertOperation(check: { allowed: boolean; reason?: string }): void {
    if (!check.allowed) {
      throw new Error(check.reason || "Operation not allowed");
    }
  }
}

// Helper to create guard instance
export const createGuard = (state: ChatState) => new StateGuard(state);
