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
    pub parent_id: Option<i64>,
    pub version: i64,
    pub system_message: Option<String>,
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
    pub original_message_id: Option<i64>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct ConversationRow {
    pub id: i64,
    pub title: String,
    pub preview: String,
    pub model: String,
    pub message_count: i64,
    pub timestamp: String,
    pub parent_id: Option<i64>,
    pub version: i64,
    pub system_message: Option<String>,
}

impl DbMessage {
    pub async fn into_message(
        self,
        db: &sqlx::Pool<sqlx::Sqlite>,
    ) -> Result<Message, ErrorResponse> {
        let timestamp = DateTime::parse_from_rfc3339(&self.created_at)
            .map(|dt| dt.with_timezone(&Local).format("%I:%M %p").to_string())
            .unwrap_or_else(|_| Local::now().format("%I:%M %p").to_string());

        let metadata = self
            .metadata
            .and_then(|m| serde_json::from_str::<serde_json::Value>(&m).ok());

        let model = metadata.as_ref().and_then(|v| {
            let json_value: &serde_json::Value = v;
            json_value
                .get("model")
                .and_then(|m| m.as_str())
                .map(String::from)
        });

        let content =
            serde_json::from_str::<Vec<ContentBlock>>(&self.content).unwrap_or_else(|_| {
                vec![ContentBlock {
                    r#type: "text".to_string(),
                    text: Some(self.content),
                    image_url: None,
                }]
            });

        // Fetch attachments for this message
        let attachments = crate::attachments::get_message_attachments_internal(db, self.id)
            .await
            .map_err(|e| ErrorResponse {
                message: "Failed to fetch attachments".to_string(),
                details: Some(e),
            })?;

        let attachments = if attachments.is_empty() {
            None
        } else {
            Some(attachments)
        };

        Ok(Message {
            id: self.id.to_string(),
            role: self.role,
            content,
            timestamp,
            model,
            metadata,
            reactions: Some(MessageReactions { thumbs_up: 0 }),
            attachments,
            original_message_id: self.original_message_id.map(|id| id.to_string()),
        })
    }
}

pub fn db_error(e: sqlx::Error) -> ErrorResponse {
    ErrorResponse {
        message: "Database error".to_string(),
        details: Some(e.to_string()),
    }
}

/// Creates a new conversation and returns its ID.
/// This is the single source of truth for conversation creation.
pub async fn create_conversation(
    db: &sqlx::Pool<sqlx::Sqlite>,
    parent_id: Option<i64>,
) -> Result<i64, ErrorResponse> {
    let mut tx = db.begin().await.map_err(db_error)?;

    // Get parent info if this is a version
    let (version, model_id, settings, system_message) = if let Some(parent_id) = parent_id {
        let parent = sqlx::query!(
            r#"
            SELECT model_id, settings, version, system_message
            FROM conversations 
            WHERE id = ?
            "#,
            parent_id
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(db_error)?;

        (
            parent.version + 1,
            parent.model_id,
            parent.settings,
            parent.system_message,
        )
    } else {
        (1, None, None, None)
    };

    // Create new conversation
    sqlx::query!(
        r#"
        INSERT INTO conversations (
            parent_id,
            version,
            model_id,
            settings,
            system_message,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        "#,
        parent_id,
        version,
        model_id,
        settings,
        system_message,
    )
    .execute(&mut *tx)
    .await
    .map_err(db_error)?;

    let new_id = sqlx::query_scalar!("SELECT last_insert_rowid()")
        .fetch_one(&mut *tx)
        .await
        .map_err(db_error)?;

    tx.commit().await.map_err(db_error)?;

    Ok(new_id)
}

/// Gets a valid conversation ID, creating one if necessary.
/// This function handles conversation caching and versioning.
pub async fn get_or_create_conversation_cached(app_state: &AppState) -> Result<i64, ErrorResponse> {
    let db = &app_state.db;
    let mut tx = db.begin().await.map_err(db_error)?;

    // Function to verify conversation exists and is valid
    async fn verify_conversation(
        tx: &mut Transaction<'_, Sqlite>,
        id: i64,
    ) -> Result<bool, ErrorResponse> {
        let exists = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) as count 
            FROM conversations c
            WHERE c.id = ? 
            AND EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='conversations')
            AND (
                EXISTS (SELECT 1 FROM messages WHERE conversation_id = c.id)
                OR c.created_at > datetime('now', '-1 hour')
            )
            "#,
            id
        )
        .fetch_optional(&mut **tx)
        .await
        .map_err(db_error)?;

        Ok(exists.map_or(false, |count| count > 0))
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
        r#"
        SELECT 
            c.id as "id!", 
            COALESCE(
                (SELECT parent_id FROM conversations WHERE id = c.id),
                c.id
            ) as "effective_id!"
        FROM conversations c
        WHERE EXISTS (SELECT 1 FROM messages WHERE conversation_id = c.id)
        ORDER BY c.updated_at DESC
        LIMIT 1
        "#
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(db_error)?;

    if let Some(row) = latest {
        // Use effective_id which is either the parent_id if it exists, or the conversation's own id
        let id = row.effective_id;
        tx.commit().await.map_err(db_error)?;

        // Update cache
        {
            let mut guard = app_state.conversation_id.lock();
            *guard = Some(id);
        }

        return Ok(id);
    }

    // Create new conversation if none exists
    tx.commit().await.map_err(db_error)?;
    let new_id = create_conversation(db, None).await?;

    // Update cache
    {
        let mut guard = app_state.conversation_id.lock();
        *guard = Some(new_id);
    }

    Ok(new_id)
}

