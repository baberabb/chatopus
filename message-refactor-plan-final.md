# Message System Refactoring Plan

## Current Problems

1. Frontend Message ID Issues:

- Frontend generates temporary negative IDs
- Complex state management replacing temp IDs with real ones
- Potential race conditions with multiple messages

2. Rollback/Error Handling:

- Need proper cleanup if AI request fails
- Currently using optimistic updates requiring manual rollback
- Need to ensure consistent state on failure

3. Attachment Issues:

- Attachments saved separately from messages
- Not atomic - potential for inconsistent state
- No proper rollback if attachment save fails

## System Message Handling

1. Current Issue:

- System messages stored in conversation metadata but not included in message history
- Not being passed to AI providers correctly
- Different providers handle system messages differently (OpenAI vs Anthropic)

2. Solution:

- Keep storing system message in conversation metadata (one per conversation)
- Include system message when fetching conversation history:
- Handle provider-specific system message requirements:
   - OpenAI: Expects system messages with role "system"
   - Anthropic: Handles system messages like any other message
- Ensure system message is first in history for proper context:

```rust
pub async fn get_messages_for_conversation(
   db: &sqlx::Pool<sqlx::Sqlite>,
   conversation_id: i64,
) -> Result<Vec<Message>, ErrorResponse> {
   // First get system message from conversation
   let system_message = sqlx::query!(
        "SELECT system_message FROM conversations WHERE id = ?",
        conversation_id
    )
           .fetch_optional(db)
           .await?
           .and_then(|row| row.system_message);

   // Get regular messages
   let db_messages = sqlx::query_as!(DbMessage,...)
           .fetch_all(db)
           .await?;

   let mut messages = Vec::new();

   // Add system message first if it exists
   if let Some(system_msg) = system_message {
      messages.push(Message {
         id: "system".to_string(),
         role: "system".to_string(),
         content: vec![ContentBlock::text(system_msg)],
         ...
      });
   }

   // Add regular messages
   for db_msg in db_messages {
      messages.push(db_msg.into_message(db).await?);
   }

   Ok(messages)
}
```

3. Benefits:

- System message properly included in AI context
- Works with different provider implementations
- Maintains one system message per conversation
- No changes needed to frontend system message UI

## Message Flow Summary

### Message State Transitions

Simplified state machine with fewer transitions:

```
User Message:
opt_uuid -> real_id (complete)

Assistant Message:
opt_uuid -> real_id (streaming/complete/error)
                 |
                 +-> accumulating chunks
                 |
                 +-> final content & model
```

Benefits:

- Fewer state transitions
- No "pending" state since messages are created atomically
- Clearer message lifecycle
- Simpler state management

### Flow Steps

1. User Sends Message:

   - Frontend generates UUID-based optimistic IDs for both messages
   - Immediately shows user message and empty assistant message in UI
   - Both messages start in "pending" state

2. Backend Processing:
   a. Save User Message:

   - Saves user message + attachments atomically
   - Sets status to "complete"
   - Commits transaction

   b. Get Conversation History:

   - Fetches all messages including just-saved user message
   - Ensures AI has full context

   c. Create Assistant Message:

   - Creates empty assistant message
   - Sets status to "streaming"
   - Commits transaction
   - Returns both real message IDs to frontend

   d. Process with AI:

   - Uses complete conversation history
   - Streams chunks with message ID
   - Updates assistant message on completion
   - Sets final status to "complete"
   - Handles errors by marking message as "error"

3. Frontend Updates:

   - Replaces optimistic IDs with real IDs
   - Updates UI as chunks arrive
   - Handles completion/error states
   - Cleans up event listeners

4. Error Handling:
   - Backend: Atomic transactions ensure consistent state
   - Frontend: Removes optimistic messages on error
   - Clear error states in both UI and database

## Implementation

### 1. Database Migration

```sql
-- Migration: 20240325000000_add_message_status.sql
-- Runs after 20240320000000_add_attachments.sql

-- Up
ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'complete'
   CHECK (status IN ('pending', 'streaming', 'complete', 'error'));

CREATE INDEX idx_messages_status ON messages(status);

-- Down
DROP INDEX idx_messages_status;
ALTER TABLE messages DROP COLUMN status;
```

### 2. Backend Changes

