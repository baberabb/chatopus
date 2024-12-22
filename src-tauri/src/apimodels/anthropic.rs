use async_trait::async_trait;
use bytes::Bytes;
use futures_util::{pin_mut, FutureExt, StreamExt};
use reqwest::header::HeaderMap;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

use super::config::{ProviderConfig, RequestConfig};
use super::error::{ProviderError, ProviderResult};
use super::provider::{BaseProvider, ChatProvider};
use super::types::{ChatRequest, ChatResponse, Message, StreamCallback, StreamResponse};

const DEFAULT_API_VERSION: &str = "2023-06-01";
const INITIAL_BUFFER_SIZE: usize = 1024;
const RESPONSE_BUFFER_SIZE: usize = 4096;
const API_ENDPOINT: &str = "https://api.anthropic.com/v1/messages";

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
    #[serde(flatten)]
    parameters: Option<std::collections::HashMap<String, serde_json::Value>>,
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

pub struct AnthropicProvider {
    base: BaseProvider,
}

impl AnthropicProvider {
    #[inline]
    pub fn new(config: ProviderConfig) -> Self {
        #[cfg(debug_assertions)]
        eprintln!(
            "ANTHROPIC PROVIDER INIT PARAMS: {}",
            serde_json::to_string_pretty(&config.parameters).unwrap_or_default()
        );

        Self {
            base: BaseProvider::new(config),
        }
    }

    #[inline]
    fn convert_messages(messages: Vec<Message>) -> Vec<AnthropicMessage> {
        messages
            .into_iter()
            .map(|msg| AnthropicMessage {
                role: msg.role,
                content: msg.content,
            })
            .collect()
    }

    fn create_headers(config: &ProviderConfig) -> HeaderMap {
        let mut headers = HeaderMap::with_capacity(3);
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

    async fn make_request(&self, request: &AnthropicRequest) -> ProviderResult<reqwest::Response> {
        // Debug log the request parameters
        #[cfg(debug_assertions)]
        eprintln!(
            "ANTHROPIC REQUEST PARAMS: {}",
            serde_json::to_string_pretty(&request.parameters).unwrap_or_default()
        );

        self.base
            .client
            .post(API_ENDPOINT)
            .headers(Self::create_headers(&self.base.config))
            .json(request)
            .send()
            .await
            .map_err(|e| ProviderError::RequestError(e.to_string()))
    }

    fn process_chunk(
        chunk: &[u8],
        buffer: &mut Vec<u8>,
        full_response: &mut String,
        callback: &StreamCallback,
    ) -> ProviderResult<bool> {
        buffer.extend_from_slice(chunk);

        let mut is_complete = false;
        while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
            let line = String::from_utf8_lossy(&buffer[..pos]).trim().to_string();
            buffer.drain(..=pos);

            #[cfg(debug_assertions)]
            eprintln!("ANTHROPIC RAW LINE: {}", &line);

            if let Some(data) = line.strip_prefix("data: ") {
                #[cfg(debug_assertions)]
                eprintln!("ANTHROPIC EVENT DATA: {}", &data);

                if data == "[DONE]" {
                    callback(StreamResponse::done());
                    is_complete = true;
                    break;
                }

                if let Ok(event_data) = serde_json::from_str::<EventData>(data) {
                    if let Some(text) = event_data.delta.and_then(|d| d.text) {
                        full_response.push_str(&text);
                        callback(StreamResponse::new(text));
                    }

                    if event_data.event_type == "content_block_stop" {
                        callback(StreamResponse::done());
                        is_complete = true;
                        break;
                    }
                }
            }
        }
        Ok(is_complete)
    }
}

#[async_trait]
impl ChatProvider for AnthropicProvider {
    #[inline]
    fn supports_streaming(&self) -> bool {
        true
    }

