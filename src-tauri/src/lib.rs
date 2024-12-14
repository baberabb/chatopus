use crate::chat::{clear_chat_history, get_chat_history, process_message, ChatHistory};
use crate::config::{
    get_config, set_active_provider, update_config, update_provider_settings, AppConfig,
    ConfigState,
};
use parking_lot;
use std::sync::Arc;
use tauri_plugin_localhost;
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_sql;
use tauri_plugin_store::StoreBuilder;

mod apimodels;
mod chat;
mod config;
mod daemon;
mod migrations;
mod routes;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port: u16 = 9527;

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(ChatHistory(Arc::new(parking_lot::Mutex::new(Vec::new()))))
        .manage(ConfigState(parking_lot::Mutex::new(AppConfig::default())))
        .invoke_handler(tauri::generate_handler![
            process_message,
            get_chat_history,
            clear_chat_history,
            get_config,
            update_config,
            update_provider_settings,
            set_active_provider,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
