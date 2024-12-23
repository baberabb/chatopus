import { Message, ChatState } from "./types";

export interface GuardState {
  messages: Message[];
  isLoading: boolean;
  currentConversationId: number | null;
}

export class StateGuard {
  private state: GuardState;

  constructor(state: GuardState) {
    this.state = state;
  }

  private isStreaming(): boolean {
    return this.state.messages[this.state.messages.length - 1]?.status === 'streaming';
  }

  canSendMessage(): { allowed: boolean; reason?: string } {
    if (this.isStreaming()) {
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

  canEditMessage(messageId: number): { allowed: boolean; reason?: string } {
    if (this.isStreaming()) {
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
    if (this.isStreaming()) {
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

  canDeleteConversation(conversationId: number): { allowed: boolean; reason?: string } {
    if (this.isStreaming() && conversationId === this.state.currentConversationId) {
      return {
        allowed: false,
        reason: "Cannot delete active conversation while streaming",
      };
    }

    return { allowed: true };
  }

  canCreateConversation(): { allowed: boolean; reason?: string } {
    if (this.isStreaming()) {
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
export const createGuard = (state: GuardState) => new StateGuard(state);
