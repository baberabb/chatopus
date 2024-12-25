import { useEffect } from 'react';
import { listen } from "@tauri-apps/api/event";
import { useMessageStore } from '../store/message';

export function useStreamEvents(onComplete?: () => void) {
  const { setStreamComplete, setStreamStart, appendStreamChunk } = useMessageStore();

  useEffect(() => {
    const unlistenComplete = listen("stream-complete", () => {
      setStreamComplete();
      if (onComplete) onComplete();
    });

    const unlistenStart = listen("stream-start", () => {
      setStreamStart();
    });

    const unlistenResponse = listen<string>("stream-response", (event) => {
      appendStreamChunk(event.payload);
    });

    return () => {
      unlistenComplete.then(fn => fn());
      unlistenStart.then(fn => fn());
      unlistenResponse.then(fn => fn());
    };
  }, [onComplete, setStreamComplete, setStreamStart, appendStreamChunk]);
}
