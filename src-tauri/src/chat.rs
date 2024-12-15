use crate::apimodels::{
    Message, MessageReactions, ProviderConfig, ProviderFactory, StreamResponse,
};
use crate::config::ConfigState;
use crate::AppState;
use chrono::{DateTime, Local};
use parking_lot;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{Sqlite, Transaction};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Serialize, Deserialize)]
pub struct Response {
    reply: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    message: String,
    details: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversationInfo {
    id: i64,
    title: String,
    preview: String,
    model: String,
    message_count: i64,
    timestamp: String,
}

// Database models
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
struct DbMessage {
    id: i64,
    conversation_id: i64,
    role: String,
    content: String,
    created_at: String,
    metadata: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct ConversationRow {
    id: i64,
    title: String,   // COALESCE ensures non-null
    preview: String, // COALESCE ensures non-null
    model: String,   // COALESCE ensures non-null
    message_count: i64,
    timestamp: String, // COALESCE ensures non-null
}

impl From<DbMessage> for Message {
    fn from(db_msg: DbMessage) -> Self {
        let timestamp = DateTime::parse_from_rfc3339(&db_msg.created_at)
            .map(|dt| dt.with_timezone(&Local).format("%I:%M %p").to_string())
            .unwrap_or_else(|_| Local::now().format("%I:%M %p").to_string());

        // Extract model from metadata if it exists
        let model = db_msg.metadata.and_then(|metadata| {
            serde_json::from_str::<Value>(&metadata)
                .ok()
                .and_then(|v| v.get("model").and_then(|m| m.as_str()).map(String::from))
        });

        Message {
            id: db_msg.id.to_string(),
            role: db_msg.role,
            content: db_msg.content,
            timestamp,
            reactions: Some(MessageReactions { thumbs_up: 0 }),
            model,
        }
    }
}

pub struct ChatHistory(pub Arc<parking_lot::Mutex<Vec<Message>>>);

fn db_error(e: sqlx::Error) -> ErrorResponse {
    ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    }
}

/// Gets the latest conversation ID or creates a new one if none exists.
/// Caches the result in AppState.
async fn get_or_create_conversation_cached(app_state: &AppState) -> Result<i64, ErrorResponse> {
    let db = &app_state.db;

    // First check if the cached conversation still exists
    let cached_id = {
        let guard = app_state.conversation_id.lock();
        *guard
    };

    if let Some(cid) = cached_id {
        // Verify the conversation exists
        if let Some(row) =
            sqlx::query!(r#"SELECT id as "id!" FROM conversations WHERE id = ?"#, cid)
                .fetch_optional(db)
                .await
                .map_err(db_error)?
        {
            return Ok(row.id);
        }
        // If we get here, the cached conversation doesn't exist anymore
        // Clear the cache
        {
            let mut guard = app_state.conversation_id.lock();
            *guard = None;
        }
    }

    // Try to get the latest conversation
    if let Some(row) =
        sqlx::query!(r#"SELECT id as "id!" FROM conversations ORDER BY updated_at DESC LIMIT 1"#)
            .fetch_optional(db)
            .await
            .map_err(db_error)?
    {
        let mut guard = app_state.conversation_id.lock();
        *guard = Some(row.id);
        return Ok(row.id);
    }

    // No existing conversation found, create a new one
    sqlx::query!(
        r#"
        INSERT INTO conversations (created_at, updated_at)
        VALUES (datetime('now'), datetime('now'))
        "#
    )
    .execute(db)
    .await
    .map_err(db_error)?;

    let id: i64 = sqlx::query_scalar!("SELECT last_insert_rowid()")
        .fetch_one(db)
        .await
        .map_err(db_error)?
        .into();

    {
        let mut guard = app_state.conversation_id.lock();
        *guard = Some(id);
    }

    Ok(id)
}

async fn save_message(
    tx: &mut Transaction<'_, Sqlite>,
    conversation_id: i64,
    role: &str,
    content: &str,
    model: Option<&str>,
) -> Result<Message, ErrorResponse> {
    // Update conversation timestamp
    sqlx::query!(
        r#"
        UPDATE conversations 
        SET updated_at = datetime('now')
        WHERE id = ?
        "#,
        conversation_id
    )
    .execute(&mut **tx)
    .await
    .map_err(db_error)?;

    // Create metadata JSON if model is provided
    let metadata = model.map(|m| format!(r#"{{"model":"{}"}}"#, m));

    // Insert the message
    sqlx::query!(
        r#"
        INSERT INTO messages (conversation_id, role, content, created_at, metadata)
        VALUES (?, ?, ?, datetime('now'), ?)
        "#,
        conversation_id,
        role,
        content,
        metadata
    )
    .execute(&mut **tx)
    .await
    .map_err(db_error)?;

    // Fetch last inserted message id
    let message_id: i64 = sqlx::query_scalar!("SELECT last_insert_rowid()")
        .fetch_one(&mut **tx)
        .await
        .map_err(db_error)?
        .into();

    let timestamp = Local::now().format("%I:%M %p").to_string();
    let msg = Message {
        id: message_id.to_string(),
        role: role.to_string(),
        content: content.to_string(),
        timestamp,
        reactions: Some(MessageReactions { thumbs_up: 0 }),
        model: model.map(String::from),
    };

    Ok(msg)
}

#[tauri::command]
pub async fn process_message(
    message: String,
    app_handle: AppHandle,
    chat_history: State<'_, ChatHistory>,
    config_state: State<'_, ConfigState>,
    window: tauri::Window,
) -> Result<Response, ErrorResponse> {
    println!("Received message: {}", message);

    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    // Get or create conversation only once
    let conversation_id = get_or_create_conversation_cached(&app_state).await?;

    // Extract provider configuration once
    let (provider_type, provider_config, streaming_enabled) = {
        let config = config_state.0.lock();
        let provider_settings = config
            .providers
            .get(&config.active_provider)
            .ok_or_else(|| ErrorResponse {
                message: "Provider configuration error".to_string(),
                details: Some("No provider configured".to_string()),
            })?;

        (
            config.active_provider.clone(),
            ProviderConfig {
                api_key: provider_settings.api_key.clone(),
                model: provider_settings.model.clone(),
                max_tokens: provider_settings.max_tokens,
            },
            provider_settings.streaming,
        )
    };

    // Short transaction for user message
    {
        let mut tx = db.begin().await.map_err(db_error)?;
        let user_message = save_message(&mut tx, conversation_id, "user", &message, None).await?;
        tx.commit().await.map_err(db_error)?;

        {
            let mut history = chat_history.0.lock();
            history.push(user_message);
        }
    }

    // Call provider outside of a transaction to avoid holding DB locks
    let provider = ProviderFactory::create_provider(&provider_type, provider_config.clone())
        .map_err(|e| ErrorResponse {
            message: "Provider initialization failed".to_string(),
            details: Some(e),
        })?;

    let history_snapshot = {
        // Lock once for reading
        let history = chat_history.0.lock();
        history.clone()
    };

    let full_response = if provider.supports_streaming() && streaming_enabled {
        // For now, we do not optimize the emit calls as requested.
        let window = Arc::new(parking_lot::Mutex::new(window));
        let callback = {
            let window = Arc::clone(&window);
            Box::new(move |response: StreamResponse| {
                if !response.text.is_empty() {
                    let _ = window.lock().emit("stream-response", &response.text);
                }
            }) as Box<dyn Fn(StreamResponse) + Send + Sync + 'static>
        };

        provider
            .send_message(history_snapshot, Some(callback))
            .await
            .map_err(|e| ErrorResponse {
                message: "API request failed".to_string(),
                details: Some(e),
            })?
    } else {
        provider
            .send_message(history_snapshot, None)
            .await
            .map_err(|e| ErrorResponse {
                message: "API request failed".to_string(),
                details: Some(e),
            })?
    };

    // Short transaction for assistant message
    {
        let mut tx = db.begin().await.map_err(db_error)?;
        let assistant_message = save_message(
            &mut tx,
            conversation_id,
            "assistant",
            &full_response,
            Some(&provider_config.model),
        )
        .await?;
        tx.commit().await.map_err(db_error)?;

        {
            let mut history = chat_history.0.lock();
            history.push(assistant_message);
        }
    }

    Ok(Response {
        reply: full_response,
    })
}

#[tauri::command]
pub async fn get_chat_history(
    app_handle: AppHandle,
    chat_history: State<'_, ChatHistory>,
) -> Result<Vec<Message>, ErrorResponse> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;
    let conversation_id = get_or_create_conversation_cached(&app_state).await?;

    // Check in-memory first
    {
        let history = chat_history.0.lock();
        if !history.is_empty() {
            return Ok(history.clone());
        }
    }

    // If empty, load from DB
    let messages = sqlx::query_as!(
        DbMessage,
        r#"
            SELECT 
                id as "id!",
                conversation_id as "conversation_id!",
                role as "role!",
                content as "content!",
                created_at as "created_at!",
                metadata
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
        "#,
        conversation_id
    )
    .fetch_all(db)
    .await
    .map_err(db_error)?
    .into_iter()
    .map(Message::from)
    .collect::<Vec<Message>>();

    {
        let mut history = chat_history.0.lock();
        *history = messages.clone();
    }

    Ok(messages)
}

#[tauri::command]
pub async fn clear_chat_history(
    app_handle: AppHandle,
    chat_history: State<'_, ChatHistory>,
) -> Result<i64, ErrorResponse> {
    // Changed return type to return the new ID
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    // Create a new conversation
    sqlx::query!(
        r#"
        INSERT INTO conversations (created_at, updated_at)
        VALUES (datetime('now'), datetime('now'))
        "#
    )
    .execute(db)
    .await
    .map_err(db_error)?;

    // Get the new conversation ID
    let new_id: i64 = sqlx::query_scalar!("SELECT last_insert_rowid()")
        .fetch_one(db)
        .await
        .map_err(db_error)?
        .into();

    // Update cached conversation_id
    {
        let mut cid_guard = app_state.conversation_id.lock();
        *cid_guard = Some(new_id);
    }

    // Clear in-memory history
    chat_history.0.lock().clear();

    Ok(new_id) // Return the new ID
}

#[tauri::command]
pub async fn get_conversations(
    app_handle: AppHandle,
) -> Result<Vec<ConversationInfo>, ErrorResponse> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    let conversations = sqlx::query_as!(
        ConversationRow,
        r#"
        SELECT 
            c.id as "id!",
            COALESCE(
                (SELECT content FROM messages 
                WHERE conversation_id = c.id 
                AND role = 'user' 
                ORDER BY created_at ASC 
                LIMIT 1),
                'New Chat'
            ) as "title!: String",
            COALESCE(
                (SELECT content FROM messages 
                WHERE conversation_id = c.id 
                ORDER BY created_at DESC 
                LIMIT 1),
                ''
            ) as "preview!: String",
            COALESCE(
                (SELECT json_extract(metadata, '$.model')
                FROM messages 
                WHERE conversation_id = c.id 
                AND metadata IS NOT NULL 
                ORDER BY created_at DESC 
                LIMIT 1),
                'Unknown Model'
            ) as "model!: String",
            COALESCE(
                (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id),
                0
            ) as "message_count!: i64",
            COALESCE(
                (SELECT created_at FROM messages 
                WHERE conversation_id = c.id 
                ORDER BY created_at DESC 
                LIMIT 1),
                c.created_at
            ) as "timestamp!: String"
        FROM conversations c
        ORDER BY c.updated_at DESC
        "#
    )
    .fetch_all(db)
    .await
    .map_err(db_error)?;

    Ok(conversations
        .into_iter()
        .map(|row| ConversationInfo {
            id: row.id,
            title: row.title,
            preview: row.preview,
            model: row.model,
            message_count: row.message_count,
            timestamp: row.timestamp,
        })
        .collect())
}

#[tauri::command]
pub async fn load_conversation_messages(
    conversation_id: i64,
    app_handle: AppHandle,
    chat_history: State<'_, ChatHistory>,
) -> Result<Vec<Message>, ErrorResponse> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    // Update current conversation ID
    {
        let mut guard = app_state.conversation_id.lock();
        *guard = Some(conversation_id);
    }

    // Load messages for the conversation
    let messages = sqlx::query_as!(
        DbMessage,
        r#"
            SELECT 
                id as "id!",
                conversation_id as "conversation_id!",
                role as "role!",
                content as "content!",
                created_at as "created_at!",
                metadata
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
        "#,
        conversation_id
    )
    .fetch_all(db)
    .await
    .map_err(db_error)?
    .into_iter()
    .map(Message::from)
    .collect::<Vec<Message>>();

    // Update in-memory history
    {
        let mut history = chat_history.0.lock();
        *history = messages.clone();
    }

    Ok(messages)
}

#[tauri::command]
pub async fn delete_conversation(
    conversation_id: i64,
    app_handle: AppHandle,
    chat_history: State<'_, ChatHistory>,
) -> Result<(), ErrorResponse> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    // Delete the conversation and its messages (messages will be cascade deleted)
    sqlx::query!(
        r#"
        DELETE FROM conversations
        WHERE id = ?
        "#,
        conversation_id
    )
    .execute(db)
    .await
    .map_err(db_error)?;

    // If this was the current conversation, clear it
    {
        let mut guard = app_state.conversation_id.lock();
        if guard.map_or(false, |id| id == conversation_id) {
            *guard = None;
            chat_history.0.lock().clear();
        }
    }

    Ok(())
}
