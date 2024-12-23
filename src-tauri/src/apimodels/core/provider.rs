use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::broadcast;

use super::{
    error::Error,
    request::RequestOptions,
    response::{ResponseHandler, StreamHandler},
    types::{ChatRequest, ChatResponse, Message},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    pub supports_streaming: bool,
    pub supports_function_calls: bool,
    pub supports_vision: bool,
    pub max_context_length: usize,
    pub supported_parameters: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ProviderBuilder {
    pub name: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub api_version: Option<String>,
    pub timeout_seconds: Option<u64>,
    pub retry_attempts: Option<u32>,
    pub parameters: HashMap<String, serde_json::Value>,
    pub custom_parameters: Option<HashMap<String, serde_json::Value>>,
    pub additional_headers: Option<HashMap<String, String>>,
}

impl ProviderBuilder {
    pub fn new(name: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            api_key: api_key.into(),
            base_url: None,
            api_version: None,
            timeout_seconds: None,
            retry_attempts: None,
            parameters: HashMap::new(),
            custom_parameters: None,
            additional_headers: None,
        }
    }

    pub fn with_base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = Some(url.into());
        self
    }

    pub fn with_api_version(mut self, version: impl Into<String>) -> Self {
        self.api_version = Some(version.into());
        self
    }

    pub fn with_timeout(mut self, seconds: u64) -> Self {
        self.timeout_seconds = Some(seconds);
        self
    }

    pub fn with_retries(mut self, attempts: u32) -> Self {
        self.retry_attempts = Some(attempts);
        self
    }

    pub fn with_parameter(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.parameters.insert(key.into(), value);
        self
    }

    pub fn with_custom_parameters(mut self, params: HashMap<String, serde_json::Value>) -> Self {
        self.custom_parameters = Some(params);
        self
    }

    pub fn with_headers(mut self, headers: HashMap<String, String>) -> Self {
        self.additional_headers = Some(headers);
        self
    }
}

#[async_trait]
pub trait Provider: Send + Sync {
    /// Get the provider's capabilities
    fn capabilities(&self) -> &ProviderCapabilities;

    /// Prepare a chat request with the given messages and options
    async fn prepare_request(
        &self,
        messages: Vec<Message>,
        options: &RequestOptions,
    ) -> std::result::Result<ChatRequest, Error>;

    /// Send a message with streaming support
    async fn send_message_streaming(
        &self,
        request: ChatRequest,
        handler: Box<dyn StreamHandler>,
        cancel_token: broadcast::Receiver<()>,
    ) -> std::result::Result<String, Error>;

    /// Send a message without streaming
    async fn send_message_blocking(
        &self,
        request: ChatRequest,
        handler: Box<dyn ResponseHandler>,
    ) -> std::result::Result<ChatResponse, Error>;

    /// High-level send message interface that handles both streaming and blocking cases
    async fn send_message(
        &self,
        messages: Vec<Message>,
        stream_handler: Option<Box<dyn StreamHandler>>,
        options: Option<RequestOptions>,
        cancel_token: Option<broadcast::Receiver<()>>,
    ) -> std::result::Result<String, Error> {
        let options = options.unwrap_or_default();
        let request = self.prepare_request(messages, &options).await?;

        match (
            self.capabilities().supports_streaming,
            stream_handler,
            cancel_token,
        ) {
            (true, Some(handler), Some(token)) => {
                self.send_message_streaming(request, handler, token).await
            }
            _ => {
                let response = self
                    .send_message_blocking(request, Box::new(DefaultResponseHandler))
                    .await?;
                Ok(response.content)
            }
        }
    }
}

// Default response handler implementation
struct DefaultResponseHandler;

impl ResponseHandler for DefaultResponseHandler {
    fn handle_response(&self, response: ChatResponse) -> std::result::Result<ChatResponse, Error> {
        Ok(response)
    }
}
