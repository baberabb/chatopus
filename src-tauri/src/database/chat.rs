use crate::apimodels::Message;
use crate::AppState;
use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use sqlx::{Sqlite, Transaction};

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub message: String,
    pub details: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversationInfo {
    pub id: i64,
    pub title: String,
    pub preview: String,
    pub model: String,
    pub message_count: i64,
    pub timestamp: String,
}

// Database models
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DbMessage {
    pub id: i64,
    pub conversation_id: i64,
    pub role: String,
    pub content: String,
    pub created_at: String,
    pub metadata: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct ConversationRow {
    pub id: i64,
    pub title: String,   // COALESCE ensures non-null
    pub preview: String, // COALESCE ensures non-null
    pub model: String,   // COALESCE ensures non-null
    pub message_count: i64,
    pub timestamp: String, // COALESCE ensures non-null
}

impl From<DbMessage> for Message {
    fn from(db_msg: DbMessage) -> Self {
        let timestamp = DateTime::parse_from_rfc3339(&db_msg.created_at)
            .map(|dt| dt.with_timezone(&Local).format("%I:%M %p").to_string())
            .unwrap_or_else(|_| Local::now().format("%I:%M %p").to_string());

        // Extract model from metadata if it exists
        let model = db_msg.metadata.and_then(|metadata| {
            serde_json::from_str::<serde_json::Value>(&metadata)
                .ok()
                .and_then(|v| v.get("model").and_then(|m| m.as_str()).map(String::from))
        });

        Message {
            id: db_msg.id.to_string(),
            role: db_msg.role,
            content: db_msg.content,
            timestamp,
            reactions: Some(crate::apimodels::MessageReactions { thumbs_up: 0 }),
            model,
        }
    }
}

pub fn db_error(e: sqlx::Error) -> ErrorResponse {
    ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    }
}

