use crate::apimodels::{
    Message, MessageReactions, ProviderConfig, ProviderFactory, StreamResponse,
};
use crate::config::ConfigState;
use chrono;
use futures_util::future::join_all;
use parking_lot;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{Emitter, State};
use ulid::Ulid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Response {
    reply: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    message: String,
    details: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelSelection {
    pub id: String,
    pub provider: String,
}

pub struct ChatHistory(pub Arc<parking_lot::Mutex<Vec<Message>>>);

#[tauri::command]
pub async fn process_message(
    message: String,
    selected_models: Vec<ModelSelection>,
    chat_history: State<'_, ChatHistory>,
    config_state: State<'_, ConfigState>,
    window: tauri::Window,
) -> Result<Response, ErrorResponse> {
    println!("Received message: {}", message);
    println!("Selected models: {:?}", selected_models);

    let history = {
        let mut history = chat_history.0.lock();
        // Create a new user message
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

    // Get provider configs for all selected models
    let provider_configs = {
        let config = config_state.0.lock();
        selected_models
            .iter()
            .filter_map(|model| {
                config
                    .providers
                    .get(&model.provider)
                    .map(|provider_settings| {
                        (
                            model.provider.clone(),
                            ProviderConfig {
                                api_key: provider_settings.api_key.clone(),
                                model: model.id.clone(),
                                max_tokens: provider_settings.max_tokens,
                            },
                            provider_settings.streaming,
                        )
                    })
            })
            .collect::<Vec<_>>()
    };

    if provider_configs.is_empty() {
        return Err(ErrorResponse {
            message: "No valid providers found".to_string(),
            details: Some("Selected models are not properly configured".to_string()),
        });
    }

    // Create providers and process message for each
    let mut provider_tasks = Vec::new();
    let window = Arc::new(parking_lot::Mutex::new(window));

    for (provider_type, config, streaming_enabled) in provider_configs {
        let provider =
            ProviderFactory::create_provider(&provider_type, config.clone()).map_err(|e| {
                ErrorResponse {
                    message: "Provider initialization failed".to_string(),
                    details: Some(e),
                }
            })?;

        let history = history.clone();
        let window = Arc::clone(&window);
        let model_name = config.model.clone();

        provider_tasks.push(async move {
            if provider.supports_streaming() && streaming_enabled {
                let callback = {
                    let window = Arc::clone(&window);
                    let model_name = model_name.clone();
                    Box::new(move |response: StreamResponse| {
                        if !response.text.is_empty() {
                            // Include model name in streamed response
                            let response_with_model =
                                format!("[{}]\n{}", model_name, response.text);
                            window
                                .lock()
                                .emit("stream-response", &response_with_model)
                                .expect("Failed to emit event");
                        }
                    }) as Box<dyn Fn(StreamResponse) + Send + Sync + 'static>
                };

                provider.send_message(history, Some(callback)).await
            } else {
                let response = provider.send_message(history, None).await?;
                // Include model name in non-streamed response
                Ok(format!("[{}]\n{}", model_name, response))
            }
        });
    }

    // Wait for all providers to complete
    let results = join_all(provider_tasks).await;
    let mut responses = Vec::new();
    let mut errors = Vec::new();

    for result in results {
        match result {
            Ok(response) => responses.push(response),
            Err(e) => errors.push(e),
        }
    }

    if responses.is_empty() {
        return Err(ErrorResponse {
            message: "All providers failed".to_string(),
            details: Some(errors.join("\n")),
        });
    }

    // Combine responses with a separator
    let full_response = responses.join("\n\n");

    // Create assistant message
    let assistant_message = Message {
        id: Ulid::new().to_string(),
        role: "assistant".to_string(),
        content: full_response.clone(),
        timestamp: chrono::Local::now().format("%I:%M %p").to_string(),
        reactions: Some(MessageReactions { thumbs_up: 0 }),
    };

    // Update chat history
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
