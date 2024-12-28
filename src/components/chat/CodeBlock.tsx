/**
 * CodeBlock.tsx
 * A component for displaying and executing code blocks with syntax highlighting
 * and interactive features like copying and running code.
 *
 * Key features:
 * 1. Real-time content updates during streaming
 * - Uses useCodeEditor hook to manage content state
 * - Forces SyntaxHighlighter re-renders with key prop during updates
 * - Maintains proper formatting during streaming
 *
 * 2. Interactive features
 * - Syntax highlighting with theme support
 * - Copy to clipboard functionality
 * - Code execution for supported languages
 * - Double-click to edit capability
 *
 * 3. Accessibility
 * - Proper ARIA labels and roles
 * - Keyboard navigation support
 * - Status indicators for running code
 *
 * The component carefully manages streaming updates to ensure code blocks
 * render properly while content is being streamed, rather than waiting
 * for the complete content to arrive.
 */

import React, { useMemo } from "react";
import { Play, Copy } from "lucide-react";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/default-highlight";
import { vs2015 } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { useZustandTheme } from "../../store";
import { useCodeExecution } from "./hooks/useCodeExecution";
import { useCodeEditor } from "./hooks/useCodeEditor";

/**
 * Props for the CodeBlock component
 * @interface CodeBlockProps
 * @property {string} language - Programming language for syntax highlighting
 * @property {string} value - Code content to display
 * @property {boolean} isStreaming - Whether content is actively streaming
 *                                  Used to optimize rendering behavior
 */
interface CodeBlockProps {
  language: string;
  value: string;
  isStreaming?: boolean;
}

/**
 * Props for the CodeBlockButton component
 * @interface CodeBlockButtonProps
 */
interface CodeBlockButtonProps {
  onClick: () => void;
  icon: React.ReactElement<{
    size?: number;
    className?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;
  label: string;
  disabled?: boolean;
  title?: string;
  variant?: "default" | "highlight";
}

/**
 * Button component for code block actions
 * @component
 */
const CodeBlockButton: React.FC<CodeBlockButtonProps> = ({
  onClick,
  icon,
  label,
  disabled,
  title,
  variant = "default",
}) => {
  const iconWithProps = React.cloneElement(icon, {
    size: 14,
    className: variant === "highlight" ? "text-yellow-400" : "text-gray-300",
    "aria-hidden": "true",
  });

  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded hover:bg-opacity-75 transition-colors flex items-center gap-1 ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
      title={title}
      disabled={disabled}
      aria-label={label}
    >
      {iconWithProps}
      <span className="text-xs text-gray-300">{label}</span>
    </button>
  );
};

/**
 * CodeBlock component for displaying and executing code
 * @component
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({
  language,
  value: initialValue,
  isStreaming = false,
}) => {
  const { theme } = useZustandTheme();

  // Initialize code editor state
  const {
    code,
    setCode,
    isEditing,
    textareaRef,
    handleKeyDown,
    startEditing,
    stopEditing,
  } = useCodeEditor(initialValue, isStreaming);

  // Initialize code execution state
  const { isRunning, output, error, runCode } = useCodeExecution(
    code,
    language
  );

  const isExecutable = ["python", "html"].includes(language.toLowerCase());
  const displayCode = output ? `${code}\n\n// Output:\n${output}` : code;
  const hasError = error !== null;

  /**
   * Handles copying code to clipboard
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const capitalizedLanguage = useMemo(
    () => language.charAt(0).toUpperCase() + language.slice(1),
    [language]
  );

  return (
    <div
      className="relative font-mono text-sm rounded-lg overflow-hidden shadow-lg border border-gray-700"
      role="region"
      aria-label={`${capitalizedLanguage} code block`}
    >
      {/* Header with language indicator and actions */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          backgroundColor: theme.surface,
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <div className="flex items-center space-x-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: language === "python" ? "#3572A5" : "#f1e05a",
            }}
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-gray-300">
            {capitalizedLanguage}
          </span>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {isExecutable && (
            <>
              <CodeBlockButton
                onClick={runCode}
                icon={<Play />}
                label="Run"
                disabled={!isExecutable || isRunning}
                variant={isRunning ? "highlight" : "default"}
                title={
                  language.toLowerCase() === "html"
                    ? "Open HTML in new window"
                    : "Run code"
                }
              />
              <div className="h-4 w-px bg-gray-700" aria-hidden="true" />
            </>
          )}
          <CodeBlockButton
            onClick={handleCopy}
            icon={<Copy />}
            label="Copy"
            title="Copy code to clipboard"
          />
        </div>
      </div>

      {/* Code editor/viewer section */}
      <div className="relative">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onBlur={stopEditing}
            onKeyDown={handleKeyDown}
            className="w-full overflow-hidden p-4 bg-opacity-50 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            style={{
              backgroundColor: theme.surface,
              color: theme.text,
              resize: "none",
            }}
            autoFocus
            aria-label="Code editor"
            spellCheck="false"
          />
        ) : (
          <div
            onDoubleClick={startEditing}
            role="textbox"
            tabIndex={0}
            aria-label="Code display (double-click to edit)"
          >
            <SyntaxHighlighter
              language={language}
              style={vs2015}
              PreTag="div"
              customStyle={{
                background: "transparent",
                padding: "1rem",
                margin: 0,
                cursor: "text",
              }}
              key={displayCode} // Force re-render on content change
            >
              {displayCode}
            </SyntaxHighlighter>
          </div>
        )}
      </div>

      {/* Error display */}
      {hasError && (
        <div
          className="p-4 bg-red-900 bg-opacity-25 border-t border-red-700"
          role="alert"
          aria-live="polite"
        >
          <pre className="text-red-400 text-sm whitespace-pre-wrap">
            {error}
          </pre>
        </div>
      )}

      {/* Loading indicator */}
      {isRunning && (
        <div
          className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          role="status"
          aria-label="Running code..."
        >
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
        </div>
      )}
    </div>
  );
};

CodeBlock.displayName = "CodeBlock";
