use crate::chat::{clear_chat_history, get_chat_history, process_message, ChatHistory};
// use crate::daemon::{is_runtimed_running, RuntimeDState, start_runtimed, stop_runtimed};
// use crate::routes::{run_code};
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_localhost;
// use tauri::{webview::WebviewWindowBuilder, WebviewUrl};
use tauri_plugin_sql;

use parking_lot;
use std::sync::Arc;

mod apimodels;
mod chat;
mod daemon;
mod routes;
mod migrations;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port: u16 = 9527;

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::new().targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::LogDir { file_name: None }),
            Target::new(TargetKind::Webview),
        ]).build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(ChatHistory(Arc::new(parking_lot::Mutex::new(Vec::new()))))
        // .setup(move |app| {
        //     let url = format!("http://localhost:{}", port).parse().unwrap();
        //     WebviewWindowBuilder::new(app, "main1".to_string(), WebviewUrl::External(url))
        //         .title("Localhost Example")
        //         .build()?;
        //     Ok(())
        // })
        // .manage(parking_lot::Mutex::new(RuntimeDState {tx: None, running: false}))
        .invoke_handler(tauri::generate_handler![
            process_message,
            get_chat_history,
            clear_chat_history,
            // stop_runtimed,
            // start_runtimed,
            // is_runtimed_running,
            // run_code
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


