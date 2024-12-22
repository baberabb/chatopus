use async_trait::async_trait;
use futures_util::{FutureExt, StreamExt};
use reqwest::header::HeaderMap;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

use super::config::{ProviderConfig, RequestConfig};
use super::error::{ProviderError, ProviderResult};
use super::provider::{BaseProvider, ChatProvider};
use super::types::{ChatRequest, ChatResponse, Message, StreamCallback, StreamResponse};

const DEFAULT_API_VERSION: &str = "2023-06-01";
const INITIAL_BUFFER_SIZE: usize = 1024;

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
        let mut anthropic_messages = Vec::with_capacity(INITIAL_BUFFER_SIZE);
        for msg in messages {
            anthropic_messages.push(AnthropicMessage {
                role: msg.role,
                content: msg.content,
            });
        }
        anthropic_messages
    }

    fn create_headers(config: &ProviderConfig) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert("Content-Type", "application/json".parse().unwrap());
        headers.insert("X-API-Key", config.api_key.parse().unwrap());
        headers.insert(
            "anthropic-version",
            config
                .api_version
                .as_deref()
                .unwrap_or(DEFAULT_API_VERSION)
                .parse()
                .unwrap(),
        );
        headers
    }

    fn handle_cancellation(
        callback: &StreamCallback,
        full_response: &str,
    ) -> Option<Result<bytes::Bytes, reqwest::Error>> {
        callback(StreamResponse {
            text: format!("{}\n[Cancelled]", full_response),
            is_done: true,
        });
        None
    }

    fn process_buffer(
        buffer: &mut String,
        full_response: &mut String,
        callback: &StreamCallback,
    ) -> ProviderResult<Option<String>> {
        while let Some(end_index) = buffer.find('\n') {
            let line = buffer[..end_index].trim().to_string();
            eprintln!("ANTHROPIC RAW LINE: {}", &line);

            if let Some(data) = line.strip_prefix("data: ") {
                eprintln!("ANTHROPIC EVENT DATA: {}", &data);
                if data == "[DONE]" {
                    callback(StreamResponse {
                        text: String::new(),
                        is_done: true,
                    });
                    buffer.drain(..=end_index);
                    return Ok(Some(full_response.clone()));
                }

                if let Ok(event_data) = serde_json::from_str::<EventData>(data) {
                    if let Some(text) = event_data.delta.and_then(|d| d.text) {
                        full_response.push_str(&text);
                        callback(StreamResponse {
                            text,
                            is_done: false,
                        });
                    }

                    if event_data.event_type == "content_block_stop" {
                        callback(StreamResponse {
                            text: String::new(),
                            is_done: true,
                        });
                        buffer.drain(..=end_index);
                        return Ok(Some(full_response.clone()));
                    }
                }
            }
            buffer.drain(..=end_index);
        }
        Ok(None)
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
        let anthropic_request = AnthropicRequest {
            model: request.model.clone(),
            messages: Self::convert_messages(request.messages),
            max_tokens: request.max_tokens,
            stream: true,
        };

        // Pre-allocate strings with reasonable capacity
        let mut full_response = String::with_capacity(4096);
        let mut buffer = String::with_capacity(1024);

        // Create the request once and reuse headers
        let response = self
            .base
            .client
            .post("https://api.anthropic.com/v1/messages")
            .headers(Self::create_headers(&self.base.config))
            .json(&anthropic_request)
            .send()
            .await
            .map_err(|e| ProviderError::RequestError(e.to_string()))?;

        let response = BaseProvider::handle_response_error(response).await?;
        let mut stream = response.bytes_stream();

        while let Some(item) = futures_util::select! {
            item = stream.next().fuse() => item,
            _ = cancel_token.recv().fuse() => {
                Self::handle_cancellation(&callback, &full_response)
            }
        } {
            let chunk = item.map_err(|e| ProviderError::RequestError(e.to_string()))?;
            let chunk_str = String::from_utf8_lossy(&chunk);
            eprintln!("ANTHROPIC RAW CHUNK: {}", &chunk_str);
            buffer.push_str(&chunk_str);

            if let Some(remainder) =
                Self::process_buffer(&mut buffer, &mut full_response, &callback)?
            {
                return Ok(remainder);
            }
        }

        Ok(full_response)
    }

    async fn send_message_blocking(&self, request: ChatRequest) -> ProviderResult<ChatResponse> {
        let anthropic_request = AnthropicRequest {
            model: request.model.clone(),
            messages: Self::convert_messages(request.messages),
            max_tokens: request.max_tokens,
            stream: false,
        };

        let response = self
            .base
            .client
            .post("https://api.anthropic.com/v1/messages")
            .headers(Self::create_headers(&self.base.config))
            .json(&anthropic_request)
            .send()
            .await
            .map_err(|e| ProviderError::RequestError(e.to_string()))?;

        let response = BaseProvider::handle_response_error(response).await?;

        let response_data = response
            .json::<NonStreamingResponse>()
            .await
            .map_err(|e| ProviderError::ParseError(e.to_string()))?;

        let mut content = String::with_capacity(
            response_data
                .content
                .iter()
                .map(|block| block.text.len())
                .sum(),
        );
        for block in response_data.content {
            content.push_str(&block.text);
        }

        Ok(ChatResponse {
            content,
            model: Some(request.model),
            usage: None, // Anthropic doesn't provide token usage info in this format
        })
    }
}
