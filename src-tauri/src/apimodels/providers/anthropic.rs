use async_trait::async_trait;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

use crate::apimodels::core::{
    error::{handlers::retry_with_backoff, Error},
    provider::{Provider, ProviderBuilder, ProviderCapabilities, ProviderOptions, TextCallback},
    types::{ChatResponse, Message},
};

const DEFAULT_API_VERSION: &str = "2023-06-01";
const API_ENDPOINT: &str = "https://api.anthropic.com/v1/messages";

use crate::apimodels::core::types::ContentBlock as CoreContentBlock;

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    text: Option<String>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Serialize, Debug)]
struct AnthropicRequest {
    model: String,
    messages: Vec<AnthropicMessage>,
    max_tokens: u32,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_k: Option<i32>,
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
    content: Vec<AnthropicContentBlock>,
}

pub struct AnthropicProvider {
    name: String,
    api_key: String,
    api_version: String,
    base_url: String,
    timeout_seconds: u64,
    retry_attempts: u32,
    parameters: std::collections::HashMap<String, serde_json::Value>,
    capabilities: ProviderCapabilities,
    client: reqwest::Client,
}

impl AnthropicProvider {
    pub fn new(builder: ProviderBuilder) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(
                builder.timeout_seconds.unwrap_or(120),
            ))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self {
            name: builder.name,
            api_key: builder.api_key,
            api_version: builder
                .api_version
                .unwrap_or_else(|| DEFAULT_API_VERSION.to_string()),
            base_url: builder.base_url.unwrap_or_else(|| API_ENDPOINT.to_string()),
            timeout_seconds: builder.timeout_seconds.unwrap_or(120),
            retry_attempts: builder.retry_attempts.unwrap_or(3),
            parameters: builder.parameters,
            client,
            capabilities: ProviderCapabilities {
                supports_streaming: true,
                supports_function_calls: false,
                supports_vision: false,
                max_context_length: 100000,
                supported_parameters: vec![
                    "temperature".to_string(),
                    "top_p".to_string(),
                    "top_k".to_string(),
                ],
            },
        }
    }

    fn convert_messages(messages: Vec<Message>) -> Vec<AnthropicMessage> {
        messages
            .into_iter()
            .map(|msg| {
                // Convert content blocks to text
                let text = msg
                    .content
                    .into_iter()
                    .filter_map(|block| block.text)
                    .collect::<Vec<_>>()
                    .join(" ");

                AnthropicMessage {
                    role: msg.role,
                    content: text,
                }
            })
            .collect()
    }

    fn create_request(
        &self,
        messages: Vec<Message>,
        options: &ProviderOptions,
    ) -> AnthropicRequest {
        let params = options.parameters.clone().unwrap_or_default();
        AnthropicRequest {
            model: options
                .model
                .clone()
                .unwrap_or_else(|| "claude-3-sonnet-20240229".to_string()),
            messages: Self::convert_messages(messages),
            max_tokens: options.max_tokens.unwrap_or(1024),
            stream: options.stream,
            temperature: options.temperature,
            top_p: options.top_p,
            top_k: params
                .get("top_k")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32),
        }
    }

    async fn make_request(&self, request: &AnthropicRequest) -> Result<reqwest::Response, Error> {
        retry_with_backoff(self.retry_attempts, || async {
            let response = self
                .client
                .post(&self.base_url)
                .header("Content-Type", "application/json")
                .header("X-API-Key", &self.api_key)
                .header("anthropic-version", &self.api_version)
                .json(request)
                .send()
                .await?;

            if !response.status().is_success() {
                let status = response.status();
                let error_text = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Failed to read error response".to_string());

                return Err(match status.as_u16() {
                    429 => Error::RateLimit(error_text),
                    401 | 403 => Error::Authentication(error_text),
                    400 => Error::InvalidRequest(error_text),
                    500..=599 => Error::ServerError(error_text),
                    _ => Error::ResponseError {
                        status: status.as_u16(),
                        message: error_text,
                    },
                });
            }

            Ok(response)
        })
        .await
    }
}

#[async_trait]
impl Provider for AnthropicProvider {
    fn capabilities(&self) -> &ProviderCapabilities {
        &self.capabilities
    }

    async fn send_message(
        &self,
        messages: Vec<Message>,
        options: ProviderOptions,
    ) -> Result<ChatResponse, Error> {
        let model = options.model.clone();
        let request = self.create_request(messages, &options);

        let response = self.make_request(&request).await?;
        let response_data: NonStreamingResponse = response.json().await?;

        let content = response_data
            .content
            .into_iter()
            .map(|block| CoreContentBlock {
                r#type: block.block_type,
                text: block.text,
                image_url: None,
            })
            .collect();

        Ok(ChatResponse {
            content,
            model,
            usage: None,
            metadata: None,
        })
    }

    async fn send_message_streaming(
        &self,
        messages: Vec<Message>,
        options: ProviderOptions,
        on_text: TextCallback,
        mut cancel_token: broadcast::Receiver<()>,
    ) -> Result<(), Error> {
        let request = self.create_request(messages, &options);
        let response = self.make_request(&request).await?;
        let mut stream = response.bytes_stream();

        loop {
            tokio::select! {
                chunk_result = stream.next() => {
                    match chunk_result {
                        Some(Ok(chunk)) => {
                            let chunk_str = String::from_utf8_lossy(&chunk);
                            for line in chunk_str.lines() {
                                if line.is_empty() { continue; }

                                if let Some(data) = line.strip_prefix("data: ") {
                                    if data == "[DONE]" {
                                        return Ok(());
                                    }

                                    match serde_json::from_str::<EventData>(data) {
                                        Ok(event_data) => {
                                            if let Some(text) = event_data.delta.and_then(|d| d.text) {
                                                on_text(text)?;
                                            }
                                        }
                                        Err(e) => {
                                            return Err(Error::ParseError(e.to_string()));
                                        }
                                    }
                                }
                            }
                        }
                        Some(Err(e)) => {
                            return Err(Error::StreamError(e.to_string()));
                        }
                        None => {
                            return Ok(());
                        }
                    }
                }
                _ = cancel_token.recv() => {
                    on_text("\n[Cancelled]".into())?;
                    return Ok(());
                }
            }
        }
    }
}
