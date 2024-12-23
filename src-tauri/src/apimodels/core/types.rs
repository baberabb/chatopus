use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A message in a chat conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// Unique identifier for the message
    pub id: String,

    /// Role of the message sender (e.g., "user", "assistant")
    pub role: String,

    /// Content of the message
    pub content: String,

    /// Timestamp of when the message was created
    pub timestamp: String,

    /// Model that generated this message (for assistant messages)
    pub model: Option<String>,

    /// Provider-specific metadata
    pub metadata: Option<serde_json::Value>,

    /// Optional reactions to the message
    #[serde(default)]
    pub reactions: Option<MessageReactions>,

    /// ID of the original message if this is a modification
    pub original_message_id: Option<String>,
}

/// Reactions that can be added to messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageReactions {
    /// Number of thumbs up reactions
    pub thumbs_up: i32,
}

/// Response from a chat provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    /// Generated response content
    pub content: String,

    /// Model that generated the response
    pub model: Option<String>,

    /// Token usage statistics if available
    pub usage: Option<TokenUsage>,

    /// Provider-specific metadata
    pub metadata: Option<serde_json::Value>,
}

/// Token usage statistics for a response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    /// Number of tokens in the prompt
    pub prompt_tokens: u32,

    /// Number of tokens in the completion
    pub completion_tokens: u32,

    /// Total number of tokens used
    pub total_tokens: u32,
}

/// A streaming response chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamResponse {
    /// The text chunk
    pub text: String,

    /// Whether this is the final chunk
    pub is_done: bool,
}

/// Common request parameters that can be used across providers
#[derive(Debug, Clone, Serialize)]
pub struct ChatRequest {
    /// The conversation messages
    pub messages: Vec<Message>,

    /// Model to use
    pub model: String,

    /// Maximum tokens to generate
    pub max_tokens: u32,

    /// Whether to stream the response
    pub stream: bool,

    /// Provider-specific parameters
    pub parameters: Option<HashMap<String, serde_json::Value>>,
}
