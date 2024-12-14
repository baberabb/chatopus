use crate::apimodels::{
    Message, MessageReactions, ProviderConfig, ProviderFactory, StreamResponse,
};
use crate::config::ConfigState;
use chrono::{DateTime, Local};
use parking_lot;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::sync::Arc;
// Emitter is important! do not delete!!!
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

// Convert database message to API message
impl From<DbMessage> for Message {
    fn from(db_msg: DbMessage) -> Self {
        Message {
            id: db_msg.id.to_string(),
            role: db_msg.role,
            content: db_msg.content,
            timestamp: DateTime::parse_from_rfc3339(&db_msg.created_at)
                .map(|dt| dt.with_timezone(&Local).format("%I:%M %p").to_string())
                .unwrap_or_else(|_| Local::now().format("%I:%M %p").to_string()),
            reactions: Some(MessageReactions { thumbs_up: 0 }), // TODO: Store reactions in metadata
        }
    }
}

pub struct ChatHistory(pub Arc<parking_lot::Mutex<Vec<Message>>>);

async fn get_or_create_conversation(db: &SqlitePool) -> Result<i64, ErrorResponse> {
    // Get the latest active conversation or create a new one
    let result = sqlx::query!(
        r#"
        SELECT id as "id!" FROM conversations 
        ORDER BY updated_at DESC 
        LIMIT 1
        "#
    )
    .fetch_optional(db)
    .await
    .map_err(|e| ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    })?;

    if let Some(row) = result {
        Ok(row.id)
    } else {
        // Create new conversation
        let result = sqlx::query!(
            r#"
            INSERT INTO conversations (created_at, updated_at)
            VALUES (datetime('now'), datetime('now'))
            RETURNING id as "id!"
            "#
        )
        .fetch_one(db)
        .await
        .map_err(|e| ErrorResponse {
            message: "Database error".to_string(),
            details: Some(e.to_string()),
        })?;
        Ok(result.id)
    }
}

async fn save_message(
    db: &SqlitePool,
    conversation_id: i64,
    role: &str,
    content: &str,
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
    .execute(db)
    .await
    .map_err(|e| ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    })?;

    // Insert message
    let db_message = sqlx::query_as!(
        DbMessage,
        r#"
        INSERT INTO messages (conversation_id, role, content, created_at)
        VALUES (?, ?, ?, datetime('now'))
        RETURNING id as "id!", conversation_id as "conversation_id!", role as "role!", content as "content!", created_at as "created_at!", metadata
        "#,
        conversation_id,
        role,
        content
    )
    .fetch_one(db)
    .await
    .map_err(|e| ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    })?;

    Ok(Message::from(db_message))
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

    let db = app_handle.state::<crate::AppState>().db.clone();
    let conversation_id = get_or_create_conversation(&db).await?;

    // Save user message to DB and add to in-memory history
    let user_message = save_message(&db, conversation_id, "user", &message).await?;
    chat_history.0.lock().push(user_message.clone());

    // Get current provider config
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

    let provider =
        ProviderFactory::create_provider(&provider_type, provider_config).map_err(|e| {
            ErrorResponse {
                message: "Provider initialization failed".to_string(),
                details: Some(e),
            }
        })?;

    // Use in-memory history for the API call
    let history = chat_history.0.lock().clone();

    let full_response = if provider.supports_streaming() && streaming_enabled {
        let window = Arc::new(parking_lot::Mutex::new(window));
        let callback = {
            let window = Arc::clone(&window);
            Box::new(move |response: StreamResponse| {
                if !response.text.is_empty() {
                    window
                        .lock()
                        .emit("stream-response", &response.text)
                        .expect("Failed to emit event");
                }
            }) as Box<dyn Fn(StreamResponse) + Send + Sync + 'static>
        };

        provider
            .send_message(history, Some(callback))
            .await
            .map_err(|e| ErrorResponse {
                message: "API request failed".to_string(),
                details: Some(e),
            })?
    } else {
        provider
            .send_message(history, None)
            .await
            .map_err(|e| ErrorResponse {
                message: "API request failed".to_string(),
                details: Some(e),
            })?
    };

    // Save assistant message to DB and add to in-memory history
    let assistant_message = save_message(&db, conversation_id, "assistant", &full_response).await?;
    chat_history.0.lock().push(assistant_message);

    Ok(Response {
        reply: full_response,
    })
}

#[tauri::command]
pub async fn get_chat_history(
    app_handle: AppHandle,
    chat_history: State<'_, ChatHistory>,
) -> Result<Vec<Message>, ErrorResponse> {
    let db = app_handle.state::<crate::AppState>().db.clone();
    let conversation_id = get_or_create_conversation(&db).await?;

    // Check if history is empty without holding the lock
    let is_empty = chat_history.0.lock().is_empty();

    if is_empty {
        // Load messages from DB
        let messages = sqlx::query_as!(
            DbMessage,
            r#"
            SELECT id as "id!", conversation_id as "conversation_id!", role as "role!", content as "content!", created_at as "created_at!", metadata
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            "#,
            conversation_id
        )
        .fetch_all(&db)
        .await
        .map_err(|e| ErrorResponse {
            message: "Database error".to_string(),
            details: Some(e.to_string()),
        })?
        .into_iter()
        .map(Message::from)
        .collect::<Vec<Message>>();

        // Update in-memory history
        let mut history = chat_history.0.lock();
        *history = messages.clone();
        Ok(messages)
    } else {
        // Return in-memory history
        Ok(chat_history.0.lock().clone())
    }
}

#[tauri::command]
pub async fn clear_chat_history(
    app_handle: AppHandle,
    chat_history: State<'_, ChatHistory>,
) -> Result<(), ErrorResponse> {
    let db = app_handle.state::<crate::AppState>().db.clone();

    // Create a new conversation
    sqlx::query!(
        r#"
        INSERT INTO conversations (created_at, updated_at)
        VALUES (datetime('now'), datetime('now'))
        "#
    )
    .execute(&db)
    .await
    .map_err(|e| ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    })?;

    // Clear in-memory history
    chat_history.0.lock().clear();

    Ok(())
}
