//! Core module for provider implementations
//!
//! This module provides the base traits and types for implementing chat providers.
//! The main components are:
//!
//! - Provider trait: Core interface that all providers must implement
//! - Streaming support: Optional streaming capability via send_message_streaming
//! - Error handling: Serializable errors with retry support
//!
//! # Example
//! ```rust
//! use crate::apimodels::core::{
//!     Provider, ProviderBuilder, ProviderOptions, Message, Error,
//!     StreamHandler, StreamEvent,
//! };
//!
//! // Create a provider
//! let builder = ProviderBuilder::new("my-provider", "api-key");
//! let provider = MyProvider::new(builder);
//!
//! // Send a message
//! let messages = vec![Message {
//!     role: "user".into(),
//!     content: "Hello".into(),
//!     // ... other fields
//! }];
//!
//! let options = ProviderOptions {
//!     model: Some("gpt-4".into()),
//!     temperature: Some(0.7),
//!     stream: false,
//!     // ... other options
//! };
//!
//! let response = provider.send_message(messages, options).await?;
//! ```

pub mod error;
pub mod provider;
pub mod request;
pub mod response;
pub mod streaming;
pub mod types;

// Re-export common types and traits
pub use error::{Error, ErrorExt};
pub use provider::{Provider, ProviderBuilder, ProviderCapabilities, ProviderOptions};
pub use response::{ChatResponse, ResponseHandler, TokenUsage};
pub use streaming::{StreamEvent, StreamHandler};
pub use types::Message;

// Re-export error handlers
pub use error::handlers::{handle_response_error, retry_with_backoff};
