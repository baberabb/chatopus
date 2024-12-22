import React, { useState } from "react";
import { Paperclip, Zap, CornerRightUp, XCircle } from "lucide-react";
import { useZustandTheme } from "../../store";

interface InputAreaProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  isCancellable?: boolean;
  onCancel?: () => void;
}

export const InputArea: React.FC<InputAreaProps> = React.memo(
  ({ onSend, isStreaming, isCancellable, onCancel }) => {
    const { theme } = useZustandTheme();
    const [input, setInput] = useState("");

    const handleSend = () => {
      if (input && !isStreaming) {
        onSend(input);
        setInput("");
      }
    };

    return (
      <div
        className="absolute bottom-0 left-0 right-0 bg-opacity-80 backdrop-blur-sm"
        style={{
          backgroundColor: theme.background,
          borderTop: `1px solid ${theme.border}`,
        }}
      >
        <div className="p-4">
          <div
            className="flex items-end rounded-lg"
            style={{
              backgroundColor: theme.surface,
              boxShadow: `0 2px 4px -2px ${theme.shadowColor}, 0 1px 2px -1px ${theme.shadowColor}`,
            }}
          >
            <button className="p-3 text-gray-400 hover:text-white transition-colors">
              <Paperclip size={20} />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 bg-transparent p-3 focus:outline-none resize-none min-h-[44px] max-h-[200px] font-sans leading-tight overflow-y-auto"
              style={{ color: theme.text }}
              placeholder="Type a message..."
              rows={1}
              disabled={isStreaming}
            />
            {isCancellable && onCancel ? (
              <button
                className="p-3 text-red-400 hover:text-red-500 transition-colors"
                onClick={onCancel}
              >
                <XCircle size={20} />
              </button>
            ) : (
              <button
                className="p-3 text-gray-400 hover:text-white transition-colors"
                onClick={handleSend}
                disabled={isStreaming}
              >
                {isStreaming ? <Zap size={20} /> : <CornerRightUp size={20} />}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

InputArea.displayName = "InputArea";
