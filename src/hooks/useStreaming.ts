import { useState, useEffect, useCallback } from 'react';
import { listen } from "@tauri-apps/api/event";

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
