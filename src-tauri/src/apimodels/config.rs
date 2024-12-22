use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub api_key: String,
    pub model: String,
    pub max_tokens: u32,
    pub api_version: Option<String>,
    pub base_url: Option<String>,
    pub timeout_seconds: Option<u64>,
    pub retry_attempts: Option<u32>,
    pub additional_headers: Option<HashMap<String, String>>,
    pub additional_params: Option<std::collections::HashMap<String, serde_json::Value>>,
}

impl Default for ProviderConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: String::new(),
            max_tokens: 1000,
            api_version: None,
            base_url: None,
            timeout_seconds: Some(120),
            retry_attempts: Some(3),
            additional_headers: Some(HashMap::new()),
            additional_params: Some(HashMap::new()),
        }
    }
}

#[derive(Debug, Clone)]
pub struct RequestConfig {
    pub streaming: bool,
    pub retry_on_rate_limit: bool,
    pub timeout_seconds: Option<u64>,
}

impl Default for RequestConfig {
    fn default() -> Self {
        Self {
            streaming: false,
            retry_on_rate_limit: true,
            timeout_seconds: None,
        }
    }
}
