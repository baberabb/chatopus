use crate::apimodels::{
    core::{
        error::Error,
        provider::{Provider, ProviderBuilder, ProviderOptions},
        types::{ContentBlock, Message},
    },
    get_provider_registry,
};
use crate::config::ConfigState;
use crate::database::chat;
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

impl From<chat::ErrorResponse> for ProcessMessageError {
    fn from(error: chat::ErrorResponse) -> Self {
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

#[derive(Debug, Deserialize, Clone)]
pub struct MessageInput {
    content: String,
    role: String,
    attachments: Option<Vec<crate::attachments::SaveAttachmentRequest>>,
}

#[derive(Debug, Deserialize)]
pub struct ProcessMessageRequest {
    message: String,
    conversation_id: Option<i64>,
    attachments: Option<Vec<crate::attachments::SaveAttachmentRequest>>,
}

#[derive(Debug, Deserialize)]
pub struct ProcessConversationRequest {
    messages: Vec<MessageInput>,
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
pub async fn process_conversation<R: Runtime>(
    request: ProcessConversationRequest,
    app_handle: AppHandle<R>,
    config_state: State<'_, ConfigState>,
    cancellation_state: State<'_, CancellationState>,
    window: Window<R>,
) -> std::result::Result<Response, ProcessMessageError> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    // Get or create conversation ID
    let conversation_id = if let Some(id) = request.conversation_id {
        id
    } else {
        let new_id = chat::create_conversation(db, None).await?;
        {
            let mut guard = app_state.conversation_id.lock();
            *guard = Some(new_id);
        }
        new_id
    };

    // Get provider configuration
    let (provider_type, streaming_enabled, provider_settings) = {
        let config = config_state.0.lock();
        let provider_settings = config
            .providers
            .get(&config.active_provider)
            .ok_or_else(|| ProcessMessageError {
                message: "Provider configuration error".to_string(),
                details: Some("No provider configured".to_string()),
            })?;

        let streaming = provider_settings
            .parameters
            .get("streaming")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        (
            config.active_provider.clone(),
            streaming,
            provider_settings.clone(),
        )
    };

    // Save all messages in the conversation
    let mut tx = db.begin().await.map_err(|e| chat::ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    })?;

    // Get the last two messages (user input and empty assistant message)
    let user_message = request
        .messages
        .iter()
        .rev()
        .nth(1)
        .ok_or_else(|| ProcessMessageError {
            message: "Invalid message sequence".to_string(),
            details: None,
        })?;

    // Save user message
    let saved_user_message = chat::save_message(
        &mut tx,
        conversation_id,
        &user_message.role,
        vec![ContentBlock {
            r#type: "text".to_string(),
            text: Some(user_message.content.clone()),
            image_url: None,
        }],
        None,
        None,
    )
    .await?;

    // Save any attachments
    if let Some(attachments) = user_message.clone().attachments {
        for mut attachment_request in attachments {
            attachment_request.message_id = saved_user_message.id.parse().unwrap();
            crate::attachments::save_attachment(app_handle.clone(), attachment_request)
                .await
                .map_err(|e| chat::ErrorResponse {
                    message: "Failed to save attachment".to_string(),
                    details: Some(e),
                })?;
        }
    }

    tx.commit().await.map_err(|e| chat::ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    })?;

    // Get provider from registry
    let registry = get_provider_registry();
    let provider = registry.get_provider(&provider_type)?;

    // Load conversation history
    let history = chat::get_messages_for_conversation(db, conversation_id).await?;

    // Setup cancellation
    let (cancel_tx, cancel_rx) = broadcast::channel(1);
    {
        let mut cancel_state = cancellation_state.0.lock();
        *cancel_state = Some(cancel_tx);
    }

