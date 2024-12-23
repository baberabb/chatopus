use crate::apimodels::{
    config::{ProviderConfig, RequestConfig},
    error::ProviderError,
    provider::ProviderFactory,
    types::{Message, StreamResponse},
};
use crate::config::ConfigState;
use crate::database::chat::ErrorResponse;
use crate::database::chat::{self, ConversationInfo, ConversationRow, DbMessage};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, Runtime, State, Window};
use tokio::sync::broadcast;

#[derive(Debug, Serialize, Deserialize)]
pub struct Response {
    pub reply: String,
    pub message_id: String,
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
) -> Result<Response, ProcessMessageError> {
    println!(
        "Processing message: {} for conversation: {:?}",
        request.message, request.conversation_id
    );

    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    // Get or create conversation using the single source of truth
    let conversation_id = chat::get_or_create_conversation_cached(&app_state)
        .await
        .map_err(ProcessMessageError::from)?;

    // Extract provider configuration
    let (provider_type, provider_config, streaming_enabled) = {
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
            ProviderConfig {
                api_key: provider_settings.api_key.clone(),
                model: provider_settings.model.clone(),
                parameters: provider_settings.parameters.clone(),
                custom_parameters: provider_settings.custom_parameters.clone(),
                api_version: provider_settings.api_version.clone(),
                base_url: provider_settings.base_url.clone(),
                timeout_seconds: provider_settings.timeout_seconds,
                retry_attempts: provider_settings.retry_attempts,
                additional_headers: provider_settings.additional_headers.clone(),
            },
            streaming,
        )
    };

    // Save user message
    let mut tx = db
        .begin()
        .await
        .map_err(chat::db_error)
        .map_err(ProcessMessageError::from)?;
    let user_message = chat::save_message(
        &mut tx,
        conversation_id,
        "user",
        &request.message,
        None,
        None,
    )
    .await
    .map_err(ProcessMessageError::from)?;
    tx.commit()
        .await
        .map_err(chat::db_error)
        .map_err(ProcessMessageError::from)?;

    // Initialize provider
    let provider = match ProviderFactory::create_provider(&provider_type, provider_config.clone()) {
        Ok(p) => p,
        Err(e) => {
            return Err(ProcessMessageError {
                message: "Provider initialization failed".to_string(),
                details: Some(e.to_string()),
            });
        }
    };

    // Load conversation history
    let history = chat::get_messages_for_conversation(db, conversation_id)
        .await
        .map_err(ProcessMessageError::from)?;

    // Setup cancellation
    let (cancel_tx, cancel_rx) = broadcast::channel(1);
    {
        let mut cancel_state = cancellation_state.0.lock();
        *cancel_state = Some(cancel_tx);
    }

    // Process message
    let full_response = if provider.supports_streaming() && streaming_enabled {
        let window = window.clone();
        let callback = Box::new(move |response: StreamResponse| {
            if !response.text.is_empty() {
                window
                    .emit("stream-response", &response.text)
                    .unwrap_or_else(|e| {
                        eprintln!("Failed to emit stream response: {}", e);
                    });
            }
        }) as Box<dyn Fn(StreamResponse) + Send + Sync + 'static>;

        match provider
            .send_message(
                history,
                Some(callback),
                Some(RequestConfig {
                    streaming: true,
                    ..Default::default()
                }),
                Some(cancel_rx),
            )
            .await
        {
            Ok(response) => response,
            Err(e) => {
                return Err(ProcessMessageError {
                    message: "API request failed".to_string(),
                    details: Some(e.to_string()),
                });
            }
        }
    } else {
        match provider
            .send_message(
                history,
                None,
                Some(RequestConfig {
                    streaming: false,
                    ..Default::default()
                }),
                None,
            )
            .await
        {
            Ok(response) => response,
            Err(e) => {
                return Err(ProcessMessageError {
                    message: "API request failed".to_string(),
                    details: Some(e.to_string()),
                });
            }
        }
    };

    // Save assistant message
    let mut tx = db.begin().await.map_err(chat::db_error)?;
    let assistant_message = chat::save_message(
        &mut tx,
        conversation_id,
        "assistant",
        &full_response,
        Some(&provider_config.model),
        None,
    )
    .await
    .map_err(ProcessMessageError::from)?;
    tx.commit()
        .await
        .map_err(chat::db_error)
        .map_err(ProcessMessageError::from)?;

    // Clear cancellation
    {
        let mut cancel_state = cancellation_state.0.lock();
        *cancel_state = None;
    }

    // Send completion event
    window
        .emit("stream-complete", &assistant_message.id)
        .unwrap_or_else(|e| {
            eprintln!("Failed to emit stream complete: {}", e);
        });

    Ok(Response {
        reply: full_response,
        message_id: assistant_message.id.to_string(),
        conversation_id,
    })
}

#[tauri::command]
pub async fn get_chat_history(app_handle: AppHandle) -> Result<Vec<Message>, ErrorResponse> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;
    let conversation_id = chat::get_or_create_conversation_cached(&app_state).await?;
    chat::get_messages_for_conversation(db, conversation_id).await
}

#[tauri::command]
pub async fn clear_chat_history(app_handle: AppHandle) -> Result<i64, ErrorResponse> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    let new_id = chat::create_conversation(db).await?;

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
) -> Result<Vec<ConversationInfo>, ErrorResponse> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;
    chat::get_all_conversations(db).await
}

#[tauri::command]
pub async fn load_conversation_messages(
    conversation_id: i64,
    app_handle: AppHandle,
) -> Result<Vec<Message>, ErrorResponse> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    // Update current conversation ID
    {
        let mut guard = app_state.conversation_id.lock();
        *guard = Some(conversation_id);
    }

    chat::get_messages_for_conversation(db, conversation_id).await
}

#[tauri::command]
pub async fn cancel_message(
    cancellation_state: State<'_, CancellationState>,
) -> Result<(), ErrorResponse> {
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
) -> Result<Message, ErrorResponse> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    // Parse message ID first
    let id = message_id.parse::<i64>().map_err(|_| ErrorResponse {
        message: "Invalid message ID".to_string(),
        details: None,
    })?;

    let mut tx = db.begin().await.map_err(chat::db_error)?;

    // Get current message to preserve metadata
    let current = sqlx::query_as!(
        DbMessage,
        r#"
        SELECT 
            id as "id!",
            conversation_id as "conversation_id!",
            role as "role!",
            content as "content!",
            created_at as "created_at!",
            metadata,
            original_message_id
        FROM messages 
        WHERE id = ?
        "#,
        id
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(chat::db_error)?;

    // Save edited message
    let edited = chat::save_message(
        &mut tx,
        current.conversation_id,
        &current.role,
        &new_content,
        None,
        Some(current.id),
    )
    .await?;

    tx.commit().await.map_err(chat::db_error)?;

    Ok(edited)
}

#[tauri::command]
pub async fn delete_conversation(
    conversation_id: i64,
    app_handle: AppHandle,
) -> Result<(), ErrorResponse> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    chat::delete_conversation(db, conversation_id).await?;

    // If this was the current conversation, clear it
    {
        let mut guard = app_state.conversation_id.lock();
        if guard.map_or(false, |id| id == conversation_id) {
            *guard = None;
        }
    }

    Ok(())
}
