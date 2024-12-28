/**
 * useAutoScroll.ts
 * Custom hook for managing chat auto-scroll behavior
 * 
 * Features:
 * - Manages auto-scroll state based on user scroll position
 * - Handles smooth scrolling during streaming
 * - Provides scroll utilities for the chat container
 */

import { useEffect, useState, RefObject } from 'react';
import { scrollToBottom } from '../utils';
import { Message } from '../../../types';

interface AutoScrollOptions {
  /** Reference to the message container element */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Array of chat messages */
  messages: Message[];
  /** Whether messages are currently streaming */
  isStreaming: boolean;
}

/**
 * Custom hook to manage chat auto-scroll behavior
 * @param options Configuration options for auto-scroll behavior
 * @returns Object containing auto-scroll state and utilities
 */
export const useAutoScroll = ({ containerRef, messages, isStreaming }: AutoScrollOptions) => {
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const latestMessageContent = messages[messages.length - 1]?.content || "";

  // Handle scroll events to determine auto-scroll behavior
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop <=
        container.clientHeight + 100;
      setShouldAutoScroll(isAtBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef]);

  // Handle auto-scrolling behavior
  useEffect(() => {
    if (!shouldAutoScroll || !containerRef.current) return;

    if (isStreaming) {
      // Smooth scroll during streaming
      scrollToBottom(containerRef.current, true);
    } else {
      const isLatestMessageFromUser =
        messages[messages.length - 1]?.role === "user";
      const wasStreaming =
        messages[messages.length - 1]?.status === "streaming";

      // Add delay for assistant messages that were previously streaming
      if (!isLatestMessageFromUser && wasStreaming) {
        setTimeout(() => {
          if (containerRef.current) {
            scrollToBottom(containerRef.current, true);
          }
        }, 100);
      } else {
        scrollToBottom(containerRef.current, !isLatestMessageFromUser);
      }
    }
  }, [messages.length, latestMessageContent, isStreaming, shouldAutoScroll, containerRef]);

  return {
    shouldAutoScroll,
    setShouldAutoScroll
  };
};
