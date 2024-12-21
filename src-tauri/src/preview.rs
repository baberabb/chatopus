use std::fs;
use tauri::ipc::RuntimeCapability;
use tauri::Url;
use tauri::WebviewWindowBuilder;
use tauri::{Manager, WebviewUrl};

#[tauri::command]
pub async fn create_preview(
    app_handle: tauri::AppHandle,
    label: String,
    content: String,
    title: String,
    width: f64,
    height: f64,
) -> Result<(), String> {
    // Create a temporary directory if it doesn't exist
    let temp_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("previews");
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    // Create a temporary HTML file
    let file_path = temp_dir.join(format!("{}.html", label));
    fs::write(&file_path, content).map_err(|e| e.to_string())?;

    // Create and show the window
    let file_url = format!("file://{}", file_path.to_str().unwrap());
    print!("file_url: {}", &file_url);
    WebviewWindowBuilder::new(
        &app_handle,
        "gen_html",
        WebviewUrl::CustomProtocol(Url::parse(&file_url).map_err(|e| e.to_string())?),
    )
    .title("testing, testing...1, 2, 3")
    .build()
    .unwrap();
    Ok(())
}
