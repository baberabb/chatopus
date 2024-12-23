use super::error::Error;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

/// Event emitted during streaming responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamEvent {
    /// The text chunk from the stream
    pub text: String,
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

/// Simple stream handler that accumulates text in a buffer
pub struct DefaultStreamHandler {
    buffer: Mutex<String>,
}

impl DefaultStreamHandler {
    /// Create a new default stream handler
    pub fn new() -> Self {
        Self {
            buffer: Mutex::new(String::new()),
        }
    }

    /// Get the accumulated text buffer
    pub async fn get_buffer(&self) -> String {
        self.buffer.lock().await.clone()
    }
}

#[async_trait::async_trait]
impl StreamHandler for DefaultStreamHandler {
    async fn handle_event(&self, event: StreamEvent) -> Result<(), Error> {
        if !event.text.is_empty() {
            let mut buffer = self.buffer.lock().await;
            buffer.push_str(&event.text);
        }
        Ok(())
    }
}
