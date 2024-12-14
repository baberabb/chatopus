use super::provider::{ChatProvider, Message, ProviderConfig, StreamCallback, StreamResponse};
use async_trait::async_trait;
use futures_util::StreamExt;
use reqwest::{Client, ClientBuilder};
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub struct AnthropicProvider {
    api_key: String,
    model: String,
    max_tokens: u32,
    client: Client,
}

#[derive(Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct AnthropicRequest {
    model: String,
    messages: Vec<AnthropicMessage>,
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

#[derive(Deserialize, Debug)]
struct NonStreamingResponse {
    content: Vec<ContentBlock>,
}

#[derive(Deserialize, Debug)]
struct ContentBlock {
    text: String,
}

#[derive(Deserialize, Debug)]
struct ErrorResponse {
    error: AnthropicError,
}

#[derive(Deserialize, Debug)]
struct AnthropicError {
    message: String,
    #[serde(rename = "type")]
    error_type: String,
}

impl AnthropicProvider {
    pub fn new(config: ProviderConfig) -> Self {
        // Configure client with timeouts and other settings
        let client = ClientBuilder::new()
            .timeout(Duration::from_secs(120)) // 2 minute timeout
            .connect_timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            api_key: config.api_key,
            model: config.model,
            max_tokens: config.max_tokens,
            client,
        }
    }

    async fn handle_response_error(
        response: reqwest::Response,
    ) -> Result<reqwest::Response, String> {
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Failed to read error response".to_string());

            // Try to parse as ErrorResponse
            if let Ok(error_response) = serde_json::from_str::<ErrorResponse>(&error_text) {
                return Err(format!(
                    "API error ({}): {} - {}",
                    status, error_response.error.error_type, error_response.error.message
                ));
            }

            return Err(format!("Request failed ({}): {}", status, error_text));
        }
        Ok(response)
    }

    fn convert_messages(messages: Vec<Message>) -> Vec<AnthropicMessage> {
        messages
            .into_iter()
            .map(|msg| AnthropicMessage {
                role: msg.role,
                content: msg.content,
            })
            .collect()
    }
}

#[async_trait]
impl ChatProvider for AnthropicProvider {
    fn supports_streaming(&self) -> bool {
        true
    }

    async fn send_message_streaming(
        &self,
        messages: Vec<Message>,
        callback: StreamCallback,
    ) -> Result<String, String> {
        let request_body = AnthropicRequest {
            model: self.model.clone(),
            messages: Self::convert_messages(messages),
            max_tokens: self.max_tokens,
            stream: true,
        };

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("Content-Type", "application/json")
            .header("X-API-Key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        let response = Self::handle_response_error(response).await?;
        let mut stream = response.bytes_stream();

        let mut full_response = String::new();
        let mut buffer = String::new();

        while let Some(item) = stream.next().await {
            let chunk = item.map_err(|e| format!("Error reading chunk: {}", e))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            // Process complete lines in buffer
            while let Some(end_index) = buffer.find('\n') {
                let line = buffer[..end_index].trim().to_string();
                buffer = buffer[end_index + 1..].to_string();

                if line.starts_with("data: ") {
                    let data = line.strip_prefix("data: ").unwrap();

                    // Handle [DONE] message
                    if data == "[DONE]" {
                        callback(StreamResponse {
                            text: String::new(),
                            is_done: true,
                        });
                        return Ok(full_response);
                    }

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
                            return Ok(full_response);
                        }
                    }
                }
            }
        }

        // Process any remaining data in buffer
        if !buffer.is_empty() {
            if let Ok(event_data) = serde_json::from_str::<EventData>(&buffer) {
                if let Some(delta) = event_data.delta {
                    if let Some(text) = delta.text {
                        full_response.push_str(&text);
                    }
                }
            }
        }

        Ok(full_response)
    }

    async fn send_message_blocking(&self, messages: Vec<Message>) -> Result<String, String> {
        let request_body = AnthropicRequest {
            model: self.model.clone(),
            messages: Self::convert_messages(messages),
            max_tokens: self.max_tokens,
            stream: false,
        };

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("Content-Type", "application/json")
            .header("X-API-Key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        let response = Self::handle_response_error(response).await?;

        let response_data = response
            .json::<NonStreamingResponse>()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        let full_text = response_data
            .content
            .into_iter()
            .map(|block| block.text)
            .collect::<Vec<_>>()
            .join("");

        Ok(full_text)
    }
}
