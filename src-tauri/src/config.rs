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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub active_provider: String,
    pub providers: HashMap<String, ProviderSettings>,
}

impl Default for AppConfig {
    fn default() -> Self {
        let mut providers = HashMap::new();
        providers.insert(
            "anthropic".to_string(),
            ProviderSettings {
                api_key: String::new(),
                model: "claude-3-5-sonnet-20240620".to_string(),
                max_tokens: 1024,
                streaming: true,
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
    let store = app
        .store(STORE_PATH)
        .map_err(|e| format!("Failed to access store: {}", e))?;

    // Update in-memory config
    let mut config_guard = config.0.lock();
    config_guard.providers.insert(provider, settings);

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
