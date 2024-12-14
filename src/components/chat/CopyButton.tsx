import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useZustandTheme } from "../../store";

interface CopyButtonProps {
  text: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text }) => {
  const { theme } = useZustandTheme();
  const [isCopied, setIsCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="absolute top-2 right-2 p-1 rounded bg-opacity-50 hover:bg-opacity-75 transition-colors"
      style={{ backgroundColor: theme.surface }}
    >
      {isCopied ? (
        <Check size={16} className="text-green-400" />
      ) : (
        <Copy size={16} className="text-gray-300" />
      )}
    </button>
  );
};
