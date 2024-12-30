import { warn, debug, trace, info, error } from "@tauri-apps/plugin-log";

function forwardConsole(
  fnName: "log" | "debug" | "info" | "warn" | "error",
  logger: (message: string) => Promise<void>,
) {
  const original = console[fnName];
  console[fnName] = (...args) => {
    original.apply(console, args);
    // Convert args to string, handling objects
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(" ");
    logger(message).catch((err) => original("Logger error:", err));
  };
}

// Set up console forwarding
forwardConsole("log", trace);
forwardConsole("debug", debug);
forwardConsole("info", info);
forwardConsole("warn", warn);
forwardConsole("error", error);

// Utility functions for structured logging
export const logger = {
  scroll: (component: string, details: any) => {
    console.log(`[Scroll:${component}]`, details);
  },
  render: (component: string, details: any) => {
    console.log(`[Render:${component}]`, details);
  },
  state: (component: string, details: any) => {
    console.log(`[State:${component}]`, details);
  },
};
