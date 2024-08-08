use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SentMessage {
    pub role: String,
    pub content: String,
}


#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AnthropicRequest {
    pub model: String,
    pub messages: Vec<SentMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    pub max_tokens: u32,
    pub stream: bool,
   
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AnthropicResponse {
    pub completion: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AnthropicOutput {
    pub id: String,
    #[serde(rename = "type")]
    pub output_type: String,
    pub role: String,
    pub model: String,
    pub content: Vec<MessageOutput>,
    pub stop_reason: String,
    pub stop_message: Option<String>,
    pub usage: UsageOutput,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MessageOutput {
    #[serde(rename = "type")]
    pub message_type: String,
    pub text: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UsageOutput {
    pub input_tokens: u32,
    pub output_tokens: u32,
}
