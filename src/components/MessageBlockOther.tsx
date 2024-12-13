import React, { useState, useCallback, useRef } from 'react'
import { Copy, TextSelect } from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import { MessageContent } from './MessageContent'
import { Button } from '@/components/ui/button'

interface MessageBlockOtherProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  };
  isStreaming: boolean;
}

export const MessageBlockOther: React.FC<MessageBlockOtherProps> = ({
  message,
  isStreaming,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const handleSelectText = useCallback(() => {
    if (contentRef.current) {
      const range = document.createRange();
      range.selectNodeContents(contentRef.current);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (contentRef.current) {
      await navigator.clipboard.writeText(contentRef.current.innerText);
      // You might want to add some feedback here, like a toast notification
    }
  }, []);

  return (
    <div
      className={`flex hover:bg-muted/50 transition-colors duration-200 py-3 px-4 ${
        isHovered ? 'bg-muted/50' : 'bg-transparent'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="w-10 flex-shrink-0 flex justify-center">
        <UserAvatar role={message.role} />
      </div>
      <div className="flex-grow min-w-0 pl-3 pr-2">
        <div className="flex items-start">
          <div ref={contentRef} className="flex-grow">
            <MessageContent message={message} isStreaming={isStreaming} />
          </div>
          <div className="flex-shrink-0 w-20 flex space-x-1 ml-2">
            {!isStreaming && isHovered && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSelectText}
                  className="transition-opacity duration-200"
                  aria-label="Select text"
                >
                  <TextSelect className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  className="transition-opacity duration-200"
                  aria-label="Copy message"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

