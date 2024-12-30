import React, { useRef, useEffect } from "react";
import { Check, X } from "lucide-react";

import { ContentBlock } from "../../types";

interface MessageEditorProps {
  content: string | ContentBlock[];
  onSave: (content: string) => void;
  onCancel: () => void;
}

export const MessageEditor: React.FC<MessageEditorProps> = ({
  content,
  onSave,
  onCancel,
}) => {
  const initialContent = Array.isArray(content)
    ? content[0]?.text || ""
    : content;
  const [editContent, setEditContent] = React.useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length,
      );
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const handleSave = () => {
    const trimmedContent = editContent.trim();
    if (trimmedContent !== "") {
      onSave(trimmedContent);
    }
  };

  return (
    <div className="flex-grow">
      <textarea
        ref={textareaRef}
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full min-h-[100px] p-2 rounded border border-gray-300 dark:border-gray-600 bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Edit your message..."
      />
      <div className="flex justify-end space-x-2 mt-2">
        <button
          onClick={onCancel}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          aria-label="Cancel editing"
        >
          <X size={16} className="text-gray-500" />
        </button>
        <button
          onClick={handleSave}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          aria-label="Save changes"
        >
          <Check size={16} className="text-green-500" />
        </button>
      </div>
    </div>
  );
};
