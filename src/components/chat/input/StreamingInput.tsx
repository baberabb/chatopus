/**
 * StreamingInput.tsx
 * Component for handling chat input with streaming support
 *
 * Features:
 * - Handles message input and submission
 * - Supports file attachments
 * - Manages streaming state and cancellation
 */

import React from "react";
import { useStreaming } from "../../../hooks/useStreaming";
import { InputArea } from "../InputArea";
import { FileAttachment } from "../../../types";

interface StreamingInputProps {
  /** Callback function to send a new message */
  onSend: (content: string, attachments?: FileAttachment[]) => Promise<void>;
  /** Callback function to cancel ongoing message streaming */
  onCancel: () => Promise<void>;
}

/**
 * StreamingInput component handles the chat input area and streaming state
 * @component
 */
export const StreamingInput: React.FC<StreamingInputProps> = ({
  onSend,
  onCancel,
}) => {
  const { isStreaming } = useStreaming();

  return (
    <InputArea
      onSend={onSend}
      isStreaming={isStreaming}
      isCancellable={isStreaming}
      onCancel={onCancel}
    />
  );
};
