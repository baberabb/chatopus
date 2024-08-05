use crate::apimodels::anthropic::{AnthropicRequest, SentMessage};
use futures_util::StreamExt;
use parking_lot;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{Emitter, State};

#[derive(Serialize, Deserialize)]
pub struct Response {
    reply: String,
}

#[derive(Deserialize, Debug)]
pub struct EventData {
    #[serde(rename = "type")]
    event_type: String,
    delta: Option<Delta>,
}

#[derive(Deserialize, Debug)]
pub struct Delta {
    text: Option<String>,
}

pub struct ChatHistory(pub Arc<parking_lot::Mutex<Vec<SentMessage>>>);

#[tauri::command]
pub async fn process_message(
    message: String,
    chat_history: State<'_, ChatHistory>,
    window: tauri::Window,
    app_handle: tauri::AppHandle,
) -> Result<Response, String> {
    println!("Received message: {}", message);
    // app_handle.app_handle();
    let history = {
        let mut history = chat_history.0.lock();
        history.push(SentMessage {
            role: "user".to_string(),
            content: message.clone(),
        });
        history.clone()
        // history.clone()
    }; // The lock is dropped here

    let client = Client::new();
    let anthropic_api_key = "".to_string();
    let request_body = AnthropicRequest {
        model: "claude-3-5-sonnet-20240620".to_string(),
        messages: history,
        max_tokens: 1024,
        // system: "You are a helpful assistant with expertise in UI design".to_string(),
        stream: true,
    };

    let mut stream = client
        .post("https://api.anthropic.com/v1/messages")
        .header("Content-Type", "application/json")
        .header("X-API-Key", anthropic_api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?
        .bytes_stream();

    let mut full_response = String::new();
    let mut buffer = String::new();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("Error reading chunk: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        loop {
            match buffer.find('\n') {
                Some(end_index) => {
                    let line = buffer[..end_index].trim().to_string();
                    buffer = buffer[end_index + 1..].to_string();

                    if line.starts_with("data: ") {
                        let data = &line["data: ".len()..];
                        if data == "[DONE]" {
                            println!("Received [DONE] signal");
                            break;
                        }

                        if let Ok(event_data) = serde_json::from_str::<EventData>(data) {
                            if let Some(delta) = event_data.delta {
                                if let Some(text) = delta.text {
                                    full_response.push_str(&text);
                                    window
                                        .emit("stream-response", &text)
                                        .map_err(|e| format!("Failed to emit event: {}", e))?;

                                    println!("Emitted text: {}", text);
                                }
                            }
                        } else {
                            println!("Failed to parse event data: {}", data);
                        }
                    }
                }
                None => break,
            }
        }
    }

    println!("Full response: {}", full_response);

    // Update the history after processing
    chat_history.0.lock().push(SentMessage {
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
) -> Result<Vec<SentMessage>, String> {
    Ok(chat_history.0.lock().clone())
}

#[tauri::command]
pub async fn clear_chat_history(chat_history: State<'_, ChatHistory>) -> Result<(), String> {
    chat_history.0.lock().clear();
    Ok(())
}
