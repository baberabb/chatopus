use crate::apimodels::{Message, ProviderConfig, ProviderFactory, StreamResponse};
use crate::config::ConfigState;
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
    config_state: State<'_, ConfigState>,
    window: tauri::Window,
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

    // Get current provider config and clone necessary values
    let (provider_type, provider_config) = {
        let config = config_state.0.lock();
        let provider_settings = config
            .providers
            .get(&config.active_provider)
            .ok_or_else(|| "No provider configured".to_string())?;

        (
            config.active_provider.clone(),
            ProviderConfig {
                api_key: provider_settings.api_key.clone(),
                model: provider_settings.model.clone(),
                max_tokens: provider_settings.max_tokens,
            },
        )
    }; // Lock is dropped here

    // Create provider using active provider from config
    let provider = ProviderFactory::create_provider(&provider_type, provider_config)?;

    // Create callback for streaming responses
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
