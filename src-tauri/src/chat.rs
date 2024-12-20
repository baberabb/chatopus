use crate::apimodels::{Message, ProviderConfig, ProviderFactory, StreamResponse};
use crate::config::ConfigState;
use crate::database::chat::{self, ConversationInfo, ConversationRow, DbMessage, ErrorResponse};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State, Window};

#[derive(Debug, Serialize, Deserialize)]
pub struct Response {
    reply: String,
}

pub struct ChatHistory(pub Arc<parking_lot::Mutex<Vec<Message>>>);

#[tauri::command]
pub async fn process_message(
    message: String,
    app_handle: AppHandle,
    chat_history: State<'_, ChatHistory>,
    config_state: State<'_, ConfigState>,
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
            },
            provider_settings.streaming,
        )
    };

    // Short transaction for user message
    {
        let mut tx = db.begin().await.map_err(chat::db_error)?;
        let user_message =
            chat::save_message(&mut tx, conversation_id, "user", &message, None).await?;
        tx.commit().await.map_err(chat::db_error)?;

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
        let window = window.clone();
        let callback = Box::new(move |response: StreamResponse| {
            if !response.text.is_empty() {
                let _ = window.emit("stream-response", &response.text);
            }
        }) as Box<dyn Fn(StreamResponse) + Send + Sync + 'static>;

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
        let mut tx = db.begin().await.map_err(chat::db_error)?;
        let assistant_message = chat::save_message(
            &mut tx,
            conversation_id,
            "assistant",
            &full_response,
            Some(&provider_config.model),
        )
        .await?;
        tx.commit().await.map_err(chat::db_error)?;

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
    let conversation_id = chat::get_or_create_conversation_cached(&app_state).await?;

    // Check in-memory first
    {
        let history = chat_history.0.lock();
        if !history.is_empty() {
            return Ok(history.clone());
        }
    }

    // If empty, load from DB
    let messages = chat::get_messages_for_conversation_cached(db, conversation_id).await?;

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
