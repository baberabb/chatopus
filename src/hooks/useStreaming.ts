import { useRef, useEffect } from 'react';
import { listen } from "@tauri-apps/api/event";

// Global ref to track streaming state without triggering re-renders
let isStreamingRef = false;

export function useStreaming() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Set up event listeners that don't trigger re-renders
    const unlisten = listen("stream-complete", () => {
      isStreamingRef = false;
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  return {
    setStreaming: (value: boolean) => {
      isStreamingRef = value;
    },
    isStreaming: () => isStreamingRef
  };
}