```rust
// In chat.rs

// Simplified event system with combined stream/complete events
#[derive(Debug, Serialize)]
struct StreamEvent {
   message_id: i64,       // Actual message ID
   conversation_id: i64,  // For validation
   content: String,       // Chunk content
   is_final: bool,        // true for final chunk
   model: Option<String>, // Only present when is_final=true
}

// Frontend event handling with single event type
listen("stream-event", (event) => {
const { message_id, conversation_id, content, is_final, model } = event;

// Only handle events for current conversation
if (conversation_id !== useChatStore.getState().currentConversationId) return;

// Find message by ID
const messages = useChatStore.getState().messages;
const messageIndex = messages.findIndex(m => m.id === message_id);
if (messageIndex === -1) return;

const message = messages[messageIndex];
if (message.status !== "streaming") return;

// Update message
const updatedMessages = [...messages];
updatedMessages[messageIndex] = {
...message,
content: message.content + content,
...(is_final && {
status: "complete",
model,
}),
};
useChatStore.setState({
messages: updatedMessages,
...(is_final && { isStreaming: false }),
});
});

// Frontend event handling
listen("stream-response", (event) => {
const { payload, message_id, conversation_id } = event;
// Only handle events for current conversation
if (conversation_id !== useChatStore.getState().currentConversationId) return;

// Find message by ID instead of assuming last message
const messages = useChatStore.getState().messages;
const messageIndex = messages.findIndex(m => m.id === message_id);
if (messageIndex === -1) return;

const message = messages[messageIndex];
if (message.status !== "streaming") return;

// Update specific message by ID
const updatedMessages = [...messages];
updatedMessages[messageIndex] = {
...message,
content: message.content + payload,
};
useChatStore.setState({ messages: updatedMessages });
});

listen("stream-complete", (event) => {
const { message_id, conversation_id, model } = event;
// Only handle events for current conversation
if (conversation_id !== useChatStore.getState().currentConversationId) return;

// Find message by ID instead of assuming last message
const messages = useChatStore.getState().messages;
const messageIndex = messages.findIndex(m => m.id === message_id);
if (messageIndex === -1) return;

const message = messages[messageIndex];
if (message.status !== "streaming") return;

// Update specific message by ID
const updatedMessages = [...messages];
updatedMessages[messageIndex] = {
...message,
status: "complete",
model,  // Include final model info
};
useChatStore.setState({
messages: updatedMessages,
isStreaming: false
});
});

// Request type for AI processing
#[derive(Debug)]
struct ProcessRequest {
   history: Vec<Message>,
   model: Option<String>,
}

// Single atomic operation to save message + attachments
pub async fn save_message_atomic(
   tx: &mut Transaction<'_, Sqlite>,
   conversation_id: i64,
   role: &str,
   content: Vec<ContentBlock>,
   attachments: Option<Vec<SaveAttachmentRequest>>,
   model: Option<&str>,
) -> Result<Message, ErrorResponse> {
   // Save message with status
   let message = sqlx::query!(
        r#"
        INSERT INTO messages (conversation_id, role, content, metadata, status)
        VALUES (?, ?, ?, ?, ?)
        RETURNING id
        "#,
        conversation_id,
        role,
        serde_json::to_string(&content)?,
        model.map(|m| format!(r#"{{"model":"{}"}}"#, m)),
        if role == "assistant" { "streaming" } else { "complete" }
    )
           .fetch_one(&mut *tx)
           .await?;

   // Save attachments in same transaction
   if let Some(attachments) = attachments {
      for attachment in attachments {
         sqlx::query!(
                r#"
                INSERT INTO attachments (
                    message_id, name, type, size, path
                )
                VALUES (?, ?, ?, ?, ?)
                "#,
                message.id,
                attachment.name,
                attachment.type_,
                attachment.size,
                attachment.path,
            )
                 .execute(&mut *tx)
                 .await?;
      }
   }

   Ok(Message {
      id: message.id.to_string(),
      role: role.to_string(),
      content,
      // ... other fields ...
   })
}

// Process message with proper error handling
pub async fn process_message(
   request: ProcessMessageRequest,
   app_handle: AppHandle,
) -> Result<ProcessMessageResponse, ErrorResponse> {
   let db = &app_handle.state::<AppState>().db;
   let mut tx = db.begin().await?;

   // 1. Save user message + attachments atomically
   let user_message = save_message_atomic(
      &mut tx,
      request.conversation_id,
      "user",
      vec![ContentBlock::text(&request.message)],
      request.attachments,
      None,
   ).await?;

   // 2. Commit user message - this is permanent
   tx.commit().await?;

   // 3. Get conversation history (includes the user message we just saved)
   let history = chat::get_messages_for_conversation(db, request.conversation_id)
           .await?;

   // 4. Create empty assistant message
   let mut tx = db.begin().await?;
   let assistant_message = save_message_atomic(
      &mut tx,
      request.conversation_id,
      "assistant",
      vec![],  // Empty content initially
      None,
      None,  // Model not known yet
   ).await?;
   tx.commit().await?;

   // 5. Process with AI using complete history
   match process_with_ai(ProcessRequest {
      history,  // Already includes the user message we just saved
      model: None, // Will be determined by provider
   }).await {
      Ok(response) => {
         // Emit streaming events with message and conversation IDs
         for chunk in response.chunks {
            window.emit("stream-response", StreamResponse {
               payload: chunk,
               message_id: assistant_message.id,
               conversation_id: request.conversation_id,
            })?;
         }

         // Update assistant message when complete
         let mut tx = db.begin().await?;
         let model = response.model.clone();  // Clone model before moving response
         sqlx::query!(
                r#"
                UPDATE messages
                SET content = ?,
                    metadata = ?,
                    status = 'complete'
                WHERE id = ?
                "#,
                serde_json::to_string(&response.content)?,
                format!(r#"{{"model":"{}"}}"#, model),
                assistant_message.id,
            )
                 .execute(&mut *tx)
                 .await?;
         tx.commit().await?;

         // Emit completion with message ID, conversation ID, and model
         window.emit("stream-complete", StreamComplete {
            message_id: assistant_message.id,
            conversation_id: request.conversation_id,
            model: Some(model),
         })?;

         Ok(ProcessMessageResponse {
            user_message_id: user_message.id.parse()?,
            assistant_message_id: assistant_message.id.parse()?,
         })
      }
      Err(e) => {
         // Mark assistant message as error
         let mut tx = db.begin().await?;
         sqlx::query!(
                r#"
                UPDATE messages
                SET status = 'error'
                WHERE id = ?
                "#,
                assistant_message.id,
            )
                 .execute(&mut *tx)
                 .await?;
         tx.commit().await?;

         // Return error
         Err(e.into())
      }
   }
}

// Helper to get conversation history with system message
pub async fn get_messages_for_conversation(
   db: &sqlx::Pool<sqlx::Sqlite>,
   conversation_id: i64,
) -> Result<Vec<Message>, ErrorResponse> {
   // First get system message from conversation
   let system_message = sqlx::query!(
        r#"
        SELECT system_message
        FROM conversations
        WHERE id = ?
        "#,
        conversation_id
    )
           .fetch_optional(db)
           .await
           .map_err(db_error)?
           .and_then(|row| row.system_message);

   // Get regular messages
   let db_messages = sqlx::query_as!(
        DbMessage,
        r#"
        SELECT *
        FROM messages
        WHERE conversation_id = ?
        ORDER BY id ASC
        "#,
        conversation_id
    )
           .fetch_all(db)
           .await
           .map_err(|e| ErrorResponse {
              message: "Failed to get conversation history".to_string(),
              details: Some(e.to_string()),
           })?;

   let mut messages = Vec::with_capacity(db_messages.len() + if system_message.is_some() { 1 } else { 0 });

   // Add system message first if it exists
   if let Some(system_msg) = system_message {
      messages.push(Message {
         id: "system".to_string(),
         role: "system".to_string(),
         content: vec![ContentBlock {
            r#type: "text".to_string(),
            text: Some(system_msg),
            image_url: None,
         }],
         timestamp: Local::now().format("%I:%M %p").to_string(),
         model: None,
         metadata: None,
         reactions: None,
         attachments: None,
         original_message_id: None,
      });
   }

   // Add regular messages
   for db_msg in db_messages {
      messages.push(db_msg.into_message(db).await?);
   }

   Ok(messages)
}

// Simplified provider-specific message conversion with trait
trait MessageConverter {
   fn convert_message(&self, msg: Message) -> ProviderMessage;
}

impl MessageConverter for OpenAIProvider {
   fn convert_message(&self, msg: Message) -> ProviderMessage {
      let role = match msg.role.as_str() {
         "system" => MessageRole::system,
         "user" => MessageRole::user,
         "assistant" => MessageRole::assistant,
         _ => MessageRole::user,
      };

      ProviderMessage::OpenAI(ChatCompletionMessage {
         role,
         content: Content::Text(msg.content.text()),
         name: None,
         tool_calls: None,
         tool_call_id: None,
      })
   }
}

impl MessageConverter for AnthropicProvider {
   fn convert_message(&self, msg: Message) -> ProviderMessage {
      ProviderMessage::Anthropic(AnthropicMessage {
         role: msg.role,
         content: msg.content.text(),
      })
   }
}

// Usage in process_message
fn process_with_provider<T: MessageConverter>(
   provider: &T,
   messages: Vec<Message>,
) -> Vec<ProviderMessage> {
   messages.into_iter()
           .map(|msg| provider.convert_message(msg))
           .collect()
}
```

