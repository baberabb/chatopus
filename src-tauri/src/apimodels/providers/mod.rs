mod anthropic;
mod registry;

pub use anthropic::AnthropicProvider;
pub use registry::{register_default_providers, ProviderRegistry};

use crate::apimodels::core::provider::Provider;
use std::sync::Arc;

pub type DynProvider = Arc<dyn Provider>;

// Re-export provider-specific types that may be needed by the application
pub mod types {
    pub use super::anthropic::AnthropicProvider;
}
