use crate::apimodels::{Message, ProviderConfig, ProviderFactory, StreamResponse};
use parking_lot;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{Emitter, State};

#[derive(Serialize, Deserialize)]
pub struct Response {
    reply: String,
}

pub struct ChatHistory(pub Arc<parking_lot::Mutex<Vec<Message>>>);

#[tauri::command]
pub async fn process_message(
    message: String,
    chat_history: State<'_, ChatHistory>,
    window: tauri::Window,
    app_handle: tauri::AppHandle,
) -> Result<Response, String> {
    println!("Received message: {}", message);

    let history = {
        let mut history = chat_history.0.lock();
        history.push(Message {
            role: "user".to_string(),
            content: message.clone(),
        });
        history.clone()
    };

    // Create provider config (this could come from settings)
    let config = ProviderConfig {
        api_key: "".to_string(), // Get from secure storage
        model: "claude-3-5-sonnet-20240620".to_string(),
        max_tokens: 1024,
    };

    // Create provider (could be configurable)
    let provider = ProviderFactory::create_provider("anthropic", config)?;

    // Create callback for streaming responses
    let window_clone = window.clone();
    let callback = Box::new(move |response: StreamResponse| {
        if !response.text.is_empty() {
            window_clone
                .emit("stream-response", &response.text)
                .expect("Failed to emit event");
        }
    });

    // Send message and get response
    let full_response = provider.send_message(history, callback).await?;

    // Update chat history
    chat_history.0.lock().push(Message {
        role: "assistant".to_string(),
        content: full_response.clone(),
    });

    Ok(Response {
        reply: full_response,
    })
}

#[tauri::command]
pub async fn get_chat_history(
    chat_history: State<'_, ChatHistory>,
) -> Result<Vec<Message>, String> {
    Ok(chat_history.0.lock().clone())
}

#[tauri::command]
pub async fn clear_chat_history(chat_history: State<'_, ChatHistory>) -> Result<(), String> {
    chat_history.0.lock().clear();
    Ok(())
}