    // Process message with full conversation context
    let buffer = Arc::new(Mutex::new(Vec::new()));
    let full_response = if provider.capabilities().supports_streaming && streaming_enabled {
        let window_clone = window.clone();
        let buffer_clone = buffer.clone();

        provider
            .send_message_streaming(
                history,
                ProviderOptions {
                    model: Some(provider_settings.model.clone()),
                    stream: true,
                    parameters: Some(provider_settings.parameters.clone()),
                    ..Default::default()
                },
                Box::new(move |chunk| {
                    {
                        let mut buffer = buffer_clone.lock().unwrap();
                        if buffer.is_empty() {
                            buffer.push(ContentBlock {
                                r#type: "text".to_string(),
                                text: Some(chunk.to_string()),
                                image_url: None,
                            });
                        } else {
                            if let Some(block) = buffer.first_mut() {
                                if let Some(text) = &mut block.text {
                                    text.push_str(&chunk);
                                }
                            }
                        }
                    }
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
                    model: Some(provider_settings.model.clone()),
                    stream: false,
                    parameters: Some(provider_settings.parameters.clone()),
                    ..Default::default()
                },
            )
            .await?;

        if let Some(text) = response
            .content
            .first()
            .and_then(|block| block.text.as_ref())
        {
            window.emit("stream-response", text).map_err(Error::from)?;
        }

        response.content
    };

    // Save assistant message
    let mut tx = db.begin().await.map_err(|e| chat::ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    })?;
    let assistant_message = chat::save_message(
        &mut tx,
        conversation_id,
        "assistant",
        full_response.clone(),
        Some(&provider_type),
        None,
    )
    .await?;
    tx.commit().await.map_err(|e| chat::ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    })?;

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
        user_message_id: saved_user_message.id.parse::<i64>().unwrap(),
        assistant_message_id: assistant_message.id.parse::<i64>().unwrap(),
        conversation_id,
    })
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

    // Get or create conversation ID
    let conversation_id = if let Some(id) = request.conversation_id {
        // Use provided conversation ID
        id
    } else {
        // Clear any cached conversation ID
        {
            let mut guard = app_state.conversation_id.lock();
            *guard = None;
        }

        // Create new conversation
        let new_id = chat::create_conversation(db, None).await?;

        // Update cache with new conversation
        {
            let mut guard = app_state.conversation_id.lock();
            *guard = Some(new_id);
        }

        new_id
    };

    // Get provider configuration
    let (provider_type, streaming_enabled, provider_settings) = {
        let config = config_state.0.lock();
        let provider_settings = config
            .providers
            .get(&config.active_provider)
            .ok_or_else(|| ProcessMessageError {
                message: "Provider configuration error".to_string(),
                details: Some("No provider configured".to_string()),
            })?;

        let streaming = provider_settings
            .parameters
            .get("streaming")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        (
            config.active_provider.clone(),
            streaming,
            provider_settings.clone(),
        )
    };

    // Save user message and attachments
    let mut tx = db.begin().await.map_err(|e| chat::ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    })?;

    // Save message first
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

    // Save any attachments
    if let Some(attachments) = request.attachments {
        for mut attachment_request in attachments {
            attachment_request.message_id = user_message.id.parse().unwrap();
            crate::attachments::save_attachment(app_handle.clone(), attachment_request)
                .await
                .map_err(|e| chat::ErrorResponse {
                    message: "Failed to save attachment".to_string(),
                    details: Some(e),
                })?;
        }
    }

    tx.commit().await.map_err(|e| chat::ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    })?;

    // Get provider from registry
    let registry = get_provider_registry();
    let provider = registry.get_provider(&provider_type)?;

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
                    model: Some(provider_settings.model.clone()),
                    stream: true,
                    parameters: Some(provider_settings.parameters.clone()),
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
                    model: Some(provider_settings.model.clone()),
                    stream: false,
                    parameters: Some(provider_settings.parameters.clone()),
                    ..Default::default()
                },
            )
            .await?;

        // For non-streaming responses, emit a single stream-response event with the full content
        if let Some(text) = response
            .content
            .first()
            .and_then(|block| block.text.as_ref())
        {
            window.emit("stream-response", text).map_err(Error::from)?;
        }

        response.content
    };

    // Save assistant message
    let mut tx = db.begin().await.map_err(|e| chat::ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    })?;
    let assistant_message = chat::save_message(
        &mut tx,
        conversation_id,
        "assistant",
        full_response.clone(),
        Some(&provider_type),
        None,
    )
    .await?;
    tx.commit().await.map_err(|e| chat::ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    })?;

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

    // Clear conversation cache first
    {
        let mut guard = app_state.conversation_id.lock();
        *guard = None;
    }

    // Create new conversation with no parent
    let new_id = chat::create_conversation(db, None)
        .await
        .map_err(|e| e.message)?;

    // Update cache with new conversation
    {
        let mut guard = app_state.conversation_id.lock();
        *guard = Some(new_id);
    }

    Ok(new_id)
}

#[tauri::command]
pub async fn get_conversations(
    app_handle: AppHandle,
) -> std::result::Result<Vec<chat::ConversationInfo>, String> {
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
            id AS "id: i64",
            conversation_id,
            role,
            content,
            created_at,
            metadata,
            original_message_id
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
    println!("Received updates: {:?}", updates);

    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    chat::update_conversation(db, conversation_id, updates)
        .await
        .map_err(|e| {
            println!("Update error: {:?}", e);
            e.message
        })
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

#[tauri::command]
pub async fn create_conversation(app_handle: AppHandle) -> Result<i64, String> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    // Clear conversation cache first
    {
        let mut guard = app_state.conversation_id.lock();
        *guard = None;
    }

    // Create new conversation with no parent
    let new_id = chat::create_conversation(db, None)
        .await
        .map_err(|e| e.message)?;

    // Update cache with new conversation
    {
        let mut guard = app_state.conversation_id.lock();
        *guard = Some(new_id);
    }

    Ok(new_id)
}
