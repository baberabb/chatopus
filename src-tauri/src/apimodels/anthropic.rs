use async_trait::async_trait;
use futures_util::{FutureExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

use super::config::{ProviderConfig, RequestConfig};
use super::error::{ProviderError, ProviderResult};
use super::provider::{BaseProvider, ChatProvider};
use super::types::{ChatRequest, ChatResponse, Message, StreamCallback, StreamResponse};

pub struct AnthropicProvider {
    base: BaseProvider,
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

impl AnthropicProvider {
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            base: BaseProvider::new(config),
        }
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

    async fn prepare_request(&self, messages: Vec<Message>, config: &RequestConfig) -> ChatRequest {
        ChatRequest {
            messages: messages.clone(),
            model: self.base.config.model.clone(),
            max_tokens: self.base.config.max_tokens,
            stream: config.streaming,
            additional_params: self.base.config.additional_params.clone(),
        }
    }

    async fn send_message_streaming(
        &self,
        request: ChatRequest,
        callback: StreamCallback,
        mut cancel_token: broadcast::Receiver<()>,
    ) -> ProviderResult<String> {
        let model = request.model.clone();
        let anthropic_request = AnthropicRequest {
            model,
            messages: Self::convert_messages(request.messages),
            max_tokens: request.max_tokens,
            stream: true,
        };

        let response = self
            .base
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("Content-Type", "application/json")
            .header("X-API-Key", &self.base.config.api_key)
            .header(
                "anthropic-version",
                self.base
                    .config
                    .api_version
                    .as_deref()
                    .unwrap_or("2023-06-01"),
            )
            .json(&anthropic_request)
            .send()
            .await
            .map_err(|e| ProviderError::RequestError(e.to_string()))?;

        let response = BaseProvider::handle_response_error(response).await?;
        let mut stream = response.bytes_stream();
        let mut full_response = String::new();
        let mut buffer = String::new();

        while let Some(item) = futures_util::select! {
            item = stream.next().fuse() => item,
            _ = cancel_token.recv().fuse() => {
                callback(StreamResponse {
                    text: "\n[Cancelled]".to_string(),
                    is_done: true,
                });
                return Ok(format!("{}\n[Cancelled]", full_response));
            }
        } {
            let chunk = item.map_err(|e| ProviderError::RequestError(e.to_string()))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(end_index) = buffer.find('\n') {
                let line = buffer[..end_index].trim().to_string();
                buffer = buffer[end_index + 1..].to_string();

                if line.starts_with("data: ") {
                    let data = line.strip_prefix("data: ").unwrap();

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

        Ok(full_response)
    }

    async fn send_message_blocking(&self, request: ChatRequest) -> ProviderResult<ChatResponse> {
        let model = request.model.clone();
        let anthropic_request = AnthropicRequest {
            model,
            messages: Self::convert_messages(request.messages),
            max_tokens: request.max_tokens,
            stream: false,
        };

        let response = self
            .base
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("Content-Type", "application/json")
            .header("X-API-Key", &self.base.config.api_key)
            .header(
                "anthropic-version",
                self.base
                    .config
                    .api_version
                    .as_deref()
                    .unwrap_or("2023-06-01"),
            )
            .json(&anthropic_request)
            .send()
            .await
            .map_err(|e| ProviderError::RequestError(e.to_string()))?;

        let response = BaseProvider::handle_response_error(response).await?;

        let response_data = response
            .json::<NonStreamingResponse>()
            .await
            .map_err(|e| ProviderError::ParseError(e.to_string()))?;

        let content = response_data
            .content
            .into_iter()
            .map(|block| block.text)
            .collect::<Vec<_>>()
            .join("");

        let model = request.model.clone();
        Ok(ChatResponse {
            content,
            model: Some(model),
            usage: None, // Anthropic doesn't provide token usage info in this format
        })
    }
}