### 3. Frontend Changes

```typescript
// In store.ts

// Cache state types
interface CacheState {
   lastSynced: Date;
   dirty: boolean;
   pendingSync: boolean;
}

interface ChatState {
   messages: Message[];
   currentConversationId: number | null;
   error: string | null;
   cache: CacheState;
}

// Cache management
const SYNC_INTERVAL = 5000; // 5 seconds
const MAX_CACHED_MESSAGES = 10;

// Use UUIDs for optimistic updates instead of negative numbers
// This ensures uniqueness without needing to track counters
const createOptimisticId = () => `opt_${crypto.randomUUID()}`;

const useChatStore = create<ChatState>((set, get) => ({
   messages: [],
   currentConversationId: null,
   error: null,
   cache: {
      lastSynced: new Date(),
      dirty: false,
      pendingSync: false,
   },

   // Cache management
   syncCache: async (force = false) => {
      const state = get();
      if (!state.cache.dirty || (!force && state.cache.pendingSync)) return;

      try {
         set((state) => ({
            cache: { ...state.cache, pendingSync: true },
         }));

         await invoke("sync_conversation", {
            conversation_id: state.currentConversationId,
            messages: state.messages,
         });

         set((state) => ({
            cache: {
               lastSynced: new Date(),
               dirty: false,
               pendingSync: false,
            },
         }));
      } catch (error) {
         console.error("Failed to sync cache:", error);
         set((state) => ({
            cache: { ...state.cache, pendingSync: false },
         }));
      }
   },

   // Auto-sync setup
   setupAutoSync: () => {
      // Periodic sync
      const syncInterval = setInterval(() => {
         const state = get();
         if (state.cache.dirty) {
            get().syncCache();
         }
      }, SYNC_INTERVAL);

      // Sync on window blur/beforeunload
      const syncOnLeave = () => get().syncCache(true);
      window.addEventListener("blur", syncOnLeave);
      window.addEventListener("beforeunload", syncOnLeave);

      // Cleanup
      return () => {
         clearInterval(syncInterval);
         window.removeEventListener("blur", syncOnLeave);
         window.removeEventListener("beforeunload", syncOnLeave);
      };
   },

   sendMessage: async (content: string, attachments?: FileAttachment[]) => {
      // Check if we need to sync before sending
      const state = get();
      if (state.cache.dirty && state.messages.length >= MAX_CACHED_MESSAGES) {
         await get().syncCache(true);
      }

      // Mark cache as dirty when adding messages
      set((state) => ({
         cache: { ...state.cache, dirty: true },
      }));

      try {
         // Create optimistic messages with UUIDs
         const userMessageId = createOptimisticId();
         const assistantMessageId = createOptimisticId();

         // Update UI immediately
         set((state) => ({
            messages: [
               ...state.messages,
               {
                  id: userMessageId,
                  role: "user",
                  content,
                  attachments,
                  status: "pending",
               },
               {
                  id: assistantMessageId,
                  role: "assistant",
                  content: "",
                  status: "pending",
               },
            ],
            error: null,
         }));

         // Send to backend
         const response = await invoke<{
            user_message_id: number;
            assistant_message_id: number;
         }>("process_message", {
            message: content,
            conversation_id: get().currentConversationId,
            attachments,
         });

         // Replace optimistic IDs with real ones
         set((state) => ({
            messages: state.messages.map((msg) => {
               if (msg.id === userMessageId) {
                  return { ...msg, id: response.user_message_id, status: "complete" };
               }
               if (msg.id === assistantMessageId) {
                  return {
                     ...msg,
                     id: response.assistant_message_id,
                     status: "streaming",
                  };
               }
               return msg;
            }),
         }));

         // Create unique event handlers for this message
         const messageHandlers = {
            // Track if this handler is still active
            active: true,

            stream: (event: {
               payload: string;
               message_id: number;
               conversation_id: number;
            }) => {
               const { payload, message_id, conversation_id } = event;

               // Only handle events for current conversation
               if (conversation_id !== get().currentConversationId) return;

               // Only handle events for this message
               if (message_id !== response.assistant_message_id) return;

               // Ignore if handler was deactivated
               if (!messageHandlers.active) return;

               set((state) => ({
                  messages: state.messages.map((msg) => {
                     if (msg.id === message_id) {
                        return {
                           ...msg,
                           content: msg.content + payload,
                        };
                     }
                     return msg;
                  }),
               }));
            },

            complete: (event: {
               message_id: number;
               conversation_id: number;
               model?: string;
            }) => {
               const { message_id, conversation_id, model } = event;

               // Only handle events for current conversation
               if (conversation_id !== get().currentConversationId) return;

               // Only handle events for this message
               if (message_id !== response.assistant_message_id) return;

               // Ignore if handler was deactivated
               if (!messageHandlers.active) return;

               set((state) => ({
                  messages: state.messages.map((msg) => {
                     if (msg.id === message_id) {
                        return {
                           ...msg,
                           status: "complete",
                           model, // Include final model info
                        };
                     }
                     return msg;
                  }),
               }));

               // Cleanup
               messageHandlers.active = false;
               unsubscribe();
            },
         };

         // Start listening for updates
         const unsubscribe = await Promise.all([
            listen("stream-response", messageHandlers.stream),
            listen("stream-complete", messageHandlers.complete),
         ]);
      } catch (error) {
         // Remove optimistic messages on error
         set((state) => ({
            messages: state.messages.filter(
                    (msg) => msg.id !== userMessageId && msg.id !== assistantMessageId
            ),
            error: error.message,
         }));

         // Deactivate handlers and clean up listeners
         messageHandlers.active = false;
         if (typeof unsubscribe === "function") {
            unsubscribe();
         }
      }
   },
}));
```

