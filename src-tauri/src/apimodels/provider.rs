use async_trait::async_trait;
use reqwest::{Client, ClientBuilder, Response};
use std::fmt::Debug;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;

use crate::apimodels::config::{ProviderConfig, RequestConfig};
use crate::apimodels::error::{ProviderError, ProviderResult};
use crate::apimodels::types::{ChatRequest, ChatResponse, Message, StreamCallback, StreamResponse};

pub struct BaseProvider {
    pub config: ProviderConfig,
    pub client: Client,
}

impl BaseProvider {
    pub fn new(config: ProviderConfig) -> Self {
        let timeout = Duration::from_secs(config.timeout_seconds.unwrap_or(120));
        let client = ClientBuilder::new()
            .timeout(timeout)
            .connect_timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self { config, client }
    }

    pub async fn handle_response_error(response: Response) -> ProviderResult<Response> {
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Failed to read error response".to_string());

            return match status.as_u16() {
                429 => Err(ProviderError::RateLimit(error_text)),
                401 | 403 => Err(ProviderError::Authentication(error_text)),
                400 => Err(ProviderError::InvalidRequest(error_text)),
                500..=599 => Err(ProviderError::ServerError(error_text)),
                _ => Err(ProviderError::ResponseError {
                    status: status.as_u16(),
                    message: error_text,
                }),
            };
        }
        Ok(response)
    }

    pub async fn retry_with_backoff<F, Fut, T>(retries: u32, operation: F) -> ProviderResult<T>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = ProviderResult<T>>,
    {
        let mut attempt = 0;
        loop {
            match operation().await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    attempt += 1;
                    if attempt >= retries {
                        return Err(e);
                    }
                    if !matches!(e, ProviderError::RateLimit(_)) {
                        return Err(e);
                    }
                    tokio::time::sleep(Duration::from_secs(2u64.pow(attempt))).await;
                }
            }
        }
    }
}

#[async_trait]
pub trait ChatProvider: Send + Sync {
    fn supports_streaming(&self) -> bool;

    async fn prepare_request(&self, messages: Vec<Message>, config: &RequestConfig) -> ChatRequest;

    async fn send_message_streaming(
        &self,
        request: ChatRequest,
        callback: StreamCallback,
        cancel_token: broadcast::Receiver<()>,
    ) -> ProviderResult<String>;

    async fn send_message_blocking(&self, request: ChatRequest) -> ProviderResult<ChatResponse>;

    async fn send_message(
        &self,
        messages: Vec<Message>,
        callback: Option<StreamCallback>,
        request_config: Option<RequestConfig>,
        cancel_token: Option<broadcast::Receiver<()>>,
    ) -> ProviderResult<String> {
        let config = request_config.unwrap_or_default();
        let request = self.prepare_request(messages, &config).await;

        match (self.supports_streaming(), callback, cancel_token) {
            (true, Some(cb), Some(token)) => self.send_message_streaming(request, cb, token).await,
            _ => {
                let response = self.send_message_blocking(request).await?;
                Ok(response.content)
            }
        }
    }
}

pub struct ProviderFactory;

impl ProviderFactory {
    pub fn create_provider(
        provider_type: &str,
        config: ProviderConfig,
    ) -> ProviderResult<Box<dyn ChatProvider>> {
        match provider_type {
            "anthropic" => Ok(Box::new(super::anthropic::AnthropicProvider::new(config))),
            // Add other providers here
            _ => Err(ProviderError::InvalidRequest(format!(
                "Unknown provider type: {}",
                provider_type
            ))),
        }
    }
}
