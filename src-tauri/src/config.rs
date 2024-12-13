use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

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

#[tauri::command]
pub async fn get_config(config: State<'_, ConfigState>) -> Result<AppConfig, String> {
    Ok(config.0.lock().clone())
}

#[tauri::command]
pub async fn update_config(
    new_config: AppConfig,
    config: State<'_, ConfigState>,
) -> Result<(), String> {
    *config.0.lock() = new_config;
    Ok(())
}

#[tauri::command]
pub async fn update_provider_settings(
    provider: String,
    settings: ProviderSettings,
    config: State<'_, ConfigState>,
) -> Result<(), String> {
    let mut config = config.0.lock();
    config.providers.insert(provider, settings);
    Ok(())
}

#[tauri::command]
pub async fn set_active_provider(
    provider: String,
    config: State<'_, ConfigState>,
) -> Result<(), String> {
    let mut config = config.0.lock();
    if config.providers.contains_key(&provider) {
        config.active_provider = provider;
        Ok(())
    } else {
        Err("Provider not found".to_string())
    }
}