## Implementation Steps

0. Simplified Database Operations:

- Combine assistant message creation and initial content save:

```rust
// Single transaction for assistant message creation
pub async fn create_assistant_message(
    tx: &mut Transaction<'_, Sqlite>,
    conversation_id: i64,
) -> Result<Message, ErrorResponse> {
    save_message_atomic(
        tx,
        conversation_id,
        "assistant",
        vec![],  // Empty initial content
        None,    // No attachments
        None,    // Model determined later
        Some("streaming"), // Explicit status
    ).await
}
```

1. Create and run database migration:

- Create 20240325000000_add_message_status.sql
- Test migration up/down
- Verify constraints work

2. Update backend:

- Add new types (StreamResponse, StreamComplete, ProcessRequest)
- Implement save_message_atomic
- Update process_message flow with proper history handling
- Add error handling

3. Update frontend:

- Switch to UUID-based optimistic updates
- Add message-specific event handlers with proper cleanup
- Implement error handling

4. Test thoroughly:

- Message sending with attachments
- Streaming updates
- Error scenarios
- Multiple rapid messages
- Migration rollback
- System message handling:
   - Test with OpenAI provider (verify system role is preserved)
   - Test with Anthropic provider (verify system message works as regular message)
   - Test system message updates (verify changes are reflected in conversation)
   - Test conversation switching (verify correct system message loaded)

