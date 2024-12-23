pub mod core;
pub mod providers;

use std::sync::Arc;

pub use core::{
    error::Error,
    provider::{Provider, ProviderBuilder},
    streaming::StreamHandler,
    types::{ChatRequest, ChatResponse, Message},
};

use providers::registry::ProviderRegistry;

// Global provider registry
static PROVIDER_REGISTRY: once_cell::sync::Lazy<Arc<ProviderRegistry>> =
    once_cell::sync::Lazy::new(|| Arc::new(ProviderRegistry::new()));

pub fn get_provider_registry() -> Arc<ProviderRegistry> {
    PROVIDER_REGISTRY.clone()
}
