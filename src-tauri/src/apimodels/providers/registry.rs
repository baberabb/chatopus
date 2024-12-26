use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use super::{AnthropicProvider, DynProvider, OpenAIProvider};
use crate::apimodels::core::{
    error::Error,
    provider::{Provider, ProviderBuilder},
};

type ProviderFactory =
    Box<dyn Fn(ProviderBuilder) -> std::result::Result<DynProvider, Error> + Send + Sync>;

#[derive(Default)]
pub struct ProviderRegistry {
    factories: Arc<RwLock<HashMap<String, ProviderFactory>>>,
    instances: Arc<RwLock<HashMap<String, DynProvider>>>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register_provider<F>(&self, name: &str, factory: F) -> std::result::Result<(), Error>
    where
        F: Fn(ProviderBuilder) -> std::result::Result<DynProvider, Error> + Send + Sync + 'static,
    {
        let mut factories = self.factories.write().map_err(|_| {
            Error::ServerError("Failed to acquire write lock on provider factories".into())
        })?;

        factories.insert(name.to_string(), Box::new(factory));
        Ok(())
    }

    pub fn create_provider(
        &self,
        name: &str,
        builder: ProviderBuilder,
    ) -> std::result::Result<DynProvider, Error> {
        let factories = self.factories.read().map_err(|_| {
            Error::ServerError("Failed to acquire read lock on provider factories".into())
        })?;

        let factory = factories
            .get(name)
            .ok_or_else(|| Error::InvalidRequest(format!("Unknown provider type: {}", name)))?;

        let provider = factory(builder)?;

        // Cache the provider instance
        let mut instances = self.instances.write().map_err(|_| {
            Error::ServerError("Failed to acquire write lock on provider instances".into())
        })?;
        instances.insert(name.to_string(), provider.clone());

        Ok(provider)
    }

    pub fn get_provider(&self, name: &str) -> std::result::Result<DynProvider, Error> {
        let instances = self.instances.read().map_err(|_| {
            Error::ServerError("Failed to acquire read lock on provider instances".into())
        })?;

        if let Some(provider) = instances.get(name) {
            Ok(provider.clone())
        } else {
            Err(Error::InvalidRequest(format!(
                "Provider not initialized: {}",
                name
            )))
        }
    }

    pub fn list_providers(&self) -> std::result::Result<Vec<String>, Error> {
        let factories = self.factories.read().map_err(|_| {
            Error::ServerError("Failed to acquire read lock on provider factories".into())
        })?;

        Ok(factories.keys().cloned().collect())
    }
}

// Register default providers
pub fn register_default_providers(registry: &ProviderRegistry) -> std::result::Result<(), Error> {
    // Register Anthropic provider
    registry.register_provider("anthropic", |builder| {
        Ok(Arc::new(AnthropicProvider::new(builder)) as DynProvider)
    })?;

    // Register OpenAI provider
    registry.register_provider("openai", |builder| {
        Ok(Arc::new(OpenAIProvider::new(builder)) as DynProvider)
    })?;

    // Add other default providers here
    // registry.register_provider("openrouter", |builder| { ... })?;

    Ok(())
}

// Helper function to create a new provider registry with default providers
pub fn create_provider_registry() -> std::result::Result<ProviderRegistry, Error> {
    let registry = ProviderRegistry::new();
    register_default_providers(&registry)?;
    Ok(registry)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_registration() -> std::result::Result<(), Error> {
        let registry = ProviderRegistry::new();
        register_default_providers(&registry)?;

        let providers = registry.list_providers()?;
        assert!(providers.contains(&"anthropic".to_string()));
        assert!(providers.contains(&"openai".to_string()));

        Ok(())
    }

    #[test]
    fn test_provider_creation() -> std::result::Result<(), Error> {
        let registry = ProviderRegistry::new();
        register_default_providers(&registry)?;

        let builder = ProviderBuilder::new("test", "test-key");
        let provider = registry.create_provider("anthropic", builder)?;

        assert!(provider.capabilities().supports_streaming);
        Ok(())
    }
}
