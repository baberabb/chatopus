// import React, {useEffect, useRef} from "react";
// import {useZustandTheme} from "@/store.js";
// import {Gift, Plus, Smile} from "lucide-react";
// import {useStreamingStore} from "@/components/Chatbox.js";

// const InputArea: React.FC<{
//     input: string;
//     setInput: React.Dispatch<React.SetStateAction<string>>;
//     handleSend: () => void;
// }> = ({ input, setInput, handleSend }) => {
//     const { theme } = useZustandTheme();
//     const { isStreaming } = useStreamingStore();

//     const textareaRef = useRef<HTMLTextAreaElement>(null);

//     const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
//         setInput(e.target.value);
//     };

//     const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
//         if (e.key === "Enter" && !e.shiftKey) {
//             e.preventDefault();
//             handleSend();
//         }
//     };

//     useEffect(() => {
//         const textarea = textareaRef.current;
//         if (textarea) {
//             textarea.style.height = "auto";
//             const newHeight = Math.min(textarea.scrollHeight, 200);
//             textarea.style.height = `${newHeight}px`;
//         }
//     }, [input]);

//     return (
//         <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-2 input-area-outdiv bg-opacity-80 backdrop-blur-sm" style={{ backgroundColor: theme.background }}>
//             <div
//                 className="flex items-end rounded-lg"
//                 style={{ backgroundColor: theme.surface }}
//             >
//                 <button className="p-3 text-gray-400 hover:text-white transition-colors input-area-innerdiv">
//                     <Plus size={20} />
//                 </button>
//                 <textarea
//                     ref={textareaRef}
//                     value={input}
//                     onChange={handleInputChange}
//                     onKeyPress={handleKeyPress}
//                     className="flex-1 bg-transparent p-3 focus:outline-none resize-none min-h-[44px] max-h-[200px] font-sans leading-tight overflow-y-auto input-area-textarea"
//                     style={{ color: theme.text }}
//                     placeholder="yap!"
//                     rows={1}
//                     disabled={isStreaming}
//                 />
//                 <button className="p-3 text-gray-400 hover:text-white transition-colors">
//                     <Gift size={20} />
//                 </button>
//                 <button className="p-3 text-gray-400 hover:text-white transition-colors">
//                     <Smile size={20} />
//                 </button>
//             </div>
//         </div>
//     );
// };