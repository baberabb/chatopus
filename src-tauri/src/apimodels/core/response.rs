use super::error::Error;

/// Handler for processing chat responses
#[async_trait::async_trait]
pub trait ResponseHandler: Send + Sync {
    /// Handle a response
    async fn handle_response(&self, response: &str) -> Result<(), Error>;
}
