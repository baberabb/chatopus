use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::broadcast;

use crate::apimodels::{
    core::{
        error::{handlers::retry_with_backoff, Error},
        provider::{Provider, ProviderBuilder, ProviderCapabilities},
        request::RequestOptions,
        types::{ChatRequest, ChatResponse, Message},
    },
    ResponseHandler, StreamHandler,
};

const DEFAULT_API_VERSION: &str = "2023-06-01";
const API_ENDPOINT: &str = "https://api.anthropic.com/v1/messages";

#[derive(Debug)]
pub struct AnthropicProvider {
    name: String,
    api_key: String,
    api_version: String,
    base_url: String,
    timeout_seconds: u64,
    retry_attempts: u32,
    parameters: HashMap<String, serde_json::Value>,
    capabilities: ProviderCapabilities,
}

#[derive(Serialize, Debug)]
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
struct NonStreamingResponse {
    content: Vec<ContentBlock>,
}

#[derive(Deserialize, Debug)]
struct ContentBlock {
    text: String,
}

#[derive(Deserialize, Debug)]
struct AnthropicStreamResponse {
    delta: Option<StreamDelta>,
    #[serde(rename = "type")]
    response_type: String,
}

#[derive(Deserialize, Debug)]
struct StreamDelta {
    text: String,
}

impl AnthropicProvider {
    pub fn new(builder: ProviderBuilder) -> Self {
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
            .map(|msg| AnthropicMessage {
                role: msg.role,
                content: msg.content,
            })
            .collect()
    }

    fn create_request(
        &self,
        chat_request: ChatRequest,
        force_stream: Option<bool>,
    ) -> AnthropicRequest {
        let params = chat_request.parameters.unwrap_or_default();
        AnthropicRequest {
            model: chat_request.model,
            messages: Self::convert_messages(chat_request.messages),
            max_tokens: chat_request.max_tokens,
            stream: force_stream.unwrap_or(chat_request.stream),
            temperature: params
                .get("temperature")
                .and_then(|v| v.as_f64())
                .map(|v| v as f32),
            top_p: params
                .get("top_p")
                .and_then(|v| v.as_f64())
                .map(|v| v as f32),
            top_k: params
                .get("top_k")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32),
        }
    }

    async fn make_request(
        &self,
        request: &AnthropicRequest,
    ) -> std::result::Result<reqwest::Response, Error> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(self.timeout_seconds))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        retry_with_backoff(self.retry_attempts, || async {
            let response = client
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

    async fn process_stream(
        response: reqwest::Response,
        handler: &Box<dyn StreamHandler>,
    ) -> std::result::Result<String, Error> {
        use futures_util::StreamExt;
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| Error::StreamError(e.to_string()))?;
            let chunk_str = String::from_utf8_lossy(&chunk);

            for line in chunk_str.lines() {
                if line.is_empty() {
                    continue;
                }

                if let Some(data) = line.strip_prefix("data: ") {
                    if data == "[DONE]" {
                        handler.handle_done();
                        return Ok(buffer);
                    }

                    match serde_json::from_str::<AnthropicStreamResponse>(data) {
                        Ok(response) => {
                            if let Some(delta) = response.delta {
                                handler.handle_chunk(delta.text.clone()).await?;
                                buffer.push_str(&delta.text);
                            }
                        }
                        Err(e) => {
                            handler.handle_error(Error::ParseError(e.to_string()));
                        }
                    }
                }
            }
        }

        Ok(buffer)
    }
}

#[async_trait]
impl Provider for AnthropicProvider {
    fn capabilities(&self) -> &ProviderCapabilities {
        &self.capabilities
    }

    async fn prepare_request(
        &self,
        messages: Vec<Message>,
        options: &RequestOptions,
    ) -> std::result::Result<ChatRequest, Error> {
        // Start with provider parameters
        let mut params = self.parameters.clone();

        // Merge request parameters if any
        if let Some(request_params) = &options.parameters {
            params.extend(request_params.clone());
        }

        // Ensure required parameters have defaults
        if !params.contains_key("temperature") {
            params.insert("temperature".to_string(), serde_json::json!(0.7));
        }
        if !params.contains_key("max_tokens") {
            params.insert("max_tokens".to_string(), serde_json::json!(1024));
        }

        let max_tokens = params
            .get("max_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(1024) as u32;

        Ok(ChatRequest {
            messages,
            model: self.name.clone(),
            max_tokens,
            stream: options.streaming,
            parameters: Some(params),
        })
    }

    async fn send_message_streaming(
        &self,
        request: ChatRequest,
        handler: Box<dyn StreamHandler>,
        _cancel_token: broadcast::Receiver<()>,
    ) -> std::result::Result<String, Error> {
        let anthropic_request = self.create_request(request, Some(true));
        let response = self.make_request(&anthropic_request).await?;
        Self::process_stream(response, &handler).await
    }

    async fn send_message_blocking(
        &self,
        request: ChatRequest,
        handler: Box<dyn ResponseHandler>,
    ) -> std::result::Result<ChatResponse, Error> {
        let model = request.model.clone();
        let anthropic_request = self.create_request(request, Some(false));

        let response = self.make_request(&anthropic_request).await?;
        let response_data: NonStreamingResponse = response.json().await?;

        let content = response_data
            .content
            .into_iter()
            .map(|block| block.text)
            .collect::<String>();

        handler.handle_response(ChatResponse {
            content,
            model: Some(model),
            usage: None,
        })
    }
}
