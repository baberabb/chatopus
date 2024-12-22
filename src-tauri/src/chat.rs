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
use serde_json::json;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State, Window};
use tokio::sync::broadcast;

#[derive(Debug, Serialize, Deserialize)]
pub struct Response {
    reply: String,
}

pub struct ChatHistory(pub Arc<parking_lot::Mutex<Vec<Message>>>);

#[derive(Clone)]
pub struct CancellationState(pub Arc<parking_lot::Mutex<Option<broadcast::Sender<()>>>>);

impl Default for CancellationState {
    fn default() -> Self {
        Self(Arc::new(parking_lot::Mutex::new(None)))
    }
}

#[tauri::command]
pub async fn process_message(
    message: String,
    app_handle: AppHandle,
    chat_history: State<'_, ChatHistory>,
    config_state: State<'_, ConfigState>,
    cancellation_state: State<'_, CancellationState>,
    window: Window,
) -> Result<Response, ErrorResponse> {
    println!("Received message: {}", message);

    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    // Get or create conversation only once
    let conversation_id = chat::get_or_create_conversation_cached(&app_state).await?;

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
                api_version: provider_settings.api_version.clone(),
                base_url: provider_settings.base_url.clone(),
                timeout_seconds: provider_settings.timeout_seconds,
                retry_attempts: provider_settings.retry_attempts,
                additional_headers: provider_settings.additional_headers.clone(),
                additional_params: provider_settings.additional_params.clone(),
            },
            provider_settings.streaming,
        )
    };

    // Short transaction for user message
    {
        let mut tx = db.begin().await.map_err(chat::db_error)?;
        let user_message = chat::save_message(
            &mut tx,
            conversation_id,
            "user",
            &message,
            None,
            None, // No original message ID for new messages
        )
        .await?;
        tx.commit().await.map_err(chat::db_error)?;

        {
            let mut history = chat_history.0.lock();
            history.push(user_message);
        }
    }

    // Call provider outside a transaction to avoid holding DB locks
    let provider = match ProviderFactory::create_provider(&provider_type, provider_config.clone()) {
        Ok(p) => p,
        Err(e) => {
            return Err(ErrorResponse {
                message: "Provider initialization failed".to_string(),
                details: Some(e.to_string()),
            });
        }
    };

    let history_snapshot = {
        // Lock once for reading
        let history = chat_history.0.lock();
        history.clone()
    };

    // Create new cancellation channel
    let (cancel_tx, cancel_rx) = broadcast::channel(1);
    {
        let mut cancel_state = cancellation_state.0.lock();
        *cancel_state = Some(cancel_tx);
    }

    let full_response = if provider.supports_streaming() && streaming_enabled {
        let window = window.clone();
        let callback = Box::new(move |response: StreamResponse| {
            if !response.text.is_empty() {
                let _ = window.emit("stream-response", &response.text);
            }
        }) as Box<dyn Fn(StreamResponse) + Send + Sync + 'static>;

        match provider
            .send_message(
                history_snapshot,
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
                return Err(ErrorResponse {
                    message: "API request failed".to_string(),
                    details: Some(e.to_string()),
                });
            }
        }
    } else {
        match provider
            .send_message(
                history_snapshot,
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
                return Err(ErrorResponse {
                    message: "API request failed".to_string(),
                    details: Some(e.to_string()),
                });
            }
        }
    };

    // Short transaction for assistant message
    {
        let mut tx = db.begin().await.map_err(chat::db_error)?;
        let assistant_message = chat::save_message(
            &mut tx,
            conversation_id,
            "assistant",
            &full_response,
            Some(&provider_config.model),
            None, // No original message ID for new messages
        )
        .await?;
        tx.commit().await.map_err(chat::db_error)?;

        {
            let mut history = chat_history.0.lock();
            history.push(assistant_message);
        }
    }

    // Clear cancellation channel
    {
        let mut cancel_state = cancellation_state.0.lock();
        *cancel_state = None;
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
    let conversation_id = chat::get_or_create_conversation_cached(&app_state).await?;

    // Check in-memory first
    {
        let history = chat_history.0.lock();
        if !history.is_empty() {
            return Ok(history.clone());
        }
    }

    // If empty, load from DB
    let messages = chat::get_messages_for_conversation(db, conversation_id).await?;

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

    let new_id = chat::create_conversation(db).await?;

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

    chat::get_all_conversations(db).await
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
    let messages = chat::get_messages_for_conversation(db, conversation_id).await?;

    // Update in-memory history
    {
        let mut history = chat_history.0.lock();
        *history = messages.clone();
    }

    Ok(messages)
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
) -> Result<(), ErrorResponse> {
    println!(
        "Edit message request - ID: {}, New content: {}",
        message_id, new_content
    );

    // Dummy implementation - you can implement the actual database update logic
    Ok(())
}

#[tauri::command]
pub async fn delete_conversation(
    conversation_id: i64,
    app_handle: AppHandle,
    chat_history: State<'_, ChatHistory>,
) -> Result<(), ErrorResponse> {
    let app_state = app_handle.state::<AppState>();
    let db = &app_state.db;

    chat::delete_conversation(db, conversation_id).await?;

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
