/**
 * useCodeEditor.ts
 * Custom hook for managing code editor state and functionality
 */

import { useState, useRef, useEffect } from 'react';

/**
 * Hook for managing code editor state and operations
 * @param initialValue - Initial code content
 * @param isStreaming - Whether content is being streamed
 */
export const useCodeEditor = (initialValue: string, isStreaming: boolean) => {
  const [code, setCode] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update code when streaming new content
  useEffect(() => {
    if (isStreaming) {
      setCode(initialValue);
    }
  }, [initialValue, isStreaming]);

  /**
   * Adjusts textarea height to match content
   */
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // Adjust height when editing or content changes
  useEffect(() => {
    if (isEditing) {
      adjustTextareaHeight();
    }
  }, [isEditing, code]);

  /**
   * Handles special key events in the editor
   * @param e - Keyboard event
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      // Insert two spaces for tab
      const newCode = code.substring(0, start) + "  " + code.substring(end);
      setCode(newCode);
      
      // Maintain cursor position
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  /**
   * Starts editing mode
   */
  const startEditing = () => {
    setIsEditing(true);
    // Focus textarea after a short delay to ensure it's mounted
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  /**
   * Stops editing mode
   */
  const stopEditing = () => {
    setIsEditing(false);
  };

  return {
    code,
    setCode,
    isEditing,
    setIsEditing,
    textareaRef,
    adjustTextareaHeight,
    handleKeyDown,
    startEditing,
    stopEditing,
  };
};
