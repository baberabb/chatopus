use std::fmt;

#[derive(Debug)]
pub enum Error {
    RequestError(String),
    ResponseError { status: u16, message: String },
    ParseError(String),
    RateLimit(String),
    Authentication(String),
    InvalidRequest(String),
    ServerError(String),
    StreamError(String),
    Cancelled,
}

impl std::error::Error for Error {}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::RequestError(msg) => write!(f, "Request error: {}", msg),
            Error::ResponseError { status, message } => {
                write!(f, "Response error ({}): {}", status, message)
            }
            Error::ParseError(msg) => write!(f, "Parse error: {}", msg),
            Error::RateLimit(msg) => write!(f, "Rate limit exceeded: {}", msg),
            Error::Authentication(msg) => write!(f, "Authentication error: {}", msg),
            Error::InvalidRequest(msg) => write!(f, "Invalid request: {}", msg),
            Error::ServerError(msg) => write!(f, "Server error: {}", msg),
            Error::StreamError(msg) => write!(f, "Stream error: {}", msg),
            Error::Cancelled => write!(f, "Operation cancelled"),
        }
    }
}

impl From<reqwest::Error> for Error {
    fn from(error: reqwest::Error) -> Self {
        if error.is_timeout() {
            Error::RequestError("Request timed out".to_string())
        } else if error.is_connect() {
            Error::RequestError("Connection failed".to_string())
        } else {
            Error::RequestError(error.to_string())
        }
    }
}

impl From<serde_json::Error> for Error {
    fn from(error: serde_json::Error) -> Self {
        Error::ParseError(error.to_string())
    }
}

pub trait ErrorExt {
    fn is_retryable(&self) -> bool;
}

impl ErrorExt for Error {
    fn is_retryable(&self) -> bool {
        matches!(
            self,
            Error::RateLimit(_) | Error::ServerError(_) | Error::RequestError(_)
        )
    }
}

// Helper functions for common error handling scenarios
pub mod handlers {
    use super::*;
    use reqwest::Response;

    pub async fn handle_response_error(response: Response) -> std::result::Result<Response, Error> {
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Failed to read error response".to_string());

            return match status.as_u16() {
                429 => Err(Error::RateLimit(error_text)),
                401 | 403 => Err(Error::Authentication(error_text)),
                400 => Err(Error::InvalidRequest(error_text)),
                500..=599 => Err(Error::ServerError(error_text)),
                _ => Err(Error::ResponseError {
                    status: status.as_u16(),
                    message: error_text,
                }),
            };
        }
        Ok(response)
    }

    pub async fn retry_with_backoff<F, Fut, T>(
        retries: u32,
        operation: F,
    ) -> std::result::Result<T, Error>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = std::result::Result<T, Error>>,
    {
        let mut attempt = 0;
        loop {
            match operation().await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    attempt += 1;
                    if attempt >= retries || !e.is_retryable() {
                        return Err(e);
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(2u64.pow(attempt))).await;
                }
            }
        }
    }
}
