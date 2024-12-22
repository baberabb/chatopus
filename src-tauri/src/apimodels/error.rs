use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug)]
pub enum ProviderError {
    RequestError(String),
    ResponseError { status: u16, message: String },
    RateLimit(String),
    Authentication(String),
    InvalidRequest(String),
    ServerError(String),
    ParseError(String),
}

impl fmt::Display for ProviderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::RequestError(msg) => write!(f, "Request error: {}", msg),
            Self::ResponseError { status, message } => {
                write!(f, "Response error ({}): {}", status, message)
            }
            Self::RateLimit(msg) => write!(f, "Rate limit error: {}", msg),
            Self::Authentication(msg) => write!(f, "Authentication error: {}", msg),
            Self::InvalidRequest(msg) => write!(f, "Invalid request: {}", msg),
            Self::ServerError(msg) => write!(f, "Server error: {}", msg),
            Self::ParseError(msg) => write!(f, "Parse error: {}", msg),
        }
    }
}

impl std::error::Error for ProviderError {}

// Add conversion to application ErrorResponse
impl From<ProviderError> for crate::database::chat::ErrorResponse {
    fn from(error: ProviderError) -> Self {
        Self {
            message: match &error {
                ProviderError::RequestError(_) => "API request failed".to_string(),
                ProviderError::ResponseError { .. } => "API response error".to_string(),
                ProviderError::RateLimit(_) => "Rate limit exceeded".to_string(),
                ProviderError::Authentication(_) => "Authentication failed".to_string(),
                ProviderError::InvalidRequest(_) => "Invalid request".to_string(),
                ProviderError::ServerError(_) => "Server error".to_string(),
                ProviderError::ParseError(_) => "Response parsing failed".to_string(),
            },
            details: Some(error.to_string()),
        }
    }
}

pub type ProviderResult<T> = Result<T, ProviderError>;
