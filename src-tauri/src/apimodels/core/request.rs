use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RequestOptions {
    pub streaming: bool,
    pub max_tokens: Option<u32>,
    pub parameters: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug)]
pub struct RequestBuilder {
    headers: HashMap<String, String>,
    url: String,
    body: serde_json::Value,
    timeout_seconds: Option<u64>,
    retry_attempts: Option<u32>,
}

impl RequestBuilder {
    pub fn new(url: impl Into<String>) -> Self {
        Self {
            headers: HashMap::new(),
            url: url.into(),
            body: serde_json::Value::Null,
            timeout_seconds: None,
            retry_attempts: None,
        }
    }

    pub fn with_header(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.headers.insert(key.into(), value.into());
        self
    }

    pub fn with_headers(mut self, headers: HashMap<String, String>) -> Self {
        self.headers.extend(headers);
        self
    }

    pub fn with_json_body(mut self, body: impl Serialize) -> Self {
        self.body = serde_json::to_value(body).unwrap_or(serde_json::Value::Null);
        self
    }

    pub fn with_timeout(mut self, seconds: u64) -> Self {
        self.timeout_seconds = Some(seconds);
        self
    }

    pub fn with_retries(mut self, attempts: u32) -> Self {
        self.retry_attempts = Some(attempts);
        self
    }

    pub fn merge_parameters(
        &self,
        provider_params: Option<&HashMap<String, serde_json::Value>>,
        custom_params: Option<&HashMap<String, serde_json::Value>>,
        request_params: Option<&HashMap<String, serde_json::Value>>,
    ) -> HashMap<String, serde_json::Value> {
        let mut merged = HashMap::new();

        // Start with provider parameters
        if let Some(params) = provider_params {
            merged.extend(params.clone());
        }

        // Override with custom parameters
        if let Some(params) = custom_params {
            merged.extend(params.clone());
        }

        // Finally override with request-specific parameters
        if let Some(params) = request_params {
            merged.extend(params.clone());
        }

        merged
    }

    pub fn build(self) -> reqwest::RequestBuilder {
        let client = reqwest::Client::builder();

        let client = if let Some(timeout) = self.timeout_seconds {
            client.timeout(std::time::Duration::from_secs(timeout))
        } else {
            client
        };

        let client = client.build().unwrap_or_else(|_| reqwest::Client::new());

        let mut builder = client.post(&self.url);

        // Add headers
        for (key, value) in self.headers {
            builder = builder.header(key, value);
        }

        // Add body if present
        if self.body != serde_json::Value::Null {
            builder = builder.json(&self.body);
        }

        builder
    }
}
