-- Add migration script
CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    args TEXT,  -- JSON string for model arguments
    parent TEXT
);

CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    model_id TEXT,
    settings TEXT,  -- JSON string for conversation settings
    FOREIGN KEY (model_id) REFERENCES models(id)
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL,  -- 'user', 'assistant', or 'system'
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    metadata TEXT,  -- JSON string for any additional metadata
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Index for faster message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
ON messages(conversation_id);

-- Index for faster conversation updates
CREATE INDEX IF NOT EXISTS idx_conversations_updated 
ON conversations(updated_at);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at 
ON messages(conversation_id, created_at);
