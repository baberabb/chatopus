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

    pub fn create_or_update_provider(
        &self,
        name: &str,
        builder: ProviderBuilder,
    ) -> std::result::Result<DynProvider, Error> {
        let factories = self.factories.read().map_err(|_| {
            Error::ServerError("Failed to acquire read lock on provider factories".into())
        })?;

        println!("Creating/updating provider: {}", name);
        println!(
            "Available factories: {:?}",
            factories.keys().collect::<Vec<_>>()
        );

        let factory = factories
            .get(name)
            .ok_or_else(|| Error::InvalidRequest(format!("Unknown provider type: {}", name)))?;

        // Create new provider instance with the provided settings
        let provider = factory(builder.clone())?;

        // Update the instance in the registry
        {
            let mut instances = self.instances.write().map_err(|_| {
                Error::ServerError("Failed to acquire write lock on provider instances".into())
            })?;

            // Remove existing instance if any
            if instances.contains_key(name) {
                println!("Removing existing provider instance: {}", name);
                instances.remove(name);
            }

            // Insert new instance
            instances.insert(name.to_string(), provider.clone());
            println!("Provider updated and cached: {}", name);
            println!("Current provider settings: {:?}", provider.capabilities());
            println!(
                "Cached providers: {:?}",
                instances.keys().collect::<Vec<_>>()
            );
        }

        Ok(provider)
    }

    pub fn create_provider(
        &self,
        name: &str,
        builder: ProviderBuilder,
    ) -> std::result::Result<DynProvider, Error> {
        self.create_or_update_provider(name, builder)
    }

    pub fn get_provider(&self, name: &str) -> std::result::Result<DynProvider, Error> {
        // First check if we have a factory for this provider
        let factories = self
            .factories
            .read()
            .map_err(|_| Error::ServerError("Failed to acquire read lock on factories".into()))?;

        if !factories.contains_key(name) {
            return Err(Error::InvalidRequest(format!(
                "Unknown provider type: {}",
                name
            )));
        }

        // Then try to get the instance
        let instances = self.instances.read().map_err(|_| {
            Error::ServerError("Failed to acquire read lock on provider instances".into())
        })?;

        println!("Getting provider: {}", name);
        println!("Current instances:");
        for key in instances.keys() {
            println!("  - {}", key);
        }

        if let Some(provider) = instances.get(name) {
            println!("Found existing provider instance: {}", name);
            Ok(provider.clone())
        } else {
            // If no instance exists but we have a factory, create a default instance
            println!("No instance found for {}, creating default", name);
            drop(instances); // Drop read lock before acquiring write lock

            let default_model = match name {
                "anthropic" => "claude-3-sonnet-20240229",
                "openrouter" => "anthropic/claude-3-opus",
                _ => "gpt-4-turbo-preview",
            };

            let mut params = std::collections::HashMap::new();
            params.insert("max_tokens".to_string(), serde_json::json!(1024));
            params.insert("streaming".to_string(), serde_json::json!(true));
            params.insert("temperature".to_string(), serde_json::json!(0.7));
            params.insert("top_p".to_string(), serde_json::json!(1.0));

            let builder = crate::apimodels::core::provider::ProviderBuilder::new(name, "")
                .with_model(default_model)
                .with_parameters(params);

            self.create_provider(name, builder)
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
    println!("Registering default providers...");

    // Register and create initial instances for each provider
    let providers = [
        ("anthropic", "claude-3-sonnet-20240229"),
        ("openai", "gpt-4-turbo-preview"),
        ("openrouter", "anthropic/claude-3-opus"),
    ];
    println!("Provider list: {:?}", providers);

    for (name, model) in providers {
        // Register provider factory
        match name {
            "anthropic" => {
                println!("Registering Anthropic provider");
                registry.register_provider(name, |builder| {
                    Ok(Arc::new(AnthropicProvider::new(builder)) as DynProvider)
                })?;
            }
            "openai" | "openrouter" => {
                println!("Registering {} provider with OpenAI implementation", name);
                registry.register_provider(name, |builder| {
                    Ok(Arc::new(OpenAIProvider::new(builder)) as DynProvider)
                })?;
            }
            _ => {
                println!("Skipping unknown provider: {}", name);
                continue;
            }
        }

        // Create initial instance with default settings
        let mut params = std::collections::HashMap::new();
        params.insert("max_tokens".to_string(), serde_json::json!(1024));
        params.insert("streaming".to_string(), serde_json::json!(true));
        params.insert("temperature".to_string(), serde_json::json!(0.7));
        params.insert("top_p".to_string(), serde_json::json!(1.0));

        // Add provider-specific parameters
        if name == "openai" {
            params.insert("presence_penalty".to_string(), serde_json::json!(0.0));
            params.insert("frequency_penalty".to_string(), serde_json::json!(0.0));
            params.insert("tool_calls".to_string(), serde_json::json!(false));
            params.insert("tool_choice".to_string(), serde_json::json!("none"));
        } else if name == "anthropic" || name == "openrouter" {
            params.insert("top_k".to_string(), serde_json::json!(5));
        }

        let builder = crate::apimodels::core::provider::ProviderBuilder::new(name, "")
            .with_model(model)
            .with_parameters(params);

        // Create initial provider instance
        println!("Creating initial instance for provider: {}", name);
        registry.create_provider(name, builder)?;
        println!("Successfully created instance for provider: {}", name);
    }

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
        assert!(providers.contains(&"openrouter".to_string()));

        Ok(())
    }

    #[test]
    fn test_provider_creation() -> std::result::Result<(), Error> {
        let registry = ProviderRegistry::new();
        register_default_providers(&registry)?;

        // Test Anthropic provider
        let anthropic_builder = ProviderBuilder::new("anthropic", "test-key");
        let anthropic_provider = registry.create_provider("anthropic", anthropic_builder)?;
        assert!(anthropic_provider.capabilities().supports_streaming);

        // Test OpenRouter provider
        let openrouter_builder = ProviderBuilder::new("openrouter", "test-key");
        let openrouter_provider = registry.create_provider("openrouter", openrouter_builder)?;
        assert!(openrouter_provider.capabilities().supports_streaming);
        Ok(())
    }
}
