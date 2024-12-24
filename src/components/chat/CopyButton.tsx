import React, { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { useThemeStore } from "../../store";

interface CopyButtonProps {
  text: string;
  position?: "absolute" | "relative";
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  position = "absolute",
  className = "",
}) => {
  const { theme } = useThemeStore();
  const [isCopied, setIsCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  }, [text]);

  const positionClasses =
    position === "absolute" ? "absolute top-2 right-2" : "";
  const baseClasses =
    "p-1.5 rounded bg-opacity-50 hover:bg-opacity-75 transition-all duration-200";

  return (
    <button
      onClick={copy}
      className={`${baseClasses} ${positionClasses} ${className}`}
      style={{ backgroundColor: theme.surface }}
      aria-label={isCopied ? "Copied!" : "Copy to clipboard"}
      title={isCopied ? "Copied!" : "Copy to clipboard"}
      disabled={isCopied}
    >
      <div className="relative">
        <span
          className={`transition-opacity duration-200 ${
            isCopied ? "opacity-0" : "opacity-100"
          }`}
        >
          <Copy size={16} className="text-gray-300" />
        </span>
        <span
          className={`absolute inset-0 transition-opacity duration-200 ${
            isCopied ? "opacity-100" : "opacity-0"
          }`}
        >
          <Check size={16} className="text-green-400" />
        </span>
      </div>
    </button>
  );
};
