use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use tauri::State;
use tauri_plugin_store::StoreExt;

fn default_parameters() -> HashMap<String, serde_json::Value> {
    let mut params = HashMap::new();
    params.insert("max_tokens".to_string(), json!(1024));
    params.insert("streaming".to_string(), json!(true));
    params.insert("temperature".to_string(), json!(0.7));
    params.insert("top_p".to_string(), json!(1.0));
    params
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ProviderSettings {
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub model: String,
    #[serde(default = "default_parameters")]
    pub parameters: HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub custom_parameters: Option<HashMap<String, serde_json::Value>>,
    #[serde(default)]
    pub api_version: Option<String>,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default = "default_timeout_seconds")]
    pub timeout_seconds: Option<u64>,
    #[serde(default = "default_retry_attempts")]
    pub retry_attempts: Option<u32>,
    #[serde(default)]
    pub additional_headers: Option<HashMap<String, String>>,
}

fn default_timeout_seconds() -> Option<u64> {
    Some(120)
}

fn default_retry_attempts() -> Option<u32> {
    Some(3)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub active_provider: String,
    pub providers: HashMap<String, ProviderSettings>,
}

impl Default for AppConfig {
    fn default() -> Self {
        let mut providers = HashMap::new();

        // Anthropic provider
        providers.insert(
            "anthropic".to_string(),
            ProviderSettings {
                api_key: String::new(),
                model: "claude-3-sonnet-20240229".to_string(),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("max_tokens".to_string(), json!(1024));
                    params.insert("streaming".to_string(), json!(true));
                    params.insert("temperature".to_string(), json!(0.7));
                    params.insert("top_p".to_string(), json!(1.0));
                    params.insert("top_k".to_string(), json!(5));
                    params
                },
                custom_parameters: None,
                api_version: None,
                base_url: None,
                timeout_seconds: Some(120),
                retry_attempts: Some(3),
                additional_headers: None,
            },
        );

        // OpenAI provider
        providers.insert(
            "openai".to_string(),
            ProviderSettings {
                api_key: String::new(),
                model: "gpt-4-turbo-preview".to_string(),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("max_tokens".to_string(), json!(1024));
                    params.insert("streaming".to_string(), json!(true));
                    params.insert("temperature".to_string(), json!(0.7));
                    params.insert("top_p".to_string(), json!(1.0));
                    params.insert("presence_penalty".to_string(), json!(0.0));
                    params.insert("frequency_penalty".to_string(), json!(0.0));
                    params.insert("tool_calls".to_string(), json!(false));
                    params.insert("tool_choice".to_string(), json!("none"));
                    params
                },
                custom_parameters: None,
                api_version: None,
                base_url: None,
                timeout_seconds: Some(120),
                retry_attempts: Some(3),
                additional_headers: None,
            },
        );

        // OpenRouter provider
        providers.insert(
            "openrouter".to_string(),
            ProviderSettings {
                api_key: String::new(),
                model: "anthropic/claude-3-opus".to_string(),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("max_tokens".to_string(), json!(1024));
                    params.insert("streaming".to_string(), json!(true));
                    params.insert("temperature".to_string(), json!(0.7));
                    params.insert("top_p".to_string(), json!(1.0));
                    params.insert("top_k".to_string(), json!(5));
                    params.insert("presence_penalty".to_string(), json!(0.0));
                    params.insert("frequency_penalty".to_string(), json!(0.0));
                    params
                },
                custom_parameters: None,
                api_version: None,
                base_url: None,
                timeout_seconds: Some(120),
                retry_attempts: Some(3),
                additional_headers: None,
            },
        );

        Self {
            active_provider: "anthropic".to_string(),
            providers,
        }
    }
}

pub struct ConfigState(pub parking_lot::Mutex<AppConfig>);

pub const STORE_PATH: &str = ".config/chatopus/config.json";

#[tauri::command]
pub async fn get_config(
    app: tauri::AppHandle,
    config: State<'_, ConfigState>,
) -> Result<AppConfig, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to access store: {}", e))?;

    match store.get("config") {
        Some(stored_config) => {
            // Update in-memory config with stored values
            match serde_json::from_value(stored_config.clone()) {
                Ok(config_value) => {
                    let config_value: AppConfig = config_value;

                    // Ensure all registered providers are in the loaded config
                    let registry = crate::apimodels::get_provider_registry();
                    let available_providers =
                        registry.list_providers().map_err(|e| e.to_string())?;

                    let mut updated_config = if config_value.providers.is_empty() {
                        // If no providers exist, start with default config
                        println!("No providers in config, using defaults");
                        AppConfig::default()
                    } else {
                        config_value.clone()
                    };

                    // Ensure all registered providers exist
                    for provider in available_providers {
                        if !updated_config.providers.contains_key(&provider) {
                            println!("Adding missing provider to config: {}", provider);
                            // Add provider with provider-specific defaults
                            let default_settings = match provider.as_str() {
                                "anthropic" => ProviderSettings {
                                    model: "claude-3-sonnet-20240229".to_string(),
                                    parameters: {
                                        let mut params = default_parameters();
                                        params.insert("top_k".to_string(), json!(5));
                                        params
                                    },
                                    ..Default::default()
                                },
                                "openai" => ProviderSettings {
                                    model: "gpt-4-turbo-preview".to_string(),
                                    parameters: {
                                        let mut params = default_parameters();
                                        params.insert("presence_penalty".to_string(), json!(0.0));
                                        params.insert("frequency_penalty".to_string(), json!(0.0));
                                        params.insert("tool_calls".to_string(), json!(false));
                                        params.insert("tool_choice".to_string(), json!("none"));
                                        params
                                    },
                                    ..Default::default()
                                },
                                "openrouter" => ProviderSettings {
                                    model: "anthropic/claude-3-opus".to_string(),
                                    parameters: {
                                        let mut params = default_parameters();
                                        params.insert("top_k".to_string(), json!(5));
                                        params.insert("presence_penalty".to_string(), json!(0.0));
                                        params.insert("frequency_penalty".to_string(), json!(0.0));
                                        params
                                    },
                                    ..Default::default()
                                },
                                _ => ProviderSettings::default(),
                            };
                            updated_config.providers.insert(provider, default_settings);
                        }
                    }

                    // Ensure active_provider is valid
                    if !updated_config
                        .providers
                        .contains_key(&updated_config.active_provider)
                    {
                        println!(
                            "Active provider '{}' not found, defaulting to anthropic",
                            updated_config.active_provider
                        );
                        updated_config.active_provider = "anthropic".to_string();
                    }

                    // Update both in-memory config and store
                    *config.0.lock() = updated_config.clone();
                    store.set("config", json!(updated_config.clone()));
                    if let Err(e) = store.save() {
                        return Err(format!("Failed to persist updated config: {}", e));
                    }
                    Ok(updated_config)
                }
                Err(e) => Err(format!("Failed to deserialize config: {}", e)),
            }
        }
        None => {
            // If no stored config exists, save the default config
            let default_config = config.0.lock().clone();
            store.set("config", json!(default_config));
            if let Err(e) = store.save() {
                return Err(format!("Failed to persist default config: {}", e));
            }
            Ok(default_config)
        }
    }
}

#[tauri::command]
pub async fn update_config(
    app: tauri::AppHandle,
    new_config: AppConfig,
    config: State<'_, ConfigState>,
) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to access store: {}", e))?;

    // Update in-memory config
    *config.0.lock() = new_config.clone();

    // Save to store
    store.set("config", json!(new_config));
    if let Err(e) = store.save() {
        return Err(format!("Failed to persist config: {}", e));
    }
    Ok(())
}

