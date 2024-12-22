use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub api_key: String,
    pub model: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub custom_parameters: Option<HashMap<String, serde_json::Value>>,
    pub api_version: Option<String>,
    pub base_url: Option<String>,
    pub timeout_seconds: Option<u64>,
    pub retry_attempts: Option<u32>,
    pub additional_headers: Option<HashMap<String, String>>,
}

impl Default for ProviderConfig {
    fn default() -> Self {
        let mut parameters = HashMap::new();
        parameters.insert("max_tokens".to_string(), serde_json::json!(1000));
        parameters.insert("streaming".to_string(), serde_json::json!(true));
        parameters.insert("temperature".to_string(), serde_json::json!(0.7));

        Self {
            api_key: String::new(),
            model: String::new(),
            parameters,
            custom_parameters: None,
            api_version: None,
            base_url: None,
            timeout_seconds: Some(120),
            retry_attempts: Some(3),
            additional_headers: Some(HashMap::new()),
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