    async fn prepare_request(&self, messages: Vec<Message>, config: &RequestConfig) -> ChatRequest {
        #[cfg(debug_assertions)]
        eprintln!(
            "ANTHROPIC PREPARE REQUEST - INITIAL PARAMS: {}",
            serde_json::to_string_pretty(&self.base.config.parameters).unwrap_or_default()
        );

        // Start with provider parameters
        let mut params = self.base.config.parameters.clone();

        // Merge custom parameters if any
        if let Some(custom_params) = &self.base.config.custom_parameters {
            params.extend(custom_params.clone());
        }

        // Ensure required parameters have defaults
        if !params.contains_key("temperature") {
            params.insert("temperature".to_string(), serde_json::json!(0.7));
        }
        if !params.contains_key("max_tokens") {
            params.insert("max_tokens".to_string(), serde_json::json!(1024));
        }

        #[cfg(debug_assertions)]
        eprintln!(
            "ANTHROPIC PREPARE REQUEST - FINAL PARAMS: {}",
            serde_json::to_string_pretty(&params).unwrap_or_default()
        );

        let max_tokens = params
            .get("max_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(1024) as u32;

        ChatRequest {
            messages,
            model: self.base.config.model.clone(),
            max_tokens,
            stream: config.streaming,
            parameters: Some(params),
        }
    }

    async fn send_message_streaming(
        &self,
        request: ChatRequest,
        callback: StreamCallback,
        mut cancel_token: broadcast::Receiver<()>,
    ) -> ProviderResult<String> {
        let anthropic_request = AnthropicRequest {
            model: request.model,
            messages: Self::convert_messages(request.messages),
            max_tokens: request.max_tokens,
            stream: true,
            parameters: request.parameters,
        };

        let mut full_response = String::with_capacity(RESPONSE_BUFFER_SIZE);
        let mut buffer = Vec::with_capacity(INITIAL_BUFFER_SIZE);

        let response = self.make_request(&anthropic_request).await?;
        let response = BaseProvider::handle_response_error(response).await?;

        let stream = response.bytes_stream();
        pin_mut!(stream);

        loop {
            let chunk = futures_util::select! {
                chunk = stream.next().fuse() => match chunk {
                    Some(Ok(chunk)) => chunk,
                    Some(Err(e)) => return Err(ProviderError::RequestError(e.to_string())),
                    None => break,
                },
                _ = cancel_token.recv().fuse() => {
                    callback(StreamResponse::cancelled());
                    return Ok(format!("{}\n[Cancelled]", full_response));
                }
            };

            #[cfg(debug_assertions)]
            eprintln!("ANTHROPIC RAW CHUNK: {}", String::from_utf8_lossy(&chunk));

            if Self::process_chunk(&chunk, &mut buffer, &mut full_response, &callback)? {
                break;
            }
        }

        Ok(full_response)
    }

    async fn send_message_blocking(&self, request: ChatRequest) -> ProviderResult<ChatResponse> {
        let anthropic_request = AnthropicRequest {
            model: request.model.clone(),
            messages: Self::convert_messages(request.messages),
            max_tokens: request
                .parameters
                .as_ref()
                .and_then(|p| p.get("max_tokens"))
                .and_then(|v| v.as_u64())
                .unwrap_or(1024) as u32,
            stream: false,
            parameters: request.parameters,
        };

        let response =
            BaseProvider::handle_response_error(self.make_request(&anthropic_request).await?)
                .await?;

        let response_data: NonStreamingResponse = response
            .json()
            .await
            .map_err(|e| ProviderError::ParseError(e.to_string()))?;

        let content = response_data
            .content
            .into_iter()
            .map(|block| block.text)
            .collect::<String>();

        Ok(ChatResponse {
            content,
            model: Some(request.model),
            usage: None,
        })
    }
}

// Helper implementations
impl StreamResponse {
    #[inline]
    fn new(text: String) -> Self {
        Self {
            text,
            is_done: false,
        }
    }

    #[inline]
    fn done() -> Self {
        Self {
            text: String::new(),
            is_done: true,
        }
    }

    #[inline]
    fn cancelled() -> Self {
        Self {
            text: "\n[Cancelled]".into(),
            is_done: true,
        }
    }
}
