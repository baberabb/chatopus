import React from "react";
import { ThumbsUp, Copy, Pencil } from "lucide-react";
import { useThemeStore } from "../../store";

interface MessageActionsProps {
  onEdit?: () => void;
  onReact?: () => void;
  onCopy?: () => void;
  isVisible: boolean;
  showEditButton?: boolean;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  onEdit,
  onReact,
  onCopy,
  isVisible,
  showEditButton = true,
}) => {
  const { theme } = useThemeStore();

  const baseButtonClass = "transition-colors duration-200";
  const visibilityClass = isVisible ? "opacity-100" : "opacity-0";

  return (
    <div className="flex-shrink-0 flex space-x-1">
      {showEditButton && onEdit && (
        <button
          onClick={onEdit}
          className={`${baseButtonClass} text-gray-400 hover:text-blue-500 ${visibilityClass}`}
          aria-label="Edit message"
        >
          <Pencil size={16} />
        </button>
      )}
      {onReact && (
        <button
          onClick={onReact}
          className={`${baseButtonClass} text-gray-400 hover:text-yellow-500 ${visibilityClass}`}
          aria-label="React to message"
        >
          <ThumbsUp size={16} />
        </button>
      )}
      {onCopy && (
        <button
          onClick={onCopy}
          className={`${baseButtonClass} ${visibilityClass}`}
          aria-label="Copy message"
        >
          <Copy size={16} style={{ color: theme.textSecondary }} />
        </button>
      )}
    </div>
  );
};