## Benefits

1. Simpler Code:

- No temporary ID management
- No complex state updates
- Clear error handling

2. More Reliable:

- Atomic operations
- No inconsistent states
- Better error recovery
- Proper history handling

3. Better User Experience:

- Immediate feedback when sending messages
- Smooth transition from optimistic to real IDs
- Clear error states with proper cleanup
- No negative numbers or complex ID tracking

4. Simplified Architecture:

- Fewer state transitions (removed "pending" state)
- Combined stream events (single event type)
- More atomic database operations
- Cleaner provider implementations through traits
- Reduced complexity while maintaining reliability

5. Conversation Caching (Option A - Custom Implementation):

- Keep current conversation in memory for faster access
- Sync with backend periodically and on important events
- Benefits:
   - Reduced database load
   - Better performance for rapid message exchanges
   - Smoother UI updates
   - Lower latency for message history access

6. Alternative Approach: React Query Integration (Option B):

Benefits:

- Built-in caching and state management
- Automatic background refetching
- Cache invalidation handling
- Optimistic updates support
- Request deduplication
- Loading/error states handling

Implementation:

```typescript
// Message queries and mutations
export const useMessages = (conversationId: number) => {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => invoke('get_messages', { conversationId }),
    // Keep cache fresh
    staleTime: 5000, // Consider data stale after 5s
    // Don't refetch on window focus for messages
    refetchOnWindowFocus: false,
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, attachments, conversationId }) => {
      return invoke('process_message', {
        message: content,
        conversation_id: conversationId,
        attachments,
      });
    },
    // Optimistic update
    onMutate: async ({ content, conversationId }) => {
      // Cancel outgoing fetches
      await queryClient.cancelQueries({
        queryKey: ['messages', conversationId],
      });

      // Get current messages
      const previousMessages = queryClient.getQueryData([
        'messages',
        conversationId,
      ]);

      // Optimistically add new messages
      queryClient.setQueryData(
        ['messages', conversationId],
        (old: Message[] = []) => [
          ...old,
          {
            id: `opt_${crypto.randomUUID()}`,
            content,
            role: 'user',
            status: 'pending',
          },
          {
            id: `opt_${crypto.randomUUID()}`,
            content: '',
            role: 'assistant',
            status: 'pending',
          },
        ],
      );

      return { previousMessages };
    },
    // Handle stream events
    onSuccess: (data, variables) => {
      // Setup stream handlers similar to current implementation
      // but use queryClient.setQueryData for updates
    },
    // Rollback on error
    onError: (err, variables, context) => {
      queryClient.setQueryData(
        ['messages', variables.conversationId],
        context.previousMessages,
      );
    },
  });
};

// Usage in components
const ChatContainer = ({ conversationId }) => {
  const { data: messages, isLoading } = useMessages(conversationId);
  const { mutate: sendMessage } = useSendMessage();

  // React Query handles loading/error states
  if (isLoading) return <Loading />;

  return (
    <div>
      {messages.map(message => (
        <Message key={message.id} {...message} />
      ))}
      <InputArea onSend={content =>
        sendMessage({ content, conversationId })}
      />
    </div>
  );
};
```

