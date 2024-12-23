use super::{error::Error, types::ChatResponse};

pub trait ResponseHandler: Send + Sync {
    fn handle_response(&self, response: ChatResponse) -> std::result::Result<ChatResponse, Error>;
}

// Default implementations for common response handling
pub mod defaults {
    use super::*;

    pub struct DefaultResponseHandler;

    impl ResponseHandler for DefaultResponseHandler {
        fn handle_response(
            &self,
            response: ChatResponse,
        ) -> std::result::Result<ChatResponse, Error> {
            Ok(response)
        }
    }
}
