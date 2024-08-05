use crate::chat::{clear_chat_history, get_chat_history, process_message, ChatHistory};
use crate::daemon::{is_runtimed_running, RuntimeDState, start_runtimed, stop_runtimed};
use crate::routes::{run_code};
use parking_lot;
use std::sync::Arc;

mod apimodels;
mod chat;
mod daemon;
mod routes;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ChatHistory(Arc::new(parking_lot::Mutex::new(Vec::new()))))
        .manage(parking_lot::Mutex::new(RuntimeDState {tx: None, running: false}))
        .invoke_handler(tauri::generate_handler![
            process_message,
            get_chat_history,
            clear_chat_history,
            stop_runtimed,
            start_runtimed,
            is_runtimed_running,
            run_code
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


