use super::provider::{ChatProvider, Message, ProviderConfig, StreamCallback, StreamResponse};
use async_trait::async_trait;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};

pub struct AnthropicProvider {
    api_key: String,
    model: String,
    max_tokens: u32,
}

#[derive(Serialize)]
struct AnthropicRequest {
    model: String,
    messages: Vec<Message>,
    max_tokens: u32,
    stream: bool,
}

#[derive(Deserialize, Debug)]
struct EventData {
    #[serde(rename = "type")]
    event_type: String,
    delta: Option<Delta>,
}

#[derive(Deserialize, Debug)]
struct Delta {
    text: Option<String>,
}

impl AnthropicProvider {
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            api_key: config.api_key,
            model: config.model,
            max_tokens: config.max_tokens,
        }
    }
}

#[async_trait]
impl ChatProvider for AnthropicProvider {
    async fn send_message(
        &self,
        messages: Vec<Message>,
        callback: StreamCallback,
    ) -> Result<String, String> {
        let client = Client::new();
        let request_body = AnthropicRequest {
            model: self.model.clone(),
            messages,
            max_tokens: self.max_tokens,
            stream: true,
        };

        let mut stream = client
            .post("https://api.anthropic.com/v1/messages")
            .header("Content-Type", "application/json")
            .header("X-API-Key", &self.api_key)
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

            while let Some(end_index) = buffer.find('\n') {
                let line = buffer[..end_index].trim().to_string();
                buffer = buffer[end_index + 1..].to_string();

                if line.starts_with("data: ") {
                    let data = line.strip_prefix("data: ").unwrap();

                    if let Ok(event_data) = serde_json::from_str::<EventData>(data) {
                        let is_done = event_data.event_type == "content_block_stop";

                        if let Some(delta) = event_data.delta {
                            if let Some(text) = delta.text {
                                full_response.push_str(&text);
                                callback(StreamResponse {
                                    text,
                                    is_done: false,
                                });
                            }
                        }

                        if is_done {
                            callback(StreamResponse {
                                text: String::new(),
                                is_done: true,
                            });
                            break;
                        }
                    }
                }
            }
        }

        Ok(full_response)
    }
}
