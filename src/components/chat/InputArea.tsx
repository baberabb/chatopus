import React, { useState, useRef, useEffect } from "react";
import { Paperclip, Zap, CornerRightUp, XCircle, X } from "lucide-react";
import { useThemeStore } from "../../store";
import { useStreamEvents } from "../../hooks/useStreamEvents";
import { FileAttachment } from "../../types";

interface InputAreaProps {
  onSend: (message: string, attachments?: FileAttachment[]) => Promise<void>;
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
  const baseClasses = "px-4 transition-colors";
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
    const { theme } = useThemeStore();
    const [isStreaming, setIsStreaming] = useState(initialStreaming);
    const [attachments, setAttachments] = useState<FileAttachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useStreamEvents(() => {
      setIsStreaming(false);
    });
    const [input, setInput] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const newAttachments: FileAttachment[] = await Promise.all(
        files.map(async (file) => {
          const url = URL.createObjectURL(file);
          let previewUrl = url;

          // Generate preview URL for images
          if (file.type.startsWith("image/")) {
            previewUrl = url;
          }

          return {
            id: Math.random().toString(36).substring(7),
            name: file.name,
            type: file.type,
            size: file.size,
            url,
            previewUrl,
          };
        })
      );

      setAttachments((prev) => [...prev, ...newAttachments]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    const removeAttachment = (id: string) => {
      setAttachments((prev) => {
        const attachment = prev.find((a) => a.id === id);
        if (attachment) {
          URL.revokeObjectURL(attachment.url);
          if (
            attachment.previewUrl &&
            attachment.previewUrl !== attachment.url
          ) {
            URL.revokeObjectURL(attachment.previewUrl);
          }
        }
        return prev.filter((a) => a.id !== id);
      });
    };

    const handleSend = async () => {
      const trimmedInput = input.trim();
      if ((trimmedInput || attachments.length > 0) && !isStreaming) {
        try {
          await onSend(trimmedInput, attachments);
          setInput("");
          setAttachments([]);
        } catch (error) {
          console.error("Failed to send message:", error);
          // Let the error display component handle this
        }
      }
    };

    const adjustTextareaHeight = () => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "22px";
        const scrollHeight = textarea.scrollHeight;
        textarea.style.height = Math.min(scrollHeight, 200) + "px";
      }
    };

    useEffect(() => {
      adjustTextareaHeight();
    }, [input]);

    return (
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-2">
        {attachments.length > 0 && (
          <div
            className="flex flex-wrap gap-2 p-2 mb-2 rounded-lg"
            style={{ backgroundColor: theme.surface }}
          >
            {attachments.map((file) => (
              <div
                key={file.id}
                className="relative group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-opacity-50"
                style={{ backgroundColor: `${theme.surface}80` }}
              >
                {file.type.startsWith("image/") && file.previewUrl && (
                  <img
                    src={file.previewUrl}
                    alt={file.name}
                    className="w-6 h-6 object-cover rounded"
                  />
                )}
                <span className="text-sm truncate max-w-[200px]">
                  {file.name}
                </span>
                <button
                  onClick={() => removeAttachment(file.id)}
                  className="ml-1 text-gray-400 hover:text-white"
                  aria-label="Remove attachment"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <form
          className="flex items-center min-h-[44px] rounded-lg bg-opacity-60"
          style={{
            backgroundColor: theme.surface,
            boxShadow: `0 2px 10px ${theme.shadowColor}10`,
          }}
          onSubmit={async (e) => {
            e.preventDefault();
            await handleSend();
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.txt"
          />
          <ActionButton
            icon={<Paperclip size={22} />}
            label="Attach file"
            disabled={isStreaming}
            onClick={() => fileInputRef.current?.click()}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                await handleSend();
              }
            }}
            className="flex-1 bg-transparent px-4 focus:outline-none resize-none h-[22px] max-h-[200px] font-sans leading-[22px] overflow-y-auto my-2"
            style={{ color: theme.text }}
            placeholder="Type a message..."
            rows={1}
            disabled={isStreaming}
            aria-label="Message input"
          />
          {isCancellable && onCancel ? (
            <ActionButton
              icon={<XCircle size={22} />}
              onClick={onCancel}
              variant="danger"
              label="Cancel message"
            />
          ) : (
            <ActionButton
              icon={
                isStreaming ? <Zap size={22} /> : <CornerRightUp size={22} />
              }
              onClick={handleSend}
              disabled={isStreaming}
              label={isStreaming ? "Processing" : "Send message"}
            />
          )}
        </form>
      </div>
    );
  }
);

InputArea.displayName = "InputArea";
