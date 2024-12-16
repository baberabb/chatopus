import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { useZustandTheme } from "@/store";

interface ErrorDisplayProps {
  message: string;
  details?: string;
  onRetry?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  message,
  details,
  onRetry,
}) => {
  const { theme } = useZustandTheme();

  return (
    <div className="flex hover:bg-opacity-50 transition-colors duration-200 py-3 px-4 hover:bg-transparent">
      <div className="w-10 flex-shrink-0 flex justify-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: theme.surface }}
        >
          <AlertCircle className="text-red-500" size={16} />
        </div>
      </div>
      <div className="flex-grow min-w-0 pl-3 pr-2">
        <div className="flex items-start">
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-baseline mb-1">
              <span className="text-sm font-medium mr-2 text-red-500">
                Error
              </span>
              <span className="text-xs" style={{ color: theme.textSecondary }}>
                {new Date().toLocaleTimeString()}
              </span>
            </div>
            <div className="prose prose-slate dark:prose-invert max-w-none font-sans leading-relaxed tracking-normal break-words">
              <div className="text-red-500">{message}</div>
              {details && (
                <div className="text-sm mt-1 text-red-400">{details}</div>
              )}
            </div>
          </div>
          {onRetry && (
            <div className="flex-shrink-0 w-12 flex space-x-1">
              <button
                onClick={onRetry}
                className="text-red-400 hover:text-red-500 transition-colors duration-200"
                aria-label="Retry"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
