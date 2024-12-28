use async_trait::async_trait;
use futures_util::StreamExt;
use openai_api_rs::v1::chat_completion::{
    self, ChatCompletionMessage, ChatCompletionRequest, Content, MessageRole,
};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

use crate::apimodels::core::{
    error::{handlers::retry_with_backoff, Error},
    provider::{Provider, ProviderBuilder, ProviderCapabilities, ProviderOptions, TextCallback},
    types::{ChatResponse, ContentBlock, Message, TokenUsage},
};

const DEFAULT_API_VERSION: &str = "2020-11-07";
const API_ENDPOINT: &str = "https://api.openai.com/v1/chat/completions";

#[derive(Debug, Deserialize)]
struct StreamResponse {
    choices: Vec<StreamChoice>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    delta: DeltaContent,
}

#[derive(Debug, Deserialize)]
struct DeltaContent {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NonStreamingResponse {
    choices: Vec<Choice>,
    usage: Option<OpenAIUsage>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

pub struct OpenAIProvider {
    name: String,
    api_key: String,
    api_version: String,
    base_url: String,
    timeout_seconds: u64,
    retry_attempts: u32,
    parameters: std::collections::HashMap<String, serde_json::Value>,
    capabilities: ProviderCapabilities,
    client: reqwest::Client,
}

impl OpenAIProvider {
    pub fn new(builder: ProviderBuilder) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(
                builder.timeout_seconds.unwrap_or(120),
            ))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self {
            name: builder.name,
            api_key: builder.api_key,
            api_version: builder
                .api_version
                .unwrap_or_else(|| DEFAULT_API_VERSION.to_string()),
            base_url: builder.base_url.unwrap_or_else(|| API_ENDPOINT.to_string()),
            timeout_seconds: builder.timeout_seconds.unwrap_or(120),
            retry_attempts: builder.retry_attempts.unwrap_or(3),
            parameters: builder.parameters,
            client,
            capabilities: ProviderCapabilities {
                supports_streaming: true,
                supports_function_calls: true,
                supports_vision: true,
                max_context_length: 128000,
                supported_parameters: vec![
                    "temperature".to_string(),
                    "top_p".to_string(),
                    "frequency_penalty".to_string(),
                    "presence_penalty".to_string(),
                ],
            },
        }
    }

    fn convert_messages(messages: Vec<Message>) -> Vec<ChatCompletionMessage> {
        messages
            .into_iter()
            .map(|msg| {
                let role = match msg.role.as_str() {
                    "user" => MessageRole::user,
                    "assistant" => MessageRole::assistant,
                    "system" => MessageRole::system,
                    _ => MessageRole::user, // Default to user for unknown roles
                };

                // Convert content blocks to text
                let content = msg
                    .content
                    .into_iter()
                    .filter_map(|block| block.text)
                    .collect::<Vec<_>>()
                    .join(" ");

                ChatCompletionMessage {
                    role,
                    content: Content::Text(content),
                    name: None,
                    tool_calls: None,
                    tool_call_id: None,
                }
            })
            .collect()
    }

    fn create_request(
        &self,
        messages: Vec<Message>,
        options: &ProviderOptions,
    ) -> ChatCompletionRequest {
        let mut request = ChatCompletionRequest::new(
            options
                .model
                .clone()
                .unwrap_or_else(|| "gpt-4-turbo-preview".to_string()),
            Self::convert_messages(messages),
        );

        if let Some(temp) = options.temperature {
            request.temperature = Some(temp as f64);
        }
        if let Some(top_p) = options.top_p {
            request.top_p = Some(top_p as f64);
        }
        request.n = Some(1);
        request.stream = Some(options.stream);
        if let Some(max_tokens) = options.max_tokens {
            request.max_tokens = Some(max_tokens as i64);
        }
        if let Some(params) = &options.parameters {
            if let Some(presence_penalty) = params.get("presence_penalty").and_then(|v| v.as_f64())
            {
                request.presence_penalty = Some(presence_penalty);
            }
            if let Some(frequency_penalty) =
                params.get("frequency_penalty").and_then(|v| v.as_f64())
            {
                request.frequency_penalty = Some(frequency_penalty);
            }
        }

        request
    }

    async fn make_request(
        &self,
        request: &ChatCompletionRequest,
    ) -> Result<reqwest::Response, Error> {
        retry_with_backoff(self.retry_attempts, || async {
            let response = self
                .client
                .post(&self.base_url)
                .header("Content-Type", "application/json")
                .header("Authorization", format!("Bearer {}", self.api_key))
                .header("OpenAI-Version", &self.api_version)
                .json(request)
                .send()
                .await?;

            if !response.status().is_success() {
                let status = response.status();
                let error_text = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Failed to read error response".to_string());

                return Err(match status.as_u16() {
                    429 => Error::RateLimit(error_text),
                    401 | 403 => Error::Authentication(error_text),
                    400 => Error::InvalidRequest(error_text),
                    500..=599 => Error::ServerError(error_text),
                    _ => Error::ResponseError {
                        status: status.as_u16(),
                        message: error_text,
                    },
                });
            }

            Ok(response)
        })
        .await
    }
}

#[async_trait]
impl Provider for OpenAIProvider {
    fn capabilities(&self) -> &ProviderCapabilities {
        &self.capabilities
    }

    async fn send_message(
        &self,
        messages: Vec<Message>,
        options: ProviderOptions,
    ) -> Result<ChatResponse, Error> {
        let model = options.model.clone();
        let request = self.create_request(messages, &options);

        let response = self.make_request(&request).await?;
        let response_data: NonStreamingResponse = response.json().await?;

        let content = vec![ContentBlock {
            r#type: "text".to_string(),
            text: Some(response_data.choices[0].message.content.clone()),
            image_url: None,
        }];

        Ok(ChatResponse {
            content,
            model,
            usage: response_data.usage.map(|u| TokenUsage {
                prompt_tokens: u.prompt_tokens,
                completion_tokens: u.completion_tokens,
                total_tokens: u.total_tokens,
            }),
            metadata: None,
        })
    }

    async fn send_message_streaming(
        &self,
        messages: Vec<Message>,
        options: ProviderOptions,
        on_text: TextCallback,
        mut cancel_token: broadcast::Receiver<()>,
    ) -> Result<(), Error> {
        let request = self.create_request(messages, &options);
        let response = self.make_request(&request).await?;
        let mut stream = response.bytes_stream();

        loop {
            tokio::select! {
                chunk_result = stream.next() => {
                    match chunk_result {
                        Some(Ok(chunk)) => {
                            let chunk_str = String::from_utf8_lossy(&chunk);
                            for line in chunk_str.lines() {
                                if line.is_empty() { continue; }

                                if let Some(data) = line.strip_prefix("data: ") {
                                    if data == "[DONE]" {
                                        return Ok(());
                                    }

                                    match serde_json::from_str::<StreamResponse>(data) {
                                        Ok(stream_response) => {
                                            if let Some(text) = stream_response
                                                .choices
                                                .get(0)
                                                .and_then(|c| c.delta.content.as_ref())
                                            {
                                                on_text(text.clone())?;
                                            }
                                        }
                                        Err(e) => {
                                            return Err(Error::ParseError(e.to_string()));
                                        }
                                    }
                                }
                            }
                        }
                        Some(Err(e)) => {
                            return Err(Error::StreamError(e.to_string()));
                        }
                        None => {
                            return Ok(());
                        }
                    }
                }
                _ = cancel_token.recv() => {
                    on_text("\n[Cancelled]".into())?;
                    return Ok(());
                }
            }
        }
    }
}
