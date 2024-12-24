use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use tauri::State;
use tauri_plugin_store::StoreExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderSettings {
    pub api_key: String,
    pub model: String,
    #[serde(default)]
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

const STORE_PATH: &str = "config.json";

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
                    *config.0.lock() = config_value.clone();
                    Ok(config_value)
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
    #[cfg(debug_assertions)]
    eprintln!(
        "UPDATING PROVIDER SETTINGS - PARAMS: {}",
        serde_json::to_string_pretty(&settings.parameters).unwrap_or_default()
    );

    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to access store: {}", e))?;

    // Update in-memory config
    let mut config_guard = config.0.lock();
    config_guard.providers.insert(provider.clone(), settings);

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
    if !config_guard.providers.contains_key(&provider) {
        return Err("Provider not found".to_string());
    }

    config_guard.active_provider = provider;

    // Save to store
    store.set("config", json!(config_guard.clone()));
    if let Err(e) = store.save() {
        return Err(format!("Failed to persist active provider: {}", e));
    }
    Ok(())
}
