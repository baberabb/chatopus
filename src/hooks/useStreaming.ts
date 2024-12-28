/**
 * useStreaming.ts
 * Custom hook for managing streaming state in the chat interface.
 * 
 * This hook handles the global streaming state by listening to Tauri events:
 * - stream-start: Emitted when streaming begins
 * - stream-progress: Emitted during streaming
 * - stream-complete: Emitted when streaming ends
 * 
 * The streaming state is used to coordinate UI updates during message streaming,
 * particularly for code blocks and other dynamic content.
 */

import { useState, useEffect, useCallback } from 'react';
import { listen } from "@tauri-apps/api/event";

/**
 * Hook for managing streaming state
 * @returns {Object} Streaming state and control functions
 * @property {boolean} isStreaming - Current streaming state
 * @property {function} setStreaming - Function to manually update streaming state
 */
export function useStreaming() {
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    // Listen for stream start events
    const unlistenStart = listen("stream-start", () => {
      setIsStreaming(true);
    });

    // Listen for stream progress events
    const unlistenProgress = listen("stream-progress", () => {
      setIsStreaming(true);
    });

    // Listen for stream complete events
    const unlistenComplete = listen("stream-complete", () => {
      setIsStreaming(false);
    });

    return () => {
      unlistenStart.then(fn => fn());
      unlistenProgress.then(fn => fn());
      unlistenComplete.then(fn => fn());
    };
  }, []);

  const updateStreaming = useCallback((value: boolean) => {
    setIsStreaming(value);
  }, []);

  return {
    isStreaming,
    setStreaming: updateStreaming
  };
}
