import React, {useState} from "react";
import {useZustandTheme} from "../../store";
import {Message} from "./types";
import {UserAvatar} from "./UserAvatar";
import {MessageContent} from "./MessageContent";
import {MessageActions} from "./MessageActions";
import {MessageEditor} from "./MessageEditor";

interface MessageBlockProps {
    message: Message,
    onReact: (messageId: string) => void,
    onEdit?: (messageId: string, newContent: string) => void,
    isStreaming: boolean,
    conversationId?: string | null
}

export const MessageBlock: React.FC<MessageBlockProps> = React.memo(
    ({message, onReact, onEdit, isStreaming, conversationId}) => {
        const {theme} = useZustandTheme();
        const [isHovered, setIsHovered] = useState(false);

        const handleCopy = () => {
            navigator.clipboard.writeText(message.content);
        };

        return (
            <div
                className="flex hover:bg-opacity-50 transition-colors duration-200 py-3 px-4 hover:bg-transparent"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{backgroundColor: isHovered ? theme.surface : "transparent"}}
            >
                <div className="w-10 flex-shrink-0 flex justify-center">
                    <UserAvatar user={message.role}/>
                </div>
                <div className="flex-grow min-w-0 pl-3 pr-4">
                    {message.isEditing ? (
                        <MessageEditor
                            content={message.content}
                            onSave={(content) => onEdit?.(message.id, content)}
                            onCancel={() => onEdit?.(message.id, message.content)}
                        />
                    ) : (
                        <div className="flex justify-between">
                            <MessageContent message={message} isStreaming={isStreaming}/>
                            {!isStreaming && message.role === "user" && (
                                <MessageActions
                                    onEdit={() => onEdit?.(message.id, message.content)}
                                    onReact={() => onReact(message.id)}
                                    onCopy={handleCopy}
                                    isVisible={isHovered}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    },
    (prevProps, nextProps) => {
        return (
            prevProps.message.id === nextProps.message.id &&
            prevProps.message.content === nextProps.message.content &&
            prevProps.message.reactions?.thumbsUp ===
            nextProps.message.reactions?.thumbsUp &&
            prevProps.isStreaming === nextProps.isStreaming &&
            prevProps.message.isEditing === nextProps.message.isEditing
        );
    }
);

MessageBlock.displayName = "MessageBlock";
