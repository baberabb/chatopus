use serde::{Deserialize, Serialize};

use super::error::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamResponse {
    pub text: String,
    pub is_done: bool,
}

#[async_trait::async_trait]
pub trait StreamHandler: Send + Sync {
    /// Handle a text chunk from the stream
    async fn handle_chunk(&self, text: String) -> std::result::Result<(), Error>;

    /// Handle stream completion
    fn handle_done(&self);

    /// Handle any errors that occur during streaming
    fn handle_error(&self, error: Error);
}

// Default implementations for common stream handling
pub mod defaults {
    use super::*;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    pub struct DefaultStreamHandler {
        buffer: Arc<Mutex<String>>,
    }

    impl DefaultStreamHandler {
        pub fn new() -> Self {
            Self {
                buffer: Arc::new(Mutex::new(String::new())),
            }
        }

        pub async fn get_buffer(&self) -> String {
            self.buffer.lock().await.clone()
        }
    }

    #[async_trait::async_trait]
    impl StreamHandler for DefaultStreamHandler {
        async fn handle_chunk(&self, text: String) -> std::result::Result<(), Error> {
            let mut buffer = self.buffer.lock().await;
            buffer.push_str(&text);
            Ok(())
        }

        fn handle_done(&self) {
            // Default implementation does nothing on completion
        }

        fn handle_error(&self, error: Error) {
            eprintln!("Stream error: {:?}", error);
        }
    }
}
