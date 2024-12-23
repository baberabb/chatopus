use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::broadcast;

use super::{
    error::Error,
    types::{ChatResponse, Message},
};

/// Type alias for streaming text callback
pub type TextCallback = Box<dyn Fn(String) -> Result<(), Error> + Send + Sync>;

/// Options for configuring a chat request
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProviderOptions {
    /// Model to use (if not specified in provider config)
    pub model: Option<String>,
    /// Maximum tokens to generate
    pub max_tokens: Option<u32>,
    /// Temperature for response randomness (0.0 to 1.0)
    pub temperature: Option<f32>,
    /// Top-p sampling (0.0 to 1.0)
    pub top_p: Option<f32>,
    /// Whether to use streaming for this request
    pub stream: bool,
    /// Whether to retry on rate limit errors
    pub retry_on_rate_limit: bool,
    /// Request-specific timeout in seconds
    pub timeout_seconds: Option<u64>,
    /// Provider-specific parameters
    pub parameters: Option<HashMap<String, serde_json::Value>>,
}

/// Defines what features a provider supports
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    /// Whether the provider supports streaming responses
    pub supports_streaming: bool,
    /// Whether the provider supports function calling
    pub supports_function_calls: bool,
    /// Whether the provider supports vision/image input
    pub supports_vision: bool,
    /// Maximum context length in tokens
    pub max_context_length: usize,
    /// List of supported parameter names
    pub supported_parameters: Vec<String>,
}

/// Configuration for building a provider instance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderBuilder {
    /// Provider name/identifier
    pub name: String,
    /// API key for authentication
    pub api_key: String,
    /// Default model to use
    pub model: String,
    /// Optional base URL override
    pub base_url: Option<String>,
    /// Optional API version
    pub api_version: Option<String>,
    /// Request timeout in seconds
    pub timeout_seconds: Option<u64>,
    /// Number of retry attempts
    pub retry_attempts: Option<u32>,
    /// Default parameters
    pub parameters: HashMap<String, serde_json::Value>,
    /// Custom provider-specific parameters
    pub custom_parameters: Option<HashMap<String, serde_json::Value>>,
    /// Additional HTTP headers
    pub additional_headers: Option<HashMap<String, String>>,
}

impl Default for ProviderBuilder {
    fn default() -> Self {
        let mut parameters = HashMap::new();
        parameters.insert("max_tokens".to_string(), serde_json::json!(1000));
        parameters.insert("temperature".to_string(), serde_json::json!(0.7));

        Self {
            name: String::new(),
            api_key: String::new(),
            model: String::new(),
            base_url: None,
            api_version: None,
            timeout_seconds: Some(120),
            retry_attempts: Some(3),
            parameters,
            custom_parameters: None,
            additional_headers: Some(HashMap::new()),
        }
    }
}

impl ProviderBuilder {
    /// Create a new provider builder
    pub fn new(name: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            api_key: api_key.into(),
            ..Default::default()
        }
    }

    /// Set default model
    pub fn with_model(mut self, model: impl Into<String>) -> Self {
        self.model = model.into();
        self
    }

    /// Set custom base URL
    pub fn with_base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = Some(url.into());
        self
    }

    /// Set API version
    pub fn with_api_version(mut self, version: impl Into<String>) -> Self {
        self.api_version = Some(version.into());
        self
    }

    /// Set request timeout
    pub fn with_timeout(mut self, seconds: u64) -> Self {
        self.timeout_seconds = Some(seconds);
        self
    }

    /// Set retry attempts
    pub fn with_retries(mut self, attempts: u32) -> Self {
        self.retry_attempts = Some(attempts);
        self
    }

    /// Set default parameters
    pub fn with_parameters(mut self, params: HashMap<String, serde_json::Value>) -> Self {
        self.parameters = params;
        self
    }

    /// Set custom parameters
    pub fn with_custom_parameters(mut self, params: HashMap<String, serde_json::Value>) -> Self {
        self.custom_parameters = Some(params);
        self
    }

    /// Set additional headers
    pub fn with_headers(mut self, headers: HashMap<String, String>) -> Self {
        self.additional_headers = Some(headers);
        self
    }
}

/// Core provider trait that all providers must implement
#[async_trait]
pub trait Provider: Send + Sync {
    /// Get the provider's capabilities
    fn capabilities(&self) -> &ProviderCapabilities;

    /// Send a message and get a response
    async fn send_message(
        &self,
        messages: Vec<Message>,
        options: ProviderOptions,
    ) -> Result<ChatResponse, Error>;

    /// Send a message with streaming
    ///
    /// # Arguments
    /// * `messages` - List of messages in the conversation
    /// * `options` - Request options including model, temperature etc.
    /// * `on_text` - Callback for handling text chunks
    /// * `cancel` - Token for cancelling the stream
    ///
    /// # Returns
    /// * `Ok(())` if streaming completed successfully
    /// * `Err(Error)` if there was an error
    async fn send_message_streaming(
        &self,
        messages: Vec<Message>,
        options: ProviderOptions,
        on_text: TextCallback,
        cancel: broadcast::Receiver<()>,
    ) -> Result<(), Error> {
        Err(Error::UnsupportedOperation(
            "This provider does not support streaming".into(),
        ))
    }

    /// Validate provider-specific parameters
    fn validate_parameters(
        &self,
        parameters: &HashMap<String, serde_json::Value>,
    ) -> Result<(), Error> {
        // Default implementation accepts all parameters
        Ok(())
    }

    /// Merge and validate parameters from different sources
    fn merge_parameters(
        &self,
        provider_params: Option<&HashMap<String, serde_json::Value>>,
        request_params: Option<&HashMap<String, serde_json::Value>>,
    ) -> Result<HashMap<String, serde_json::Value>, Error> {
        let mut merged = HashMap::new();

        // Start with provider parameters
        if let Some(params) = provider_params {
            merged.extend(params.clone());
        }

        // Override with request parameters
        if let Some(params) = request_params {
            merged.extend(params.clone());
        }

        // Validate the merged parameters
        self.validate_parameters(&merged)?;

        Ok(merged)
    }
}
