use crate::chat::{clear_chat_history, get_chat_history, process_message, ChatHistory};
use crate::config::{
    get_config, set_active_provider, update_config, update_provider_settings, AppConfig,
    ConfigState,
};
use parking_lot;
use std::sync::Arc;
use sqlx::sqlite::SqlitePoolOptions;
use tauri_plugin_localhost;
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_store::StoreBuilder;
use std::fs::OpenOptions;
use tauri::{AppHandle, Manager};
use sqlx::Pool;
use sqlx::Sqlite;

type Db = Pool<Sqlite>;


mod apimodels;
mod chat;
mod config;
mod daemon;
mod migrations;
mod routes;


async fn setup_db(app: &AppHandle) -> Db {
    let mut path = app
        .path()
        .app_data_dir()
        .expect("could not get data_dir");
    match std::fs::create_dir_all(path.clone()) {
        Ok(_) => {}
        Err(err) => {
            panic!("error creating directory {}", err);
        }
    };
    path.push("db.sqlite");
    let result = OpenOptions::new().create_new(true).write(true).open(&path);
    match result {
        Ok(_) => println!("database file created"),
        Err(err) => match err.kind() {
            std::io::ErrorKind::AlreadyExists => println!("database file already exists"),
            _ => {
                panic!("error creating databse file {}", err);
            }
        },
    }
    let db = SqlitePoolOptions::new()
        .connect(path.to_str().unwrap())
        .await
        .unwrap();
    db
}

struct AppState {
    db: Db,
}

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
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(ChatHistory(Arc::new(parking_lot::Mutex::new(Vec::new()))))
        .manage(ConfigState(parking_lot::Mutex::new(AppConfig::default())))
        .manage(AppState { db })
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
