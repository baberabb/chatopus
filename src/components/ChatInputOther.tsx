// depreciated
// import React, { useState } from 'react'
// import { Send } from 'lucide-react'
// import { Button } from "@/components/ui/button"
// import { Textarea } from "@/components/ui/textarea"

// interface ChatInputOtherProps {
//   onSendMessage: (message: string) => void
// }

// export function ChatInputOther({ onSendMessage }: ChatInputOtherProps) {
//   const [message, setMessage] = useState("")

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault()
//     if (message.trim()) {
//       onSendMessage(message)
//       setMessage("")
//     }
//   }

//   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault()
//       handleSubmit(e)
//     }
//   }

//   return (
//     <form onSubmit={handleSubmit} className="flex space-x-2 p-4 border-t border-border bg-background dark:bg-gray-900 dark:border-gray-700 sticky bottom-0">
//       <Textarea
//         value={message}
//         onChange={(e) => setMessage(e.target.value)}
//         onKeyDown={handleKeyDown}
//         placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
//         className="flex-grow dark:bg-gray-800 dark:text-gray-200"
//       />
//       <Button type="submit" className="dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
//         <Send className="h-4 w-4 mr-2" />
//         Send
//       </Button>
//     </form>
//   )
// }
