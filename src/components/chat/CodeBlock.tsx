import React, {useState} from "react";
import {Play} from "lucide-react";
import {invoke} from "@tauri-apps/api/core";
import SyntaxHighlighter from "react-syntax-highlighter";
import {darcula} from "react-syntax-highlighter/dist/esm/styles/hljs";
import {useZustandTheme} from "@/store.ts";
import {CopyButton} from "./CopyButton";

interface CodeBlockProps {
  language: string;
  value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const { theme } = useZustandTheme();
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const executeCode = async (code: string) => {
      return await invoke('execute_code', {code});
    };

    const getMessage = async () => {
      return await invoke('receive_message');
    };
  const runCode = async () => {
    setIsRunning(true);
    setOutput(null);
    try {
      await executeCode(value);
      const response = await getMessage();
      console.log(JSON.stringify(response, null, 2));
      setOutput(JSON.stringify(response, null, 2) as string);
    } catch (error) {
      console.error("Error running code:", error);
      setOutput(`Error: ${error}`);
    }
    setIsRunning(false);
  };

  const codeWithOutput = output ? `${value}\n\n// Output:\n${output}` : value;

  return (
    <div className="relative font-mono text-sm">
      <SyntaxHighlighter
        style={darcula}
        language={language}
        PreTag="div"
        customStyle={{
          backgroundColor: theme.surface,
          padding: "1rem",
          borderRadius: "0.375rem",
        }}
      >
        {codeWithOutput}
      </SyntaxHighlighter>
      <CopyButton text={codeWithOutput} />
      <button
        onClick={runCode}
        className="absolute top-2 right-12 p-1 rounded bg-opacity-50 hover:bg-opacity-75 transition-colors"
        style={{ backgroundColor: theme.surface }}
      >
        <Play
          size={16}
          className={isRunning ? "text-yellow-400" : "text-gray-300"}
        />
      </button>
    </div>
  );
};
