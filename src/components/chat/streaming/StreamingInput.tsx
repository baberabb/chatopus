import React from "react";
import { useStreaming } from "../../../hooks/useStreaming";
import { InputArea } from "../core/InputArea";
import { StreamingInputProps } from "../types/index";

/**
 * StreamingInput component handles the chat input area with streaming state management.
 * It provides a text input for sending messages and controls for managing streaming state.
 *
 * @component
 * @example
 * ```tsx
 * <StreamingInput
 *   onSend={async (content) => {
 *     await sendMessage(content);
 *   }}
 *   onCancel={async () => {
 *     await cancelStreaming();
 *   }}
 * />
 * ```
 */
export const StreamingInput: React.FC<StreamingInputProps> = ({
  onSend,
  onCancel,
}) => {
  const streaming = useStreaming();
  const isStreaming = streaming.isStreaming();

  return (
    <InputArea
      onSend={onSend}
      isStreaming={isStreaming}
      isCancellable={isStreaming}
      onCancel={onCancel}
    />
  );
};
