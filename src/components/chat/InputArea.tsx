import React, { useState, useRef, useEffect } from "react";
import { Paperclip, Zap, CornerRightUp, XCircle } from "lucide-react";
import { useZustandTheme } from "../../store";
import { useStreamEvents } from "../../hooks/useStreamEvents";

interface InputAreaProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  isCancellable?: boolean;
  onCancel?: () => void;
}

interface ActionButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
  icon: React.ReactNode;
  label: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  disabled,
  variant = "default",
  icon,
  label,
}) => {
  const baseClasses = "p-3 transition-colors";
  const variantClasses = {
    default: "text-gray-400 hover:text-white disabled:hover:text-gray-400",
    danger: "text-red-400 hover:text-red-500",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      type="button"
    >
      {icon}
    </button>
  );
};

export const InputArea: React.FC<InputAreaProps> = React.memo(
  ({ onSend, isStreaming: initialStreaming, isCancellable, onCancel }) => {
    const { theme } = useZustandTheme();
    const [isStreaming, setIsStreaming] = useState(initialStreaming);

    useStreamEvents(() => {
      setIsStreaming(false);
    });
    const [input, setInput] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = () => {
      const trimmedInput = input.trim();
      if (trimmedInput && !isStreaming) {
        onSend(trimmedInput);
        setInput("");
      }
    };

    const adjustTextareaHeight = () => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "44px";
        const scrollHeight = textarea.scrollHeight;
        textarea.style.height = Math.min(scrollHeight, 200) + "px";
      }
    };

    useEffect(() => {
      adjustTextareaHeight();
    }, [input]);

    return (
      <div
        className="absolute bottom-0 left-0 right-0 bg-opacity-80 backdrop-blur-sm"
        style={{
          backgroundColor: theme.background,
          borderTop: `1px solid ${theme.border}`,
        }}
      >
        <form
          className="p-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <div
            className="flex items-end rounded-lg"
            style={{
              backgroundColor: theme.surface,
              boxShadow: `0 2px 4px -2px ${theme.shadowColor}, 0 1px 2px -1px ${theme.shadowColor}`,
            }}
          >
            <ActionButton
              icon={<Paperclip size={20} />}
              label="Attach file"
              disabled={isStreaming}
            />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 bg-transparent p-3 focus:outline-none resize-none min-h-[44px] font-sans leading-tight overflow-y-auto"
              style={{ color: theme.text }}
              placeholder="Type a message..."
              rows={1}
              disabled={isStreaming}
              aria-label="Message input"
            />
            {isCancellable && onCancel ? (
              <ActionButton
                icon={<XCircle size={20} />}
                onClick={onCancel}
                variant="danger"
                label="Cancel message"
              />
            ) : (
              <ActionButton
                icon={
                  isStreaming ? <Zap size={20} /> : <CornerRightUp size={20} />
                }
                onClick={handleSend}
                disabled={isStreaming}
                label={isStreaming ? "Processing" : "Send message"}
              />
            )}
          </div>
        </form>
      </div>
    );
  }
);

InputArea.displayName = "InputArea";
