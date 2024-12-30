import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

export function useStreamEvents(onComplete?: () => void) {
  useEffect(() => {
    const unlisten = listen("stream-complete", () => {
      if (onComplete) onComplete();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onComplete]);
}
