use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    #[serde(default)]
    pub reactions: Option<MessageReactions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageReactions {
    pub thumbs_up: i32,
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
    // Check if provider supports streaming
    fn supports_streaming(&self) -> bool;

    // Streaming version
    async fn send_message_streaming(
        &self,
        messages: Vec<Message>,
        callback: StreamCallback,
    ) -> Result<String, String>;

    // Non-streaming version
    async fn send_message_blocking(&self, messages: Vec<Message>) -> Result<String, String>;

    // Main entry point that handles both streaming and non-streaming
    async fn send_message(
        &self,
        messages: Vec<Message>,
        callback: Option<StreamCallback>,
    ) -> Result<String, String> {
        match (self.supports_streaming(), callback) {
            (true, Some(cb)) => self.send_message_streaming(messages, cb).await,
            _ => self.send_message_blocking(messages).await,
        }
    }
}
#[derive(Debug, Serialize, Deserialize, Clone)]
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
