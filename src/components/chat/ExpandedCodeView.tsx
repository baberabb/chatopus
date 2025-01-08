import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";

interface ExpandedCodeViewProps {
  code: string;
  language: string;
  onClose: () => void;
  onCodeChange?: (newCode: string) => void;
}

const getLanguageExtension = (language: string) => {
  switch (language.toLowerCase()) {
    case "javascript":
    case "js":
    case "jsx":
    case "typescript":
    case "ts":
    case "tsx":
      return javascript();
    case "python":
    case "py":
      return python();
    case "html":
      return html();
    default:
      return javascript(); // Default to JavaScript
  }
};

export const ExpandedCodeView: React.FC<ExpandedCodeViewProps> = ({
  code,
  language,
  onClose,
  onCodeChange,
}) => {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-sm font-medium">Code Editor</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-300 transition-colors"
          aria-label="Close code editor"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={code}
          height="100%"
          theme={oneDark}
          extensions={[getLanguageExtension(language)]}
          editable={true}
          onChange={(value) => onCodeChange?.(value)}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
        />
      </div>
    </div>
  );
};
