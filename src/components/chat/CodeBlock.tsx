import React, { useState } from "react";
import { Play } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import SyntaxHighlighter from "react-syntax-highlighter";
import { darcula } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { useZustandTheme } from "@/store.ts";

interface CodeBlockProps {
    language: string;
    value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value: initialValue }) => {
    const { theme } = useZustandTheme();
    const [isRunning, setIsRunning] = useState(false);
    const [output, setOutput] = useState<string | null>(null);
    const [code, setCode] = useState(initialValue);
    const [isEditing, setIsEditing] = useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const adjustTextareaHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    };

    React.useEffect(() => {
        if (isEditing) {
            adjustTextareaHeight();
        }
    }, [isEditing, code]);

    const executeCode = async (code: string): Promise<string> => {
        return await invoke<string>('execute_code', { code });
    };

    const getMessage = async (msgid: string): Promise<string> => {
        return await invoke('receive_message', { msgid: msgid });
    };

    const runCode = async () => {
        setIsRunning(true);
        setOutput(null);
        try {
            let msgid = await executeCode(code);
            const response: string = await getMessage(msgid);
            setOutput(response);
        } catch (error) {
            console.error("Error running code:", error);
            setOutput(`Error: ${error}`);
        }
        setIsRunning(false);
    };

    const handleDoubleClick = () => {
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const newCode = code.substring(0, start) + '  ' + code.substring(end);
            setCode(newCode);
            setTimeout(() => {
                target.selectionStart = target.selectionEnd = start + 2;
            }, 0);
        }
    };

    const codeWithOutput = output ? `${code}\n\n// Output:\n${output}` : code;

    const capitalizedLanguage = language.charAt(0).toUpperCase() + language.slice(1);

    return (
        <div className="relative font-mono text-sm rounded-lg overflow-hidden shadow-lg border border-gray-700">
            {/* Header Bar */}
            <div
                className="flex items-center justify-between px-4 py-2"
                style={{
                    backgroundColor: theme.surface,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}
            >
                {/* Left side - Language indicator */}
                <div className="flex items-center space-x-2">
                    <div
                        className="w-2 h-2 rounded-full bg-blue-500"
                        style={{ backgroundColor: language === 'python' ? '#3572A5' : '#f1e05a' }}
                    />
                    <span className="text-sm font-medium text-gray-300">
            {capitalizedLanguage}
          </span>
                </div>

                {/* Right side - Buttons */}
                <div className="flex items-center gap-3 ml-auto">
                    <button
                        onClick={runCode}
                        className="p-1.5 rounded hover:bg-opacity-75 transition-colors flex items-center gap-1"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                    >
                        <Play
                            size={14}
                            className={isRunning ? "text-yellow-400" : "text-gray-300"}
                        />
                        <span className="text-xs text-gray-300">Run</span>
                    </button>
                    <div className="h-4 w-px bg-gray-700" />
                    <div className="flex items-center">
                        <button
                            onClick={() => navigator.clipboard.writeText(codeWithOutput)}
                            className="p-1.5 rounded hover:bg-opacity-75 transition-colors flex items-center gap-1"
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-gray-300"
                            >
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span className="text-xs text-gray-300">Copy</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Code Content */}
            <div className="relative">
                {isEditing ? (
                    <textarea
                        ref={textareaRef}
                        value={code}
                        onChange={(e) => {
                            setCode(e.target.value);
                            adjustTextareaHeight();
                        }}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="w-full overflow-hidden p-4 bg-opacity-50 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        style={{
                            backgroundColor: theme.surface,
                            color: theme.text,
                            resize: 'none'
                        }}
                        autoFocus
                    />
                ) : (
                    <div onDoubleClick={handleDoubleClick}>
                        <SyntaxHighlighter
                            style={{
                                ...darcula,
                                'pre[class*="language-"]': {
                                    background: 'transparent',
                                    margin: 0,
                                    padding: 0
                                },
                                'code[class*="language-"]': {
                                    background: 'transparent'
                                }
                            }}
                            language={language}
                            PreTag="div"
                            customStyle={{
                                background: 'transparent',
                                backgroundColor: 'transparent',
                                padding: "1rem",
                                margin: 0,
                                cursor: "text",
                            }}
                            codeTagProps={{
                                style: {
                                    background: 'transparent',
                                    backgroundColor: 'transparent'
                                }
                            }}
                        >
                            {codeWithOutput}
                        </SyntaxHighlighter>
                    </div>
                )}
            </div>
        </div>
    );
};