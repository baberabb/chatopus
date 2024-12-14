use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use tauri::State;
use tauri_plugin_store::StoreExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderSettings {
    pub api_key: String,
    pub model: String,
    pub max_tokens: u32,
    pub streaming: bool,
    #[serde(default)] // This makes it use Vec::new() if field is missing
    pub available_models: Vec<String>,
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
                max_tokens: 1024,
                streaming: true,
                available_models: vec![
                    "claude-3-opus-20240229".to_string(),
                    "claude-3-sonnet-20240229".to_string(),
                    "claude-3-haiku-20240307".to_string(),
                    "claude-2.1".to_string(),
                ],
            },
        );

        // OpenAI provider
        providers.insert(
            "openai".to_string(),
            ProviderSettings {
                api_key: String::new(),
                model: "gpt-4-turbo-preview".to_string(),
                max_tokens: 1024,
                streaming: true,
                available_models: vec![
                    "gpt-4-turbo-preview".to_string(),
                    "gpt-4-0125-preview".to_string(),
                    "gpt-4".to_string(),
                    "gpt-3.5-turbo".to_string(),
                ],
            },
        );

        // OpenRouter provider
        providers.insert(
            "openrouter".to_string(),
            ProviderSettings {
                api_key: String::new(),
                model: "anthropic/claude-3-opus".to_string(),
                max_tokens: 1024,
                streaming: true,
                available_models: vec![
                    "anthropic/claude-3-opus".to_string(),
                    "anthropic/claude-3-sonnet".to_string(),
                    "openai/gpt-4-turbo-preview".to_string(),
                    "google/gemini-pro".to_string(),
                    "meta/llama-3-70b".to_string(),
                ],
            },
        );

        Self {
            active_provider: "anthropic".to_string(),
            providers,
        }
    }
}

pub struct ConfigState(pub parking_lot::Mutex<AppConfig>);

const STORE_PATH: &str = "config.json";

#[tauri::command]
pub async fn get_config(
    app: tauri::AppHandle,
    config: State<'_, ConfigState>,
) -> Result<AppConfig, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to access store: {}", e))?;

    let stored_value = if let Some(value) = store.get("config") {
        value
    } else {
        let default_config = AppConfig::default();
        store.set("config", json!(default_config.clone()));
        store
            .save()
            .map_err(|e| format!("Failed to save default config: {}", e))?;
        json!(default_config)
    };

    // Update in-memory config with stored values
    let mut config_value: AppConfig = serde_json::from_value(stored_value.clone())
        .map_err(|e| format!("Failed to deserialize config: {}", e))?;

    // Ensure available_models is populated for existing configs
    let default_config = AppConfig::default();

    for (provider, settings) in config_value.providers.iter_mut() {
        if settings.available_models.is_empty() {
            if let Some(default_settings) = default_config.providers.get(provider) {
                println!("Populating available_models for provider {}", provider);
                settings.available_models = default_settings.available_models.clone();
            }
        }
    }

    // Add any missing providers from default config
    for (provider, settings) in default_config.providers {
        if !config_value.providers.contains_key(&provider) {
            println!("Adding missing provider {}", provider);
            config_value.providers.insert(provider, settings);
        }
    }

    // Update store with any changes
    store.set("config", json!(config_value.clone()));
    store
        .save()
        .map_err(|e| format!("Failed to save config: {}", e))?;

    // Update in-memory config
    *config.0.lock() = config_value.clone();

    Ok(config_value)
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

    // Ensure available_models is preserved
    let mut config_value = new_config;
    let current_config = config.0.lock();

    for (provider, settings) in config_value.providers.iter_mut() {
        if settings.available_models.is_empty() {
            if let Some(current_settings) = current_config.providers.get(provider) {
                settings.available_models = current_settings.available_models.clone();
            }
        }
    }

    // Update in-memory config
    *config.0.lock() = config_value.clone();

    // Save to store
    store.set("config", json!(config_value));
    store
        .save()
        .map_err(|e| format!("Failed to save config: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn update_provider_settings(
    app: tauri::AppHandle,
    provider: String,
    mut settings: ProviderSettings,
    config: State<'_, ConfigState>,
) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to access store: {}", e))?;

    // Ensure available_models is preserved
    let config_guard = config.0.lock();
    if settings.available_models.is_empty() {
        if let Some(current_settings) = config_guard.providers.get(&provider) {
            settings.available_models = current_settings.available_models.clone();
        }
    }

    // Update in-memory config
    let mut config_guard = config.0.lock();
    config_guard.providers.insert(provider, settings);

    // Save to store
    store.set("config", json!(config_guard.clone()));
    store
        .save()
        .map_err(|e| format!("Failed to save provider settings: {}", e))?;

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
    if !config_guard.providers.contains_key(&provider) {
        return Err("Provider not found".to_string());
    }

    config_guard.active_provider = provider;

    // Save to store
    store.set("config", json!(config_guard.clone()));
    store
        .save()
        .map_err(|e| format!("Failed to save active provider: {}", e))?;

    Ok(())
}
