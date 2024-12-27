import { Message } from "@/types";

/**
 * Helper function to generate consistent colors for avatars based on string input
 */
export function stringToColor(string: string) {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  return color;
}

/**
 * Helper function to generate avatar properties based on user name
 */
export function stringAvatar(name: string | undefined) {
  if (!name) {
    return {
      sx: { bgcolor: stringToColor("UN") },
      children: "UN",
    };
  }
  const nameParts = name.split(" ");
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[1][0]}`
      : nameParts[0][0];
  return {
    sx: { bgcolor: stringToColor(name) },
    children: initials,
  };
}

/**
 * Helper function to get current time in consistent format
 */
export const getCurrentTime = () => {
  return new Date().toLocaleTimeString('en-US', { 
    hour: 'numeric',
    minute: '2-digit',
    hour12: true 
  });
};

/**
 * Helper function to format message role display
 */
export const formatMessageRole = (role: string, model?: string) => {
  return role === "user" ? "You" : model || "Assistant";
};

/**
 * Helper function to find message index by ID
 */
export const findMessageById = (messages: Message[], id: number) => {
  return messages.findIndex(msg => msg.id === id);
};

/**
 * Helper function to create a temporary message object
 */
export const createTempMessage = (content: string, role: "user" | "assistant", model?: string): Message => {
  return {
    id: `temp-${role}-${Date.now()}`,
    content,
    role,
    model,
    timestamp: getCurrentTime(),
    reactions: { thumbsUp: 0 },
  };
};

/**
 * Helper function to scroll chat container to bottom
 * @param container - The chat container element
 * @param smooth - Whether to use smooth scrolling
 */
export const scrollToBottom = (container: HTMLElement | null, smooth: boolean = true) => {
  if (!container) return;
  
  const scrollHeight = container.scrollHeight;
  container.scrollTo({
    top: scrollHeight,
    behavior: smooth ? 'smooth' : 'auto' as ScrollBehavior
  });
};