Benefits of React Query Approach:

- Less custom cache logic needed
- Built-in optimistic updates
- Automatic background refetching
- Better loading/error state handling
- TypeScript support
- Dev tools for debugging

Tradeoffs:

- Learning curve for React Query concepts
- Need to adapt streaming to React Query patterns
- May need to customize caching behavior
- Additional dependency

Integration with Zustand:

```typescript
// Hybrid approach combining React Query and Zustand
interface ChatState {
  // UI state remains in Zustand
  currentConversationId: number | null;
  isStreaming: boolean;
  error: string | null;

  // Actions that coordinate React Query and UI state
  setCurrentConversation: (id: number) => Promise<void>;
  clearError: () => void;
}

const useChatStore = create<ChatState>((set, get) => ({
  currentConversationId: null,
  isStreaming: false,
  error: null,

  setCurrentConversation: async (id) => {
    // Update UI state
    set({ currentConversationId: id });
    // Prefetch messages using React Query
    await queryClient.prefetchQuery(['messages', id]);
  },

  clearError: () => set({ error: null }),
}));

// React Query hooks
export const useConversationMessages = () => {
  // Get current conversation ID from Zustand
  const conversationId = useChatStore(state => state.currentConversationId);

  // Use React Query for data fetching/caching
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => invoke('get_messages', { conversationId }),
    enabled: !!conversationId,
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  const setError = useChatStore(state => state.setError);
  const conversationId = useChatStore(state => state.currentConversationId);

  return useMutation({
    mutationFn: async ({ content, attachments }) => {
      return invoke('process_message', {
        message: content,
        conversation_id: conversationId,
        attachments,
      });
    },
    onMutate: async ({ content }) => {
      // Optimistic update using React Query
      await queryClient.cancelQueries(['messages', conversationId]);

      const previousMessages = queryClient.getQueryData(['messages', conversationId]);

      queryClient.setQueryData(['messages', conversationId],
        (old: Message[] = []) => [
          ...old,
          {
            id: `opt_${crypto.randomUUID()}`,
            content,
            role: 'user',
            status: 'pending',
          },
          {
            id: `opt_${crypto.randomUUID()}`,
            content: '',
            role: 'assistant',
            status: 'pending',
          },
        ]
      );

      return { previousMessages };
    },
    onError: (error, variables, context) => {
      // Rollback React Query cache
      queryClient.setQueryData(
        ['messages', conversationId],
        context?.previousMessages
      );
      // Update UI error state in Zustand
      setError(error.message);
    },
  });
};

// Component usage
const ChatContainer = () => {
  const conversationId = useChatStore(state => state.currentConversationId);
  const { data: messages, isLoading } = useConversationMessages();
  const { mutate: sendMessage } = useSendMessage();
  const error = useChatStore(state => state.error);

  // React Query handles loading state
  if (isLoading) return <Loading />;

  return (
    <div>
      {error && <ErrorDisplay error={error} />}
      {messages?.map(message => (
        <Message key={message.id} {...message} />
      ))}
      <InputArea onSend={content => sendMessage({ content })} />
    </div>
  );
};
```

Benefits of Hybrid Approach:

- Zustand manages UI state (current conversation, streaming status, errors)
- React Query handles data fetching, caching, and optimistic updates
- Clear separation of concerns
- Maintains existing Zustand patterns
- Leverages React Query's caching capabilities

Original Custom Implementation:

````rust
// In-memory conversation cache
#[derive(Debug)]
struct ConversationCache {
    messages: Vec<Message>,
    last_synced: DateTime<Utc>,
    dirty: bool,
}

