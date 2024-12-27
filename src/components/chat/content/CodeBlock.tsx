import React, { useState, useRef, useEffect, useMemo } from "react";
import { Play, Copy } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/default-highlight";
import { vs2015 } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { useZustandTheme } from "../../store";

interface CodeBlockProps {
  language: string;
  value: string;
  isStreaming?: boolean;
}

interface CodeBlockButtonProps {
  onClick: () => void;
  icon: React.ReactElement<{
    size?: number;
    className?: string;
    [key: string]: any; // Allow any other props the icon might need
  }>;
  label: string;
  disabled?: boolean;
  title?: string;
  variant?: "default" | "highlight";
}

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
  });

  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded hover:bg-opacity-75 transition-colors flex items-center gap-1 ${
        disabled ? "opacity-50" : ""
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

const useCodeExecution = (code: string, language: string) => {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const executeCode = async (): Promise<string> => {
    switch (language.toLowerCase()) {
      case "python": {
        const msgid = await invoke<string>("execute_code", { code });
        return await invoke("receive_message", { msgid });
      }
      case "html": {
        const label = `html-preview-${Date.now()}`;
        await invoke("create_preview", {
          label,
          content: code,
          title: "HTML Preview",
          width: 800,
          height: 600,
        });
        return "HTML opened in new window";
      }
      default:
        return `Language ${language} is not supported yet`;
    }
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput(null);
    try {
      const response = await executeCode();
      setOutput(response);
    } catch (error) {
      console.error("Error running code:", error);
      setOutput(`Error: ${error}`);
    }
    setIsRunning(false);
  };

  return { isRunning, output, runCode, setOutput };
};

const useCodeEditor = (initialValue: string, isStreaming: boolean) => {
  const [code, setCode] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isStreaming) {
      setCode(initialValue);
    }
  }, [initialValue, isStreaming]);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    if (isEditing) {
      adjustTextareaHeight();
    }
  }, [isEditing, code]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.substring(0, start) + "  " + code.substring(end);
      setCode(newCode);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  return {
    code,
    setCode,
    isEditing,
    setIsEditing,
    textareaRef,
    adjustTextareaHeight,
    handleKeyDown,
  };
};

export const CodeBlock: React.FC<CodeBlockProps> = ({
  language,
  value: initialValue,
  isStreaming = false,
}) => {
  const { theme } = useZustandTheme();
  const { code, setCode, isEditing, setIsEditing, textareaRef, handleKeyDown } =
    useCodeEditor(initialValue, isStreaming);
  const { isRunning, output, runCode } = useCodeExecution(code, language);

  const isExecutable = ["python", "html"].includes(language.toLowerCase());
  const displayCode = output ? `${code}\n\n// Output:\n${output}` : code;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayCode);
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

      <div className="relative">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={handleKeyDown}
            className="w-full overflow-hidden p-4 bg-opacity-50 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            style={{
              backgroundColor: theme.surface,
              color: theme.text,
              resize: "none",
            }}
            autoFocus
            aria-label="Code editor"
          />
        ) : (
          <div
            onDoubleClick={() => setIsEditing(true)}
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
            >
              {displayCode}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    </div>
  );
};
