use serde::{Deserialize, Serialize};

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

// Re-export common types from response module
pub use super::response::{ChatResponse, TokenUsage};
