use super::error::Error;
use serde::{Deserialize, Serialize};

/// Response from a chat completion request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    /// The generated text content
    pub content: String,
    /// The model that generated the response
    pub model: Option<String>,
    /// Token usage statistics if available
    pub usage: Option<TokenUsage>,
    /// Provider-specific metadata
    pub metadata: Option<serde_json::Value>,
}

/// Token usage statistics for a request/response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    /// Number of tokens in the prompt
    pub prompt_tokens: u32,
    /// Number of tokens in the completion
    pub completion_tokens: u32,
    /// Total tokens used (prompt + completion)
    pub total_tokens: u32,
}

/// Handler for processing chat responses
///
/// Implement this trait to customize how responses are processed
/// before being returned to the caller. This can be used for
/// logging, modifying responses, or implementing custom error handling.
#[async_trait::async_trait]
pub trait ResponseHandler: Send + Sync {
    /// Handle a chat response
    ///
    /// Called when a response is received from the provider.
    /// The handler can modify the response or perform side effects
    /// before the response is returned.
    ///
    /// # Arguments
    /// * `response` - The chat response from the provider
    ///
    /// # Returns
    /// * `Ok(ChatResponse)` - The processed response
    /// * `Err(Error)` - If there was an error processing the response
    async fn handle_response(&self, response: ChatResponse) -> Result<ChatResponse, Error>;
}

/// Default response handler that passes responses through unchanged
pub struct DefaultResponseHandler;

#[async_trait::async_trait]
impl ResponseHandler for DefaultResponseHandler {
    async fn handle_response(&self, response: ChatResponse) -> Result<ChatResponse, Error> {
        Ok(response)
    }
}
