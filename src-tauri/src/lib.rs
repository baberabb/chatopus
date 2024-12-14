use parking_lot;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::Pool;
use sqlx::Sqlite;
use std::error::Error as StdError;
use std::sync::Arc;
use tauri::Manager;

type Db = Pool<Sqlite>;

mod apimodels;
mod chat;
mod config;
mod daemon;
mod routes;

async fn setup_db(data_dir: &std::path::Path) -> Result<Db, Box<dyn StdError>> {
    // Ensure data directory exists
    std::fs::create_dir_all(data_dir)?;

    // Setup database path
    let db_path = data_dir.join("db.sqlite");
    let db_url = format!("sqlite:{}", db_path.to_str().unwrap());

    // Create connection pool
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    // Run migrations
    match sqlx::migrate!("./migrations").run(&pool).await {
        Ok(_) => {
            println!("Migrations executed successfully");
        }
        Err(e) => {
            if !e
                .to_string()
                .contains("was previously applied but has been modified")
            {
                return Err(Box::new(e));
            }
            println!("Ignoring modified migration error");
        }
    }

    Ok(pool)
}

struct AppState {
    db: Db,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            chat::process_message,
            chat::get_chat_history,
            chat::clear_chat_history,
            config::get_config,
            config::update_config,
            config::update_provider_settings,
            config::set_active_provider,
        ])
        .setup(|app| {
            // Get data directory using app directly
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");

            // Initialize database
            let runtime = tokio::runtime::Runtime::new()?;
            let db = runtime.block_on(setup_db(&data_dir))?;

            // Setup app state using app directly
            app.manage(chat::ChatHistory(Arc::new(parking_lot::Mutex::new(
                Vec::new(),
            ))));
            app.manage(config::ConfigState(parking_lot::Mutex::new(
                config::AppConfig::default(),
            )));
            app.manage(AppState { db });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
