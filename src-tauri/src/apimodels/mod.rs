//! API models for chat providers
//!
//! This module provides a modular system for implementing chat providers like Anthropic, OpenAI, etc.
//! The system is split into two main parts:
//!
//! # Core Module
//! The `core` module contains all the base traits and types that providers use:
//!
//! - Provider trait for implementing new providers
//! - Error types and handling
//! - Request/response types
//! - Streaming support
//!
//! # Providers Module
//! The `providers` module contains specific provider implementations and the provider registry:
//!
//! - Individual provider implementations (e.g., Anthropic)
//! - Provider registry for managing providers
//! - Factory system for creating providers
//!
//! # Example
//! ```rust
//! use crate::apimodels::{
//!     get_provider_registry,
//!     core::provider::{Provider, ProviderBuilder, ProviderOptions},
//!     init,
//! };
//!
//! // Initialize providers
//! init()?;
//!
//! // Get a provider
//! let registry = get_provider_registry();
//! let builder = ProviderBuilder::new("anthropic", "api-key");
//! let provider = registry.create_provider("anthropic", builder)?;
//!
//! // Send a message
//! let response = provider.send_message(
//!     messages,
//!     ProviderOptions {
//!         model: Some("claude-2".into()),
//!         temperature: Some(0.7),
//!         stream: false,
//!         ..Default::default()
//!     }
//! ).await?;
//! ```

pub mod core;
pub mod providers;

use std::sync::Arc;

// Re-export provider registry
pub use providers::registry::{create_provider_registry, ProviderRegistry};

// Global provider registry
static PROVIDER_REGISTRY: once_cell::sync::Lazy<Arc<ProviderRegistry>> =
    once_cell::sync::Lazy::new(|| Arc::new(ProviderRegistry::new()));

/// Get the global provider registry
pub fn get_provider_registry() -> Arc<ProviderRegistry> {
    PROVIDER_REGISTRY.clone()
}

/// Initialize default providers
pub fn init() -> Result<(), core::error::Error> {
    println!("Initializing API models...");
    providers::registry::register_default_providers(&PROVIDER_REGISTRY)?;
    println!("API models initialized successfully");
    Ok(())
}
