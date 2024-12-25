use crate::apimodels::{
    core::{
        error::Error,
        provider::{Provider, ProviderBuilder, ProviderOptions},
        types::{ContentBlock, Message},
    },
    get_provider_registry,
};
use crate::config::ConfigState;
use crate::database::chat::ErrorResponse;
use crate::database::chat::{self, ConversationInfo};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, Runtime, State, Window};
use tokio::sync::broadcast;

#[derive(Debug, Serialize, Deserialize)]
pub struct Response {
    pub reply: Vec<ContentBlock>,
    pub user_message_id: i64,
    pub assistant_message_id: i64,
    pub conversation_id: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessMessageError {
    pub message: String,
    pub details: Option<String>,
}

impl From<ErrorResponse> for ProcessMessageError {
    fn from(error: ErrorResponse) -> Self {
        ProcessMessageError {
            message: error.message,
            details: error.details,
        }
    }
}

impl From<Error> for ProcessMessageError {
    fn from(error: Error) -> Self {
        ProcessMessageError {
            message: "Provider error".to_string(),
            details: Some(error.to_string()),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ProcessMessageRequest {
    message: String,
    conversation_id: Option<i64>,
}

#[derive(Clone)]
pub struct CancellationState(pub Arc<parking_lot::Mutex<Option<broadcast::Sender<()>>>>);

impl Default for CancellationState {
    fn default() -> Self {
        Self(Arc::new(parking_lot::Mutex::new(None)))
    }
}

#[tauri::command]
pub async fn process_message<R: Runtime>(
    request: ProcessMessageRequest,
    app_handle: AppHandle<R>,
    config_state: State<'_, ConfigState>,
    cancellation_state: State<'_, CancellationState>,
    window: Window<R>,
) -> std::result::Result<Response, ProcessMessageError> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    // Get or create conversation
    let conversation_id = match request.conversation_id {
        Some(id) => {
            // Verify conversation exists
            let exists = sqlx::query!(
                r#"SELECT COUNT(*) as count FROM conversations WHERE id = ?"#,
                id
            )
            .fetch_one(db)
            .await
            .map_err(chat::db_error)?
            .count
                > 0;

            if !exists {
                return Err(ProcessMessageError {
                    message: "Conversation not found".to_string(),
                    details: Some(format!("Conversation {} does not exist", id)),
                });
            }
            id
        }
        None => chat::get_or_create_conversation_cached(&app_state).await?,
    };

    // Get provider configuration
    let (provider_type, api_key, streaming_enabled, model) = {
        let config = config_state.0.lock();
        let provider_settings = config
            .providers
            .get(&config.active_provider)
            .ok_or_else(|| ProcessMessageError {
                message: "No provider configured".to_string(),
                details: Some("Please configure a provider in settings".to_string()),
            })?;

        if provider_settings.api_key.is_empty() {
            return Err(ProcessMessageError {
                message: "API key not configured".to_string(),
                details: Some("Please add your API key in settings".to_string()),
            });
        }

        let streaming = provider_settings
            .parameters
            .get("streaming")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        (
            config.active_provider.clone(),
            provider_settings.api_key.clone(),
            streaming,
            provider_settings.model.clone(),
        )
    };

    // Save user message
    let mut tx = db.begin().await.map_err(chat::db_error)?;
    let user_message = chat::save_message(
        &mut tx,
        conversation_id,
        "user",
        vec![ContentBlock {
            r#type: "text".to_string(),
            text: Some(request.message.clone()),
            image_url: None,
        }],
        None,
        None,
    )
    .await?;
    tx.commit().await.map_err(chat::db_error)?;

    // Get provider registry and create provider
    let registry = get_provider_registry();
    let builder = ProviderBuilder::new(provider_type.clone(), api_key).with_model(model);
    let provider = registry.create_provider(&provider_type, builder)?;

    // Load conversation history
    let history = chat::get_messages_for_conversation(db, conversation_id).await?;

    // Setup cancellation
    let (cancel_tx, cancel_rx) = broadcast::channel(1);
    {
        let mut cancel_state = cancellation_state.0.lock();
        *cancel_state = Some(cancel_tx);
    }

    // Process message
    let buffer = Arc::new(Mutex::new(Vec::new()));
    let full_response = if provider.capabilities().supports_streaming && streaming_enabled {
        let window_clone = window.clone();
        let buffer_clone = buffer.clone();

        provider
            .send_message_streaming(
                history,
                ProviderOptions {
                    stream: true,
                    ..Default::default()
                },
                Box::new(move |chunk| {
                    // 1. Update the buffer with content blocks
                    {
                        let mut buffer = buffer_clone.lock().unwrap();
                        if buffer.is_empty() {
                            // First chunk - create new content block
                            buffer.push(ContentBlock {
                                r#type: "text".to_string(),
                                text: Some(chunk.to_string()),
                                image_url: None,
                            });
                        } else {
                            // Append to existing content block
                            if let Some(block) = buffer.first_mut() {
                                if let Some(text) = &mut block.text {
                                    text.push_str(&chunk);
                                }
                            }
                        }
                    }

                    // 2. Send raw text chunk to frontend
                    window_clone
                        .emit("stream-response", chunk)
                        .map_err(Error::from)
                }),
                cancel_rx,
            )
            .await?;

        buffer.lock().unwrap().clone()
    } else {
        let response = provider
            .send_message(
                history,
                ProviderOptions {
                    stream: false,
                    ..Default::default()
                },
            )
            .await?;

        response.content
    };

    // Save assistant message
    let mut tx = db.begin().await.map_err(chat::db_error)?;
    let assistant_message = chat::save_message(
        &mut tx,
        conversation_id,
        "assistant",
        full_response.clone(),
        Some(&provider_type),
        None,
    )
    .await?;
    tx.commit().await.map_err(chat::db_error)?;

    // Clear cancellation
    {
        let mut cancel_state = cancellation_state.0.lock();
        *cancel_state = None;
    }

    // Send completion event
    if let Err(e) = window.emit("stream-complete", &assistant_message.id) {
        eprintln!("Failed to emit stream complete: {}", e);
    }

    Ok(Response {
        reply: full_response,
        user_message_id: user_message.id.parse::<i64>().unwrap(),
        assistant_message_id: assistant_message.id.parse::<i64>().unwrap(),
        conversation_id,
    })
}

#[tauri::command]
pub async fn get_chat_history(app_handle: AppHandle) -> std::result::Result<Vec<Message>, String> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;
    let conversation_id = chat::get_or_create_conversation_cached(&app_state)
        .await
        .map_err(|e| e.message)?;
    chat::get_messages_for_conversation(db, conversation_id)
        .await
        .map_err(|e| e.message)
}

#[tauri::command]
pub async fn clear_chat_history(app_handle: AppHandle) -> std::result::Result<i64, String> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    let new_id = chat::create_conversation(db).await.map_err(|e| e.message)?;

