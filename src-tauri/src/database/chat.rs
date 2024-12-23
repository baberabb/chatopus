use crate::apimodels::core::types::{Message, MessageReactions};
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
    pub parent_id: Option<i64>, // Added for versioning
    pub version: i64,           // Added for versioning
}

// Database models
use crate::apimodels::core::types::ContentBlock;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DbMessage {
    pub id: i64,
    pub conversation_id: i64,
    pub role: String,
    pub content: String, // JSON string of Vec<ContentBlock>
    pub created_at: String,
    pub metadata: Option<String>,
    pub original_message_id: Option<i64>, // Added for versioning
}

#[derive(Debug, sqlx::FromRow)]
pub struct ConversationRow {
    pub id: i64,
    pub title: String,   // COALESCE ensures non-null
    pub preview: String, // COALESCE ensures non-null
    pub model: String,   // COALESCE ensures non-null
    pub message_count: i64,
    pub timestamp: String,      // COALESCE ensures non-null
    pub parent_id: Option<i64>, // Added for versioning
    pub version: i64,           // Added for versioning
}

impl From<DbMessage> for Message {
    fn from(db_msg: DbMessage) -> Self {
        let timestamp = DateTime::parse_from_rfc3339(&db_msg.created_at)
            .map(|dt| dt.with_timezone(&Local).format("%I:%M %p").to_string())
            .unwrap_or_else(|_| Local::now().format("%I:%M %p").to_string());

        // Parse metadata if it exists
        let metadata = db_msg
            .metadata
            .and_then(|m| serde_json::from_str::<serde_json::Value>(&m).ok());

        // Extract model from metadata if it exists
        let model = metadata.as_ref().and_then(|v| {
            let json_value: &serde_json::Value = v;
            json_value
                .get("model")
                .and_then(|m| m.as_str())
                .map(String::from)
        });

        // Parse content as Vec<ContentBlock>, fallback to text block if parsing fails
        let content =
            serde_json::from_str::<Vec<ContentBlock>>(&db_msg.content).unwrap_or_else(|_| {
                vec![ContentBlock {
                    r#type: "text".to_string(),
                    text: Some(db_msg.content),
                    image_url: None,
                }]
            });

        Message {
            id: db_msg.id.to_string(),
            role: db_msg.role,
            content,
            timestamp,
            model,
            metadata,
            reactions: Some(MessageReactions { thumbs_up: 0 }),
            original_message_id: db_msg.original_message_id.map(|id| id.to_string()),
        }
    }
}

pub fn db_error(e: sqlx::Error) -> ErrorResponse {
    ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    }
}

/// Gets a valid conversation ID, creating one if necessary.
/// This is the single source of truth for conversation state.
pub async fn get_or_create_conversation_cached(app_state: &AppState) -> Result<i64, ErrorResponse> {
    let db = &app_state.db;
    let mut tx = db.begin().await.map_err(db_error)?;

    // Function to verify conversation exists
    #[derive(sqlx::FromRow)]
    struct Exists {
        exists_flag: i32,
    }

    async fn verify_conversation(
        tx: &mut Transaction<'_, Sqlite>,
        id: i64,
    ) -> Result<bool, ErrorResponse> {
        let exists = sqlx::query_as!(
            Exists,
            r#"SELECT COUNT(*) as "exists_flag!" FROM conversations WHERE id = ? AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='conversations')"#,
            id
        )
        .fetch_optional(&mut **tx)
        .await
        .map_err(db_error)?;
        Ok(exists.map_or(false, |e| e.exists_flag > 0))
    }

    // Try to use cached conversation if it exists and is valid
    if let Some(cached_id) = {
        let guard = app_state.conversation_id.lock();
        *guard
    } {
        if verify_conversation(&mut tx, cached_id).await? {
            tx.commit().await.map_err(db_error)?;
            return Ok(cached_id);
        }
    }

    // Clear invalid cache
    {
        let mut guard = app_state.conversation_id.lock();
        *guard = None;
    }

    // Try to get latest valid conversation
    let latest = sqlx::query!(
        r#"SELECT id as "id!" FROM conversations WHERE EXISTS (SELECT 1 FROM messages WHERE conversation_id = conversations.id) ORDER BY updated_at DESC LIMIT 1"#
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(db_error)?;

    if let Some(row) = latest {
        let id = row.id;
        tx.commit().await.map_err(db_error)?;

        // Update cache
        {
            let mut guard = app_state.conversation_id.lock();
            *guard = Some(id);
        }

        return Ok(id);
    }

    // Create new conversation within transaction
    sqlx::query!(
        r#"INSERT INTO conversations (created_at, updated_at) VALUES (datetime('now'), datetime('now'))"#
    )
    .execute(&mut *tx)
    .await
    .map_err(db_error)?;

    let new_id: i64 = sqlx::query_scalar!("SELECT last_insert_rowid()")
        .fetch_one(&mut *tx)
        .await
        .map_err(db_error)?
        .into();

    tx.commit().await.map_err(db_error)?;

    // Update cache with new conversation
    {
        let mut guard = app_state.conversation_id.lock();
        *guard = Some(new_id);
    }

    Ok(new_id)
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
                metadata,
                original_message_id as "original_message_id?"
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
            c.parent_id as "parent_id?",  -- Added
            c.version as "version!",       -- Added
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
            parent_id: row.parent_id,
            version: row.version,
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

pub async fn save_message(
    tx: &mut Transaction<'_, Sqlite>,
    conversation_id: i64,
    role: &str,
    content: Vec<ContentBlock>,
    model: Option<&str>,
    original_message_id: Option<i64>,
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

    // Serialize content blocks to JSON string
    let content_json = serde_json::to_string(&content).map_err(|e| ErrorResponse {
        message: "Failed to serialize content".to_string(),
        details: Some(e.to_string()),
    })?;

    // Insert the message with optional original_message_id
    sqlx::query!(
        r#"
        INSERT INTO messages (conversation_id, role, content, created_at, metadata, original_message_id)
        VALUES (?, ?, ?, datetime('now'), ?, ?)
        "#,
        conversation_id,
        role,
        content_json,
        metadata,
        original_message_id
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

    // Parse metadata if provided
    let metadata = metadata.and_then(|m| serde_json::from_str::<serde_json::Value>(&m).ok());

    let msg = Message {
        id: message_id.to_string(),
        role: role.to_string(),
        content: content,
        timestamp,
        model: model.map(String::from),
        metadata,
        reactions: Some(MessageReactions { thumbs_up: 0 }),
        original_message_id: original_message_id.map(|id| id.to_string()),
    };

    Ok(msg)
}

pub async fn create_conversation_version(
    tx: &mut Transaction<'_, Sqlite>,
    parent_id: i64,
) -> Result<i64, ErrorResponse> {
    // Get parent conversation info
    let parent = sqlx::query!(
        r#"
        SELECT model_id, settings, version 
        FROM conversations 
        WHERE id = ?
        "#,
        parent_id
    )
    .fetch_one(&mut **tx)
    .await
    .map_err(db_error)?;

    let new_version = parent.version + 1;

    // Create new version
    let result = sqlx::query!(
        r#"
        INSERT INTO conversations (
            parent_id, 
            version, 
            model_id, 
            settings,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        "#,
        parent_id,
        new_version,
        parent.model_id,
        parent.settings,
    )
    .execute(&mut **tx)
    .await
    .map_err(db_error)?;

    Ok(result.last_insert_rowid())
}
