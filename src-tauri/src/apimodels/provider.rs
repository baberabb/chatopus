use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamResponse {
    pub text: String,
    pub is_done: bool,
}

// Type alias for the callback function
pub type StreamCallback = Box<dyn Fn(StreamResponse) + Send + Sync + 'static>;

#[async_trait]
pub trait ChatProvider: Send + Sync {
    async fn send_message(
        &self,
        messages: Vec<Message>,
        callback: StreamCallback,
    ) -> Result<String, String>;
}

pub struct ProviderConfig {
    pub api_key: String,
    pub model: String,
    pub max_tokens: u32,
}

pub struct ProviderFactory;

impl ProviderFactory {
    pub fn create_provider(
        provider_type: &str,
        config: ProviderConfig,
    ) -> Result<Box<dyn ChatProvider>, String> {
        match provider_type {
            "anthropic" => Ok(Box::new(super::anthropic::AnthropicProvider::new(config))),
            // Add other providers here
            _ => Err(format!("Unknown provider type: {}", provider_type)),
        }
    }
}
