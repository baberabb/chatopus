use crate::apimodels::{
    Message, MessageReactions, ProviderConfig, ProviderFactory, StreamResponse,
};
use crate::config::ConfigState;
use chrono;
use parking_lot;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{Emitter, State};
use ulid::Ulid;

#[derive(Serialize, Deserialize)]
pub struct Response {
    reply: String,
}

#[derive(Serialize, Deserialize)]
pub struct ErrorResponse {
    message: String,
    details: Option<String>,
}

pub struct ChatHistory(pub Arc<parking_lot::Mutex<Vec<Message>>>);

#[tauri::command]
pub async fn process_message(
    message: String,
    chat_history: State<'_, ChatHistory>,
    config_state: State<'_, ConfigState>,
    window: tauri::Window,
) -> Result<Response, ErrorResponse> {
    println!("Received message: {}", message);

    let history = {
        let mut history = chat_history.0.lock();
        // Create a new user message with the same format as frontend messages
        let user_message = Message {
            id: Ulid::new().to_string(),
            role: "user".to_string(),
            content: message.clone(),
            timestamp: chrono::Local::now().format("%I:%M %p").to_string(),
            reactions: Some(MessageReactions { thumbs_up: 0 }),
        };
        history.push(user_message.clone());
        history.clone()
    };

    // Get current provider config and clone necessary values
    let (provider_type, provider_config, streaming_enabled) = {
        let config = config_state.0.lock();
        let provider_settings = config
            .providers
            .get(&config.active_provider)
            .ok_or_else(|| ErrorResponse {
                message: "Provider configuration error".to_string(),
                details: Some("No provider configured".to_string()),
            })?;

        println!(
            "DEBUG: Streaming enabled in config: {}",
            provider_settings.streaming
        );

        (
            config.active_provider.clone(),
            ProviderConfig {
                api_key: provider_settings.api_key.clone(),
                model: provider_settings.model.clone(),
                max_tokens: provider_settings.max_tokens,
            },
            provider_settings.streaming,
        )
    }; // Lock is dropped here

    // Create provider using active provider from config
    let provider =
        ProviderFactory::create_provider(&provider_type, provider_config).map_err(|e| {
            ErrorResponse {
                message: "Provider initialization failed".to_string(),
                details: Some(e),
            }
        })?;

    println!(
        "DEBUG: Provider supports streaming: {}",
        provider.supports_streaming()
    );

    let full_response = if provider.supports_streaming() && streaming_enabled {
        println!("DEBUG: Using streaming mode");
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

        // Send message with streaming
        provider
            .send_message(history, Some(callback))
            .await
            .map_err(|e| {
                println!("DEBUG: Streaming error: {}", e);
                ErrorResponse {
                    message: "API request failed".to_string(),
                    details: Some(e),
                }
            })?
    } else {
        println!("DEBUG: Using non-streaming mode");
        // Send message without streaming
        let response = provider.send_message(history, None).await.map_err(|e| {
            println!("DEBUG: Non-streaming error: {}", e);
            ErrorResponse {
                message: "API request failed".to_string(),
                details: Some(e),
            }
        })?;
        println!("DEBUG: Non-streaming response received: {}", response);
        response
    };

    println!("DEBUG: Final response: {}", full_response);

    // Create assistant message with the same format as frontend messages
    let assistant_message = Message {
        id: Ulid::new().to_string(),
        role: "assistant".to_string(),
        content: full_response.clone(),
        timestamp: chrono::Local::now().format("%I:%M %p").to_string(),
        reactions: Some(MessageReactions { thumbs_up: 0 }),
    };

    // Update chat history with the assistant's response
    chat_history.0.lock().push(assistant_message);

    Ok(Response {
        reply: full_response,
    })
}

#[tauri::command]
pub async fn get_chat_history(
    chat_history: State<'_, ChatHistory>,
) -> Result<Vec<Message>, ErrorResponse> {
    Ok(chat_history.0.lock().clone())
}

#[tauri::command]
pub async fn clear_chat_history(chat_history: State<'_, ChatHistory>) -> Result<(), ErrorResponse> {
    chat_history.0.lock().clear();
    Ok(())
}
