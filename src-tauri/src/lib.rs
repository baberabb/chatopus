use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::Pool;
use sqlx::Sqlite;
use std::error::Error as StdError;
use std::str::FromStr;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::OnceCell;

type Db = Pool<Sqlite>;

mod apimodels;
mod chat;
mod config;
mod daemon;
mod routes;
mod jupyter;

use tauri::State;
use crate::jupyter::{JupyterClient, JupyterClientMessage};

// Global static to hold our initialized client
static JUPYTER_CLIENT: OnceCell<Arc<JupyterClient>> = OnceCell::const_new();

struct JupState {
    client: Arc<OnceCell<JupyterClient>>,
}

#[tauri::command]
async fn execute_code(
    state: State<'_, JupState>,
    code: String,
) -> Result<String, String> {
    let client = state.client.get()
        .ok_or("Client not initialized")?;
    client.execute_code(code)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn receive_message(
    state: State<'_, JupState>,
) -> Result<Option<JupyterClientMessage>, String> {
    let client = state.client.get()
        .ok_or("Client not initialized")?;
    let res = client.receive_message().await;
    println!("The result is {:#?}", &res);
    Ok(res)
}

async fn setup_db(data_dir: &std::path::Path) -> Result<Db, Box<dyn StdError>> {
    // Ensure data directory exists
    std::fs::create_dir_all(data_dir)?;

    // Setup database path
    let db_path = data_dir.join("chatopus.db");
    let db_url = format!("sqlite:{}", db_path.to_str().unwrap());

    println!("Database path: {}", db_path.display());
    println!("Database URL: {}", db_url);

    // Create connection options with foreign keys enabled
    let conn_opts = SqliteConnectOptions::from_str(&db_url)?
        .foreign_keys(true)
        .create_if_missing(true);

    // Create connection pool
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(conn_opts)
        .await?;

    println!("Database connection pool created");

    // Run migrations
    match sqlx::migrate!("./migrations").run(&pool).await {
        Ok(_) => {
            println!("Migrations executed successfully");

            // Verify tables exist
            let tables = sqlx::query!(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('conversations', 'messages', 'models')"
            )
            .fetch_all(&pool)
            .await?;

            println!(
                "Found tables: {:?}",
                tables.iter().map(|t| &t.name).collect::<Vec<_>>()
            );
        }
        Err(e) => {
            println!("Migration error: {}", e);
            return Err(Box::new(e));
        }
    }

    Ok(pool)
}

pub struct AppState {
    db: Db,
    pub conversation_id: parking_lot::Mutex<Option<i64>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = Arc::new(OnceCell::new());
    // Clone the Arc for use in our setup function
    let client_clone = client.clone();

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
            chat::get_conversations,
            chat::load_conversation_messages,
            chat::delete_conversation,
            config::get_config,
            config::update_config,
            config::update_provider_settings,
            config::set_active_provider,
            execute_code,
            receive_message,
        ])
        .setup(|app| {
            // Get data directory using app directly
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");

            println!("App data directory: {}", data_dir.display());

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
            app.manage(AppState {
                db,
                conversation_id: parking_lot::Mutex::new(None),
            });
            // TODO: move kernel init to seperate command
            // TODO: Add option to start new kernel/from connection file
            app.manage(JupState {client});
            tauri::async_runtime::spawn(async move {
                match JupyterClient::new("/Users/baber/Library/Jupyter/runtime/kernel-b52bf983-a859-4606-b059-91bc2ab9bd18.json".into()).await {
                    Ok(jupyter_client) => {
                        if let Err(e) = client_clone.set(jupyter_client) {
                            eprintln!("Failed to set client: {:?}", e);
                        }
                    },
                    Err(e) => {
                        eprintln!("Failed to initialize client: {:?}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
