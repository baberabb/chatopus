use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: i64,
    pub message_id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub size: i64,
    pub url: String,
    pub preview_url: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SaveAttachmentRequest {
    pub message_id: i64,
    pub name: String,
    pub r#type: String,
    pub size: i64,
    pub file_path: String,
}

// Internal function that works with SqlitePool directly
pub(crate) async fn get_message_attachments_internal(
    db: &SqlitePool,
    message_id: i64,
) -> Result<Vec<Attachment>, String> {
    sqlx::query_as!(
        Attachment,
        r#"
        SELECT 
            id as "id!",
            message_id as "message_id!",
            name as "name!",
            type as "file_type!",
            size as "size!",
            path as "url!",
            preview_path as preview_url,
            created_at as "created_at!"
        FROM attachments
        WHERE message_id = ?
        "#,
        message_id
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn get_message_attachments<R: tauri::Runtime>(
    app_handle: tauri::AppHandle<R>,
    message_id: i64,
) -> Result<Vec<Attachment>, String> {
    let db = &app_handle.state::<crate::AppState>().db;
    get_message_attachments_internal(db, message_id).await
}

#[tauri::command]
pub async fn save_attachment<R: tauri::Runtime>(
    app_handle: tauri::AppHandle<R>,
    request: SaveAttachmentRequest,
) -> Result<Attachment, String> {
    let db = &app_handle.state::<crate::AppState>().db;

    // Create attachments directory if it doesn't exist
    let attachments_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("attachments");

    fs::create_dir_all(&attachments_dir)
        .map_err(|e| format!("Failed to create attachments directory: {}", e))?;

    // Generate unique filename
    let extension = Path::new(&request.name)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");
    let filename = format!("{}.{}", Uuid::new_v4(), extension);
    let file_path = attachments_dir.join(&filename);
    let file_path_str = file_path.to_str().unwrap().to_string();

    // Copy file to attachments directory
    fs::copy(&request.file_path, &file_path).map_err(|e| format!("Failed to copy file: {}", e))?;

    // Generate preview for images
    let preview_path_str = if request.r#type.starts_with("image/") {
        let preview_filename = format!("{}_preview.{}", Uuid::new_v4(), extension);
        let preview_path = attachments_dir.join(&preview_filename);

        // Load image and resize for preview
        let img = image::open(&file_path).map_err(|e| format!("Failed to open image: {}", e))?;
        let preview = img.resize(800, 800, image::imageops::FilterType::Lanczos3);
        preview
            .save(&preview_path)
            .map_err(|e| format!("Failed to save preview: {}", e))?;

        Some(preview_path.to_str().unwrap().to_string())
    } else {
        None
    };

    // Save attachment record to database
    let attachment = sqlx::query_as!(
        Attachment,
        r#"
        INSERT INTO attachments (message_id, name, type, size, path, preview_path)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING 
            id as "id!",
            message_id as "message_id!",
            name as "name!",
            type as "file_type!",
            size as "size!",
            path as "url!",
            preview_path as preview_url,
            created_at as "created_at!"
        "#,
        request.message_id,
        request.name,
        request.r#type,
        request.size,
        file_path_str,
        preview_path_str
    )
    .fetch_one(db)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(attachment)
}

#[tauri::command]
pub async fn delete_attachment<R: tauri::Runtime>(
    app_handle: tauri::AppHandle<R>,
    attachment_id: i64,
) -> Result<(), String> {
    let db = &app_handle.state::<crate::AppState>().db;

    // Get attachment paths before deleting
    let attachment = sqlx::query!(
        r#"
        SELECT path, preview_path
        FROM attachments
        WHERE id = ?
        "#,
        attachment_id
    )
    .fetch_one(db)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Delete files
    if let Err(e) = fs::remove_file(&attachment.path) {
        eprintln!("Failed to delete attachment file: {}", e);
    }
    if let Some(preview) = attachment.preview_path {
        if let Err(e) = fs::remove_file(preview) {
            eprintln!("Failed to delete preview file: {}", e);
        }
    }

    // Delete database record
    sqlx::query!(
        r#"
        DELETE FROM attachments
        WHERE id = ?
        "#,
        attachment_id
    )
    .execute(db)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(())
}