impl ConversationCache {
    // Add message to cache and mark as dirty
    fn add_message(&mut self, message: Message) {
        self.messages.push(message);
        self.dirty = true;
    }

    // Sync cache with database if needed
    async fn sync_if_needed(&mut self, db: &SqlitePool) -> Result<(), Error> {
        let now = Utc::now();
        // Sync if dirty and either:
        // - More than 5 seconds since last sync
        // - More than 10 messages since last sync
        if self.dirty && (
            (now - self.last_synced).num_seconds() > 5 ||
            self.messages.len() >= 10
        ) {
            self.sync(db).await?;
        }
        Ok(())
    }

    // Force sync with database
    async fn sync(&mut self, db: &SqlitePool) -> Result<(), Error> {
        let mut tx = db.begin().await?;

        // Save any unsaved messages
        for message in &self.messages {
            if message.needs_sync() {
                save_message_atomic(&mut tx, message).await?;
            }
        }

        tx.commit().await?;
        self.dirty = false;
        self.last_synced = Utc::now();
        Ok(())
    }
}
````
// Sync triggers:
- On conversation switch
- Before fetching history
- Periodically (every 5 seconds)
- After batch of messages (10+)
- Before closing app

## Putting It All Together

The refactor plan addresses several key areas that work together to create a more reliable and performant system:

1. Message Lifecycle:
- UUID-based optimistic updates
- Clear state transitions (streaming/complete/error)
- Atomic database operations
- Proper error handling and rollback

2. Data Management Options:
a) Custom Implementation:
   - In-memory conversation cache
   - Periodic sync with database
   - Manual cache invalidation
   - Direct control over sync timing

b) React Query Integration:
   - Built-in caching system
   - Automatic background updates
   - Optimistic UI with rollback
   - Dev tools for debugging

c) Hybrid Approach:
   - Zustand for UI state
   - React Query for data layer
   - Clear separation of concerns
   - Best of both worlds

3. System Message Handling:
- Stored in conversation metadata
- Included in message history
- Provider-specific handling
- Proper context ordering

4. Implementation Strategy:
Phase 1: Core Improvements
- Add message status column
- Implement atomic operations
- Switch to UUID-based IDs
- Add proper error handling

Phase 2: Caching Layer (Choose One)
Option A:
- Implement custom cache
- Add sync mechanisms
- Setup periodic updates

Option B:
- Integrate React Query
- Setup query/mutation hooks
- Adapt streaming handlers

Option C:
- Implement hybrid approach
- Split state management
- Coordinate systems

Option D (Pure React Query):
- Move all state to React Query
- Use queries for UI state
- Handle streaming via mutations
- Benefits:
  * Single source of truth
  * Built-in caching
  * Simpler mental model
  * Better TypeScript support
- Tradeoffs:
  * More learning curve
  * Different streaming patterns
  * Some UI state complexity

Implementation:
```typescript
// Types
interface StreamingState {
  isStreaming: boolean;
  currentMessageId: string | null;
}

````
```typescript jsx
// Global state management with React Query
export const useStreamingState = () => {
  return useQuery({
    queryKey: ['streaming'],
    queryFn: () => ({ isStreaming: false, currentMessageId: null } as StreamingState),
    staleTime: Infinity, // Never consider stale since this is UI state
  });
};

// Conversation management
export const useCurrentConversation = () => {
  return useQuery({
    queryKey: ['currentConversation'],
    queryFn: () => invoke('get_current_conversation'),
    staleTime: Infinity, // Only changes on explicit user action
  });
};