    // Update cached conversation_id
    {
        let mut cid_guard = app_state.conversation_id.lock();
        *cid_guard = Some(new_id);
    }

    Ok(new_id)
}

#[tauri::command]
pub async fn get_conversations(
    app_handle: AppHandle,
) -> std::result::Result<Vec<ConversationInfo>, String> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;
    chat::get_all_conversations(db).await.map_err(|e| e.message)
}

#[tauri::command]
pub async fn load_conversation_messages(
    conversation_id: i64,
    app_handle: AppHandle,
) -> std::result::Result<Vec<Message>, String> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    // Update current conversation ID
    {
        let mut guard = app_state.conversation_id.lock();
        *guard = Some(conversation_id);
    }

    chat::get_messages_for_conversation(db, conversation_id)
        .await
        .map_err(|e| e.message)
}

#[tauri::command]
pub async fn cancel_message(
    cancellation_state: State<'_, CancellationState>,
) -> std::result::Result<(), String> {
    let cancel_state = cancellation_state.0.lock();
    if let Some(tx) = &*cancel_state {
        let _ = tx.send(());
    }
    Ok(())
}

#[tauri::command]
pub async fn edit_message(
    message_id: String,
    new_content: String,
    app_handle: AppHandle,
) -> std::result::Result<Message, String> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    // Parse message ID first
    let id = message_id
        .parse::<i64>()
        .map_err(|_| "Invalid message ID".to_string())?;

    let mut tx = db.begin().await.map_err(|e| e.to_string())?;

    // Get current message to preserve metadata
    let current = sqlx::query!(
        r#"
        SELECT 
            id as "id: i64",
            conversation_id as "conversation_id: i64",
            role,
            content,
            created_at,
            metadata,
            original_message_id as "original_message_id: i64"
        FROM messages 
        WHERE id = ?
        "#,
        id
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // Save edited message
    let edited = chat::save_message(
        &mut tx,
        current.conversation_id,
        &current.role,
        vec![ContentBlock {
            r#type: "text".to_string(),
            text: Some(new_content),
            image_url: None,
        }],
        None,
        Some(current.id),
    )
    .await
    .map_err(|e| e.message)?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(edited)
}

#[tauri::command]
pub async fn update_conversation(
    conversation_id: i64,
    updates: serde_json::Value,
    app_handle: AppHandle,
) -> std::result::Result<(), String> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    chat::update_conversation(db, conversation_id, updates)
        .await
        .map_err(|e| e.message)
}

#[tauri::command]
pub async fn delete_conversation(
    conversation_id: i64,
    app_handle: AppHandle,
) -> std::result::Result<(), String> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    chat::delete_conversation(db, conversation_id)
        .await
        .map_err(|e| e.message)?;

    // If this was the current conversation, clear it
    {
        let mut guard = app_state.conversation_id.lock();
        if guard.map_or(false, |id| id == conversation_id) {
            *guard = None;
        }
    }

    Ok(())
}
