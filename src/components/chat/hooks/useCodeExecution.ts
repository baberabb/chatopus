/**
 * useCodeExecution.ts
 * Custom hook for handling code execution in different languages
 */

import { useState } from 'react';
import { invoke } from "@tauri-apps/api/core";

/**
 * Result of code execution
 * @interface ExecutionResult
 * @property {string} output - The execution output or error message
 * @property {boolean} success - Whether the execution was successful
 */
interface ExecutionResult {
  output: string;
  success: boolean;
}

/**
 * Executes code in different languages using Tauri's invoke
 * @param code - The code to execute
 * @param language - The programming language
 * @returns Promise with execution result
 */
const executeCode = async (code: string, language: string): Promise<ExecutionResult> => {
  try {
    switch (language.toLowerCase()) {
      case "python": {
        const msgid = await invoke<string>("execute_code", { code });
        const output = await invoke<string>("receive_message", { msgid });
        return { output, success: true };
      }
      case "html": {
        const label = `html-preview-${Date.now()}`;
        await invoke("create_preview", {
          label,
          content: code,
          title: "HTML Preview",
          width: 800,
          height: 600,
        });
        return { output: "HTML opened in new window", success: true };
      }
      default:
        return {
          output: `Language ${language} is not supported yet`,
          success: false
        };
    }
  } catch (error) {
    console.error("Code execution error:", error);
    return {
      output: `Error: ${error instanceof Error ? error.message : String(error)}`,
      success: false
    };
  }
};

/**
 * Hook for managing code execution state and operations
 * @param code - The code to execute
 * @param language - The programming language
 */
export const useCodeExecution = (code: string, language: string) => {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCode = async () => {
    setIsRunning(true);
    setOutput(null);
    setError(null);

    const result = await executeCode(code, language);
    
    if (result.success) {
      setOutput(result.output);
    } else {
      setError(result.output);
    }
    
    setIsRunning(false);
  };

  return {
    isRunning,
    output,
    error,
    runCode,
    setOutput,
    setError,
  };
};