// Message queries and mutations
export const useMessages = () => {
  const { data: conversation } = useCurrentConversation();

  return useQuery({
    queryKey: ['messages', conversation?.id],
    queryFn: () => invoke('get_messages', { conversationId: conversation?.id }),
    enabled: !!conversation?.id,
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  const { data: conversation } = useCurrentConversation();

  return useMutation({
    mutationFn: async ({ content, attachments }) => {
      return invoke('process_message', {
        message: content,
        conversation_id: conversation?.id,
        attachments,
      });
    },
    onMutate: async ({ content }) => {
      // Cancel outgoing fetches
      await queryClient.cancelQueries({
        queryKey: ['messages', conversation?.id],
      });

      // Get current messages
      const previousMessages = queryClient.getQueryData([
        'messages',
        conversation?.id,
      ]);

      // Optimistically add new messages
      queryClient.setQueryData(
        ['messages', conversation?.id],
        (old: Message[] = []) => [
          ...old,
          {
            id: `opt_${crypto.randomUUID()}`,
            content,
            role: 'user',
            status: 'pending',
          },
          {
            id: `opt_${crypto.randomUUID()}`,
            content: '',
            role: 'assistant',
            status: 'pending',
          },
        ],
      );

      // Update streaming state
      queryClient.setQueryData(['streaming'], {
        isStreaming: true,
        currentMessageId: null,
      });

      return { previousMessages };
    },
    onSuccess: (data, variables) => {
      // Setup stream handlers
      const unsubscribe = listen('stream-event', (event) => {
        const { content, is_final, message_id } = event;

        // Update message content
        queryClient.setQueryData(
          ['messages', conversation?.id],
          (messages: Message[] = []) =>
            messages.map(msg =>
              msg.id === message_id
                ? {
                    ...msg,
                    content: msg.content + content,
                    ...(is_final && { status: 'complete' }),
                  }
                : msg
            )
        );

        // Update streaming state
        if (is_final) {
          queryClient.setQueryData(['streaming'], {
            isStreaming: false,
            currentMessageId: null,
          });
          unsubscribe();
        }
      });
    },
    onError: (error, variables, context) => {
      // Rollback messages
      queryClient.setQueryData(
        ['messages', conversation?.id],
        context?.previousMessages
      );

      // Reset streaming state
      queryClient.setQueryData(['streaming'], {
        isStreaming: false,
        currentMessageId: null,
      });
    },
  });
};

// Component usage
const ChatContainer = () => {
  const { data: conversation } = useCurrentConversation();
  const { data: messages, isLoading } = useMessages();
  const { data: streamingState } = useStreamingState();
  const { mutate: sendMessage } = useSendMessage();

  if (isLoading) return <Loading />;

  return (
    <div>
      {messages?.map(message => (
        <Message
          key={message.id}
          {...message}
          isStreaming={streamingState?.currentMessageId === message.id}
        />
      ))}
      <InputArea
        onSend={content => sendMessage({ content })}
        disabled={streamingState?.isStreaming}
      />
    </div>
  );
};
````

Phase 3: Testing & Validation

- Test all message flows
- Verify error handling
- Check provider compatibility
- Validate cache behavior

The end result will be a system that:

- Handles messages reliably
- Maintains consistent state
- Performs efficiently
- Scales well with usage
- Remains easy to maintain

```

```
## Tauri Integration Considerations

Each caching option has different implications for Tauri integration:

### Option A (Custom Implementation):

- Direct access to Tauri's SQLite connection pool
- Full control over database transactions
- Manual sync with Tauri events
- Considerations:
   - Need to handle window/app lifecycle events
   - Must coordinate cache with Tauri's state
   - More complex but more control

### Option B (React Query):

- Works well with Tauri's invoke pattern
- Built-in request deduplication
- Automatic background syncing
- Considerations:
   - May need to adapt streaming events
   - Cache persists across window reloads
   - Simpler but less control

### Option C (Hybrid):

- Zustand for Tauri event state
- React Query for data operations
- Best of both worlds
- Considerations:
   - Clear separation of concerns
   - Easy to handle Tauri events
   - More complex setup but flexible

### Option D (Pure React Query):

- Simplest integration with Tauri
- All state in React Query
- Unified data flow
- Considerations:
   - Need to handle Tauri events as queries
   - May need custom cache persistence
   - Cleanest but most opinionated

### Common Tauri Considerations:

1. Window Events:

```typescript
// Need to handle for all options
window.listen("tauri://close-requested", async () => {
  // Option A: Force sync cache
  await cache.sync();

  // Option B/D: Wait for React Query
  await queryClient.invalidateQueries();

  // Option C: Coordinate both
  await Promise.all([cache.sync(), queryClient.invalidateQueries()]);

  // Then close
  await window.close();
});
```

2. Database Access:

```rust
// Available to all options through AppState
#[derive(Default)]
pub struct AppState {
    pub db: SqlitePool,
    // Option A: Add cache
    pub cache: Arc<Mutex<ConversationCache>>,
    // Other options use React Query
}
```

3. Event Handling:

```typescript
// Option A: Direct events
window.listen("cache-updated", () => {
  cache.markDirty();
});

// Option B/D: Through React Query
window.listen("cache-updated", () => {
  queryClient.invalidateQueries(["messages"]);
});

// Option C: Hybrid approach
window.listen("cache-updated", () => {
  store.markDirty();
  queryClient.invalidateQueries(["messages"]);
});
```

4. Performance:

- Option A: Best for large datasets
- Option B/D: Best for typical usage
- Option C: Good balance
- All options benefit from Tauri's IPC

Choose based on:

1. Dataset size
2. Update frequency
3. Offline needs
4. Team experience
