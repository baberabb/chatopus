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

interface ChatState {
  messages: Message[];
  currentConversationId: number | null;
  error: string | null;
}

// Use UUIDs for optimistic updates instead of negative numbers
// This ensures uniqueness without needing to track counters
const createOptimisticId = () => `opt_${crypto.randomUUID()}`;

const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentConversationId: null,
  error: null,

  sendMessage: async (content: string, attachments?: FileAttachment[]) => {
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
          (msg) => msg.id !== userMessageId && msg.id !== assistantMessageId,
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
