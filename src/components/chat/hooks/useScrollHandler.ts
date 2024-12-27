import { useEffect } from 'react';
import { ScrollHandlerProps } from '../types/index';
import { scrollToBottom } from '../utils';

/**
 * Hook to handle auto-scrolling behavior in the chat container
 * 
 * @param props ScrollHandlerProps containing refs and state for scroll management
 * @returns Object containing scroll-related state and handlers
 */
export const useScrollHandler = ({
  messageListRef,
  shouldAutoScroll,
  messages,
  isStreaming,
}: ScrollHandlerProps) => {
  // Get the latest message content for scroll tracking
  const latestMessageContent = messages[messages.length - 1]?.content || "";

  useEffect(() => {
    if (!shouldAutoScroll) return;

    if (isStreaming) {
      // Smooth scroll during streaming
      scrollToBottom(messageListRef.current, true);
    } else {
      // For non-streaming cases, add a small delay to allow DOM to update
      const isLatestMessageFromUser =
        messages[messages.length - 1]?.role === "user";

      // Only add delay for assistant messages that were previously streaming
      const wasStreaming =
        messages[messages.length - 1]?.status === "streaming";
      if (!isLatestMessageFromUser && wasStreaming) {
        setTimeout(() => {
          scrollToBottom(messageListRef.current, true);
        }, 100); // Small delay to let DOM update
      } else {
        scrollToBottom(messageListRef.current, !isLatestMessageFromUser);
      }
    }
  }, [messages.length, latestMessageContent, isStreaming, shouldAutoScroll]);

  /**
   * Sets up scroll event listener to track when user manually scrolls
   * @returns Cleanup function to remove event listener
   */
  const setupScrollListener = () => {
  const container = messageListRef.current;
  if (!container) return undefined;

  const handleScroll = () => {
    if (!container) return false;
    const isAtBottom =
      container.scrollHeight - container.scrollTop <=
      container.clientHeight + 100;
    return isAtBottom;
  };

  container.addEventListener("scroll", handleScroll);
  return () => {
    if (container) {
      container.removeEventListener("scroll", handleScroll);
    }
  };
  };

  return {
    setupScrollListener,
  };
};