#[tauri::command]
pub async fn update_provider_settings(
    app: tauri::AppHandle,
    provider: String,
    settings: ProviderSettings,
    config: State<'_, ConfigState>,
) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to access store: {}", e))?;

    // Update in-memory config
    let mut config_guard = config.0.lock();
    config_guard
        .providers
        .insert(provider.clone(), settings.clone());

    // Update the provider in the registry with new settings
    let registry = crate::apimodels::get_provider_registry();
    let mut builder =
        crate::apimodels::core::provider::ProviderBuilder::new(&provider, &settings.api_key)
            .with_model(&settings.model);

    // Add optional settings
    if let Some(ref api_version) = settings.api_version {
        builder = builder.with_api_version(api_version);
    }
    if let Some(ref base_url) = settings.base_url {
        builder = builder.with_base_url(base_url);
    }
    if let Some(timeout) = settings.timeout_seconds {
        builder = builder.with_timeout(timeout);
    }
    if let Some(retries) = settings.retry_attempts {
        builder = builder.with_retries(retries);
    }
    if let Some(ref headers) = settings.additional_headers {
        builder = builder.with_headers(headers.clone());
    }
    if let Some(ref custom_params) = settings.custom_parameters {
        builder = builder.with_custom_parameters(custom_params.clone());
    }

    // Add default parameters
    builder = builder.with_parameters(settings.parameters.clone());

    // Update or create the provider in the registry
    if let Err(e) = registry.create_or_update_provider(&provider, builder) {
        return Err(format!("Failed to update provider: {}", e));
    }

    println!("Successfully updated provider settings: {}", provider);

    // Save to store
    store.set("config", json!(config_guard.clone()));
    if let Err(e) = store.save() {
        return Err(format!("Failed to persist provider settings: {}", e));
    }
    Ok(())
}

#[tauri::command]
pub async fn set_active_provider(
    app: tauri::AppHandle,
    provider: String,
    config: State<'_, ConfigState>,
) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to access store: {}", e))?;

    let mut config_guard = config.0.lock();

    // First check if provider is registered
    let registry = crate::apimodels::get_provider_registry();
    let available_providers = registry.list_providers().map_err(|e| e.to_string())?;
    if !available_providers.contains(&provider) {
        return Err(format!("Provider '{}' is not registered", provider));
    }

    // Then check if provider is configured
    if !config_guard.providers.contains_key(&provider) {
        return Err(format!("Provider '{}' is not configured", provider));
    }

    // Get the provider settings
    let settings = config_guard.providers.get(&provider).unwrap().clone();

    // Update active provider first to ensure config is consistent
    config_guard.active_provider = provider.clone();

    // Save to store before updating registry to ensure config is persisted
    store.set("config", json!(config_guard.clone()));
    if let Err(e) = store.save() {
        return Err(format!("Failed to persist active provider: {}", e));
    }

    // Drop the config guard to avoid potential deadlocks
    drop(config_guard);

    // Update the provider in the registry with settings
    let registry = crate::apimodels::get_provider_registry();
    let mut builder =
        crate::apimodels::core::provider::ProviderBuilder::new(&provider, &settings.api_key)
            .with_model(&settings.model);

    // Add optional settings
    if let Some(ref api_version) = settings.api_version {
        builder = builder.with_api_version(api_version);
    }
    if let Some(ref base_url) = settings.base_url {
        builder = builder.with_base_url(base_url);
    }
    if let Some(timeout) = settings.timeout_seconds {
        builder = builder.with_timeout(timeout);
    }
    if let Some(retries) = settings.retry_attempts {
        builder = builder.with_retries(retries);
    }
    if let Some(ref headers) = settings.additional_headers {
        builder = builder.with_headers(headers.clone());
    }
    if let Some(ref custom_params) = settings.custom_parameters {
        builder = builder.with_custom_parameters(custom_params.clone());
    }

    // Add parameters
    builder = builder.with_parameters(settings.parameters.clone());

    // Update or create the provider in the registry
    if let Err(e) = registry.create_or_update_provider(&provider, builder) {
        return Err(format!("Failed to update provider: {}", e));
    }

    println!("Successfully updated provider: {}", provider);
    Ok(())
}
