/**
 * useCodeEditor.ts
 * Custom hook for managing code editor state and functionality in code blocks.
 * 
 * This hook handles:
 * 1. Code content updates during streaming and non-streaming states
 * 2. Edit mode functionality with textarea resizing
 * 3. Keyboard interactions (tab, escape)
 * 
 * During streaming, code updates are applied immediately to ensure real-time
 * content display. After streaming completes, updates are scheduled with
 * requestAnimationFrame to optimize rendering performance.
 */

import { useState, useRef, useEffect } from 'react';

/**
 * Hook for managing code editor state and operations
 * @param initialValue - Initial code content to display
 * @param isStreaming - Whether content is currently being streamed
 * @returns {Object} Editor state and control functions
 * @property {string} code - Current code content
 * @property {function} setCode - Function to update code content
 * @property {boolean} isEditing - Whether editor is in edit mode
 * @property {RefObject} textareaRef - Reference to textarea element
 * @property {function} handleKeyDown - Keyboard event handler
 * @property {function} startEditing - Function to enter edit mode
 * @property {function} stopEditing - Function to exit edit mode
 */
export const useCodeEditor = (initialValue: string, isStreaming: boolean) => {
  const [code, setCode] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update code immediately for streaming changes
  useEffect(() => {
    if (isStreaming) {
      // During streaming, update immediately
      setCode(initialValue);
    } else {
      // After streaming, ensure we have the final value
      requestAnimationFrame(() => {
        setCode(initialValue);
      });
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
