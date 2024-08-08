// use crate::parking_lot::Mutex;
// use anyhow::Result;
// use std::net::IpAddr;
// use std::sync::Arc;
// use tauri::State;
// use tokio::sync::{mpsc};
// 
// 
// #[derive(Clone)]
// pub struct RuntimeDState {
//     pub tx: Option<mpsc::Sender<()>>,
//     pub running: bool,
// }
// 
// #[derive(Clone)]
// pub struct RuntimeDMessage {
//     pub command: RuntimeDCommand,
//     // Add any other fields you might need in the future
// }
// #[derive(Clone)]
// pub enum RuntimeDCommand {
//     Shutdown,
//     // Add other commands as needed
// }
// 
// #[tauri::command]
// pub async fn start_runtimed(runtimed: State<'_, Mutex<RuntimeDState>>) -> Result<(), String> {
//     // Check if already running without holding the lock for long
//     {
//         let state = runtimed.lock();
//         if state.running {
//             return Err("RuntimeD is already running".into());
//         }
//     }
// 
//     println!("Starting RuntimeD");
// 
//     let ip: IpAddr = "127.0.0.1"
//         .parse()
//         .map_err(|e| format!("Failed to parse IP address: {}", e))?;
//     let port = 8080;
//     let db_string = "sqlite:runtimed.db?mode=rwc";
// 
//     let tx = runtimed::daemon::start_runtimed(ip, port, db_string)
//         .await
//         .unwrap();
//     println!("Started RuntimeD");
//     // Update state after RuntimeD has started
//     let mut state = runtimed.lock();
//     state.tx = Some(tx);
//     state.running = true;
//     Ok(())
// }
// 
// #[tauri::command]
// pub async fn stop_runtimed(runtimes: State<'_, Mutex<RuntimeDState>>) -> Result<(), String> {
//     println!("Stopping RuntimeD");
//     let tx = {
//         let mut state = runtimes.lock();
//         state.tx.take()
//     };
//     
//     if let Some(tx) = tx {
//         tx.send(())
//             .await
//             .map_err(|e| format!("Failed to send shutdown signal: {}", e))?;
//         Ok(())
//     } else {
//         Err("RuntimeD is not running".into())
//     }
// }
// 
// #[tauri::command]
// pub async fn is_runtimed_running(runtimed: State<'_, Mutex<RuntimeDState>>) -> Result<bool, String> {
//     let state = runtimed.lock();
//     Ok(state.running.clone())
//     
// }