/// Gets the latest conversation ID or creates a new one if none exists.
/// Caches the result in AppState.
pub async fn get_or_create_conversation_cached(app_state: &AppState) -> Result<i64, ErrorResponse> {
    let db = &app_state.db;

    // First check if the cached conversation still exists
    let cached_id = {
        let guard = app_state.conversation_id.lock();
        *guard
    };

    if let Some(cid) = cached_id {
        // Verify the conversation exists
        if let Some(row) =
            sqlx::query!(r#"SELECT id as "id!" FROM conversations WHERE id = ?"#, cid)
                .fetch_optional(db)
                .await
                .map_err(db_error)?
        {
            return Ok(row.id);
        }
        // If we get here, the cached conversation doesn't exist anymore
        // Clear the cache
        {
            let mut guard = app_state.conversation_id.lock();
            *guard = None;
        }
    }

    // Try to get the latest conversation
    if let Some(row) =
        sqlx::query!(r#"SELECT id as "id!" FROM conversations ORDER BY updated_at DESC LIMIT 1"#)
            .fetch_optional(db)
            .await
            .map_err(db_error)?
    {
        let mut guard = app_state.conversation_id.lock();
        *guard = Some(row.id);
        return Ok(row.id);
    }

    // No existing conversation found, create a new one
    sqlx::query!(
        r#"
        INSERT INTO conversations (created_at, updated_at)
        VALUES (datetime('now'), datetime('now'))
        "#
    )
    .execute(db)
    .await
    .map_err(db_error)?;

    let id: i64 = sqlx::query_scalar!("SELECT last_insert_rowid()")
        .fetch_one(db)
        .await
        .map_err(db_error)?
        .into();

    {
        let mut guard = app_state.conversation_id.lock();
        *guard = Some(id);
    }

    Ok(id)
}

pub async fn create_conversation(db: &sqlx::Pool<sqlx::Sqlite>) -> Result<i64, ErrorResponse> {
    // Create a new conversation
    sqlx::query!(
        r#"
        INSERT INTO conversations (created_at, updated_at)
        VALUES (datetime('now'), datetime('now'))
        "#
    )
    .execute(db)
    .await
    .map_err(db_error)?;

    // Get the new conversation ID
    let new_id: i64 = sqlx::query_scalar!("SELECT last_insert_rowid()")
        .fetch_one(db)
        .await
        .map_err(db_error)?
        .into();

    Ok(new_id)
}

pub async fn get_messages_for_conversation(
    db: &sqlx::Pool<sqlx::Sqlite>,
    conversation_id: i64,
) -> Result<Vec<Message>, ErrorResponse> {
    let messages = sqlx::query_as!(
        DbMessage,
        r#"
            SELECT 
                id as "id!",
                conversation_id as "conversation_id!",
                role as "role!",
                content as "content!",
                created_at as "created_at!",
                metadata
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
        "#,
        conversation_id
    )
    .fetch_all(db)
    .await
    .map_err(db_error)?
    .into_iter()
    .map(Message::from)
    .collect::<Vec<Message>>();

    Ok(messages)
}

pub async fn get_all_conversations(
    db: &sqlx::Pool<sqlx::Sqlite>,
) -> Result<Vec<ConversationInfo>, ErrorResponse> {
    let conversations = sqlx::query_as!(
        ConversationRow,
        r#"
        SELECT 
            c.id as "id!",
            COALESCE(
                (SELECT content FROM messages 
                WHERE conversation_id = c.id 
                AND role = 'user' 
                ORDER BY created_at ASC 
                LIMIT 1),
                'New Chat'
            ) as "title!: String",
            COALESCE(
                (SELECT content FROM messages 
                WHERE conversation_id = c.id 
                ORDER BY created_at DESC 
                LIMIT 1),
                ''
            ) as "preview!: String",
            COALESCE(
                (SELECT json_extract(metadata, '$.model')
                FROM messages 
                WHERE conversation_id = c.id 
                AND metadata IS NOT NULL 
                ORDER BY created_at DESC 
                LIMIT 1),
                'Unknown Model'
            ) as "model!: String",
            COALESCE(
                (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id),
                0
            ) as "message_count!: i64",
            COALESCE(
                (SELECT created_at FROM messages 
                WHERE conversation_id = c.id 
                ORDER BY created_at DESC 
                LIMIT 1),
                c.created_at
            ) as "timestamp!: String"
        FROM conversations c
        ORDER BY c.updated_at DESC
        "#
    )
    .fetch_all(db)
    .await
    .map_err(db_error)?;

    Ok(conversations
        .into_iter()
        .map(|row| ConversationInfo {
            id: row.id,
            title: row.title,
            preview: row.preview,
            model: row.model,
            message_count: row.message_count,
            timestamp: row.timestamp,
        })
        .collect())
}

pub async fn delete_conversation(
    db: &sqlx::Pool<sqlx::Sqlite>,
    conversation_id: i64,
) -> Result<(), ErrorResponse> {
    sqlx::query!(
        r#"
        DELETE FROM conversations
        WHERE id = ?
        "#,
        conversation_id
    )
    .execute(db)
    .await
    .map_err(db_error)?;

    Ok(())
}

pub async fn get_messages_for_conversation_cached(
    db: &sqlx::Pool<sqlx::Sqlite>,
    conversation_id: i64,
) -> Result<Vec<Message>, ErrorResponse> {
    let messages = sqlx::query_as!(
        DbMessage,
        r#"
            SELECT 
                id as "id!",
                conversation_id as "conversation_id!",
                role as "role!",
                content as "content!",
                created_at as "created_at!",
                metadata
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
        "#,
        conversation_id
    )
    .fetch_all(db)
    .await
    .map_err(db_error)?
    .into_iter()
    .map(Message::from)
    .collect::<Vec<Message>>();

    Ok(messages)
}

pub async fn save_message(
    tx: &mut Transaction<'_, Sqlite>,
    conversation_id: i64,
    role: &str,
    content: &str,
    model: Option<&str>,
) -> Result<Message, ErrorResponse> {
    // Update conversation timestamp
    sqlx::query!(
        r#"
        UPDATE conversations 
        SET updated_at = datetime('now')
        WHERE id = ?
        "#,
        conversation_id
    )
    .execute(&mut **tx)
    .await
    .map_err(db_error)?;

    // Create metadata JSON if model is provided
    let metadata = model.map(|m| format!(r#"{{"model":"{}"}}"#, m));

    // Insert the message
    sqlx::query!(
        r#"
        INSERT INTO messages (conversation_id, role, content, created_at, metadata)
        VALUES (?, ?, ?, datetime('now'), ?)
        "#,
        conversation_id,
        role,
        content,
        metadata
    )
    .execute(&mut **tx)
    .await
    .map_err(db_error)?;

    // Fetch last inserted message id
    let message_id: i64 = sqlx::query_scalar!("SELECT last_insert_rowid()")
        .fetch_one(&mut **tx)
        .await
        .map_err(db_error)?
        .into();

    let timestamp = Local::now().format("%I:%M %p").to_string();
    let msg = Message {
        id: message_id.to_string(),
        role: role.to_string(),
        content: content.to_string(),
        timestamp,
        reactions: Some(crate::apimodels::MessageReactions { thumbs_up: 0 }),
        model: model.map(String::from),
    };

    Ok(msg)
}
