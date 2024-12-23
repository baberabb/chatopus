use super::error::Error;
use super::types::ContentBlock;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

/// Event emitted during streaming responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamEvent {
    /// The content blocks from the stream
    pub content: Vec<ContentBlock>,
    /// Whether this is the final event in the stream
    pub done: bool,
}

/// Handler for processing streaming events
///
/// Providers will call the handler methods as they receive
/// streaming data. Implement this trait to handle the events
/// in a custom way.
#[async_trait::async_trait]
pub trait StreamHandler: Send + Sync {
    /// Handle a stream event
    ///
    /// Called for each chunk of text received from the stream.
    /// The handler can process the text in any way needed, such
    /// as displaying it to the user or accumulating it in a buffer.
    ///
    /// # Arguments
    /// * `event` - The stream event containing text and completion status
    ///
    /// # Returns
    /// * `Ok(())` if the event was handled successfully
    /// * `Err(Error)` if there was an error handling the event
    async fn handle_event(&self, event: StreamEvent) -> Result<(), Error>;
}

/// Simple stream handler that accumulates content blocks in a buffer
pub struct DefaultStreamHandler {
    buffer: Mutex<Vec<ContentBlock>>,
}

impl DefaultStreamHandler {
    /// Create a new default stream handler
    pub fn new() -> Self {
        Self {
            buffer: Mutex::new(Vec::new()),
        }
    }

    /// Get the accumulated content blocks
    pub async fn get_buffer(&self) -> Vec<ContentBlock> {
        self.buffer.lock().await.clone()
    }
}

#[async_trait::async_trait]
impl StreamHandler for DefaultStreamHandler {
    async fn handle_event(&self, event: StreamEvent) -> Result<(), Error> {
        if !event.content.is_empty() {
            let mut buffer = self.buffer.lock().await;
            buffer.extend(event.content);
        }
        Ok(())
    }
}
