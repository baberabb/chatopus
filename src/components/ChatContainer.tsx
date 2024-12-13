import React, { useState, useRef, useEffect, useCallback } from "react";
// ... (keep all imports and component definitions)

export function ChatContainer({ selectedArchivedChat }: ChatContainerProps) {
  // ... (keep all hooks and handlers)

  return (
    <ErrorBoundary>
      <div
        className="flex flex-col h-full"
        style={{ backgroundColor: theme.background, color: theme.text }}
      >
        {/* Message list with bottom padding to prevent content being hidden behind input */}
        <div className="flex-1 overflow-hidden">
          <div
            className="h-full overflow-y-auto py-4 px-4"
            style={{ backgroundColor: theme.background }}
            ref={messageListRef}
          >
            {messages.map((msg, index) => (
              <React.Fragment key={msg.id}>
                {index > 0 && messages[index - 1].role !== msg.role && (
                  <div className="h-4" />
                )}
                <MessageBlock
                  message={msg}
                  onReact={handleReact}
                  isStreaming={isStreaming && index === messages.length - 1}
                />
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Input area as a flex item at the bottom */}
        <div
          className="flex-none bg-opacity-80 backdrop-blur-sm p-4"
          style={{
            backgroundColor: theme.background,
            borderTop: `1px solid ${theme.border}`,
          }}
        >
          <div
            className="flex items-end rounded-lg"
            style={{
              backgroundColor: theme.surface,
              boxShadow: `0 2px 4px -2px ${theme.shadowColor}, 0 1px 2px -1px ${theme.shadowColor}`,
            }}
          >
            <button className="p-3 text-gray-400 hover:text-white transition-colors">
              <Paperclip size={20} />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 bg-transparent p-3 focus:outline-none resize-none min-h-[44px] max-h-[200px] font-sans leading-tight overflow-y-auto"
              style={{ color: theme.text }}
              placeholder="Type a message..."
              rows={1}
              disabled={isStreaming}
            />
            <button
              className="p-3 text-gray-400 hover:text-white transition-colors"
              onClick={handleSend}
              disabled={isStreaming}
            >
              {isStreaming ? <Zap size={20} /> : <CornerRightUp size={20} />}
            </button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