pub async fn get_messages_for_conversation(
    db: &sqlx::Pool<sqlx::Sqlite>,
    conversation_id: i64,
) -> Result<Vec<Message>, ErrorResponse> {
    let db_messages = sqlx::query_as!(
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
    .map_err(db_error)?;

    let mut messages = Vec::with_capacity(db_messages.len());
    for db_msg in db_messages {
        messages.push(db_msg.into_message(db).await?);
    }

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
            c.parent_id as "parent_id?",
            c.version as "version!",
            c.system_message as "system_message?",
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
        WHERE c.parent_id IS NULL  -- Only show root conversations
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
            system_message: row.system_message,
        })
        .collect())
}

pub async fn update_conversation(
    db: &sqlx::Pool<sqlx::Sqlite>,
    conversation_id: i64,
    updates: serde_json::Value,
) -> Result<(), ErrorResponse> {
    let mut tx = db.begin().await.map_err(db_error)?;

    println!("Database updates: {:?}", updates);
    // Extract fields from updates
    if let Some(system_message) = updates.get("systemMessage") {
        println!("Found system message value: {:?}", system_message);
        let system_message = if system_message.is_null() {
            None
        } else {
            Some(system_message.as_str().unwrap_or_default())
        };
        println!("Converted system message: {:?}", system_message);
        sqlx::query!(
            r#"
            UPDATE conversations
            SET system_message = ?,
                updated_at = datetime('now')
            WHERE id = ?
            "#,
            system_message,
            conversation_id
        )
        .execute(&mut *tx)
        .await
        .map_err(db_error)?;
    }

    tx.commit().await.map_err(db_error)?;
    Ok(())
}

pub async fn delete_conversation(
    db: &sqlx::Pool<sqlx::Sqlite>,
    conversation_id: i64,
) -> Result<(), ErrorResponse> {
    let mut tx = db.begin().await.map_err(db_error)?;

    // Delete all child conversations first
    sqlx::query!(
        r#"
        DELETE FROM conversations
        WHERE parent_id = ?
        "#,
        conversation_id
    )
    .execute(&mut *tx)
    .await
    .map_err(db_error)?;

    // Then delete the conversation itself
    sqlx::query!(
        r#"
        DELETE FROM conversations
        WHERE id = ?
        "#,
        conversation_id
    )
    .execute(&mut *tx)
    .await
    .map_err(db_error)?;

    tx.commit().await.map_err(db_error)?;
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
        .map_err(db_error)?;

    let timestamp = Local::now().format("%I:%M %p").to_string();

    // Parse metadata if provided
    let metadata = metadata.and_then(|m| serde_json::from_str::<serde_json::Value>(&m).ok());

    let msg = Message {
        id: message_id.to_string(),
        role: role.to_string(),
        content,
        timestamp,
        model: model.map(String::from),
        metadata,
        reactions: Some(MessageReactions { thumbs_up: 0 }),
        attachments: None, // New messages start with no attachments
        original_message_id: original_message_id.map(|id| id.to_string()),
    };

    Ok(msg)
}
