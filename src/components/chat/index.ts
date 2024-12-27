/**
 * Chat Module
 * 
 * This module contains all components and utilities related to the chat functionality.
 * It provides a complete chat interface with streaming support, message management,
 * and auto-scrolling behavior.
 * 
 * @module Chat
 */

/**
 * Chat Module
 * 
 * This module contains all components and utilities related to the chat functionality.
 * It provides a complete chat interface with streaming support, message management,
 * and auto-scrolling behavior.
 * 
 * @module Chat
 */

// Core Components
export { ChatContainer } from './core/ChatContainer';
export { MessageBlock } from './core/MessageBlock';
export { InputArea } from './core/InputArea';

// Content Components
export { MessageContent } from './content/MessageContent';
export { CodeBlock } from './content/CodeBlock';

// Action Components
export { MessageActions } from './actions/MessageActions';
export { MessageEditor } from './actions/MessageEditor';

// Streaming Components
export { StreamingInput } from './streaming/StreamingInput';
export { StreamingMessage } from './streaming/StreamingMessage';

// System Components
export { SystemMessageEditor } from './system/SystemMessageEditor';

// Hooks
export { useChat } from './hooks/useChat';
export { useScrollHandler } from './hooks/useScrollHandler';

// Types
export type * from './types';

// Utilities
export * from './utils/messageUtils';

// Common Components
export { UserAvatar } from './common/UserAvatar';
export { CopyButton } from './common/CopyButton';
