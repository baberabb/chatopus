// use anyhow::Result;
// use base64::prelude::*;
// use bytes::Bytes;
// use log::{debug, error};
// use serde::{Deserialize, Serialize, Serializer};
// use serde_json::Value;
// use std::path::PathBuf;
// use std::collections::HashMap;
// use chrono;
// use tokio::sync::mpsc;
// 
// use jupyter_protocol::{Channel, ConnectionInfo, ExecuteRequest, Header, JupyterMessage, JupyterMessageContent};
// 
// #[derive(Serialize, Deserialize)]
// struct JupyterClientMessage {
//     header: Header,
//     parent_header: Option<Header>,
//     metadata: Value,
//     content: JupyterMessageContent,
//     #[serde(
//         serialize_with = "serialize_base64",
//         deserialize_with = "deserialize_base64"
//     )]
//     buffers: Vec<Bytes>,
//     channel: Option<Channel>,
// }
// 
// impl From<JupyterMessage> for JupyterClientMessage {
//     fn from(msg: JupyterMessage) -> Self {
//         JupyterClientMessage {
//             header: msg.header,
//             parent_header: msg.parent_header,
//             metadata: msg.metadata,
//             content: msg.content,
//             buffers: msg.buffers,
//             channel: msg.channel,
//         }
//     }
// }
// 
// impl From<JupyterClientMessage> for JupyterMessage {
//     fn from(msg: JupyterClientMessage) -> Self {
//         JupyterMessage {
//             zmq_identities: Vec::new(),
//             header: msg.header,
//             parent_header: msg.parent_header,
//             metadata: msg.metadata,
//             content: msg.content,
//             buffers: msg.buffers,
//             channel: msg.channel,
//         }
//     }
// }
// 
// // Custom serializer for Base64 encoding for buffers
// fn serialize_base64<S>(data: &[Bytes], serializer: S) -> Result<S::Ok, S::Error>
// where
//     S: Serializer,
// {
//     data.iter()
//         .map(|bytes| BASE64_STANDARD.encode(bytes))
//         .collect::<Vec<_>>()
//         .serialize(serializer)
// }
// 
// fn deserialize_base64<'de, D>(deserializer: D) -> Result<Vec<Bytes>, D::Error>
// where
//     D: serde::Deserializer<'de>,
// {
//     let encoded: Vec<String> = Vec::deserialize(deserializer)?;
//     encoded
//         .iter()
//         .map(|s| {
//             BASE64_STANDARD
//                 .decode(s)
//                 .map(Bytes::from)
//                 .map_err(serde::de::Error::custom)
//         })
//         .collect()
// }
// 
// pub struct JupyterClient {
//     iopub_rx: mpsc::Receiver<JupyterMessage>,
//     shell_tx: mpsc::Sender<JupyterMessage>,
//     session_id: String,
// }
// 
// impl JupyterClient {
//     pub async fn new(connection_file_path: PathBuf) -> Result<Self> {
//         let content = tokio::fs::read_to_string(&connection_file_path).await?;
//         let connection_info = serde_json::from_str::<ConnectionInfo>(&content)?;
// 
//         let session_id = format!("client-{}", uuid::Uuid::new_v4());
// 
//         let mut iopub = runtimelib::create_client_iopub_connection(
//             &connection_info,
//             "",
//             &session_id,
//         ).await?;
// 
//         let mut shell = runtimelib::create_client_shell_connection(
//             &connection_info,
//             &session_id
//         ).await?;
// 
//         let (shell_tx, mut shell_rx) = mpsc::channel::<JupyterMessage>(100);
//         let (iopub_tx, iopub_rx) = mpsc::channel::<JupyterMessage>(100);
// 
//         // Handle shell messages
//         tokio::spawn(async move {
//             while let Some(message) = shell_rx.recv().await {
//                 if let Err(e) = shell.send(message).await {
//                     error!("Failed to send shell message: {}", e);
//                 }
//             }
//         });
// 
//         // Handle IOPub messages
//         let iopub_tx = iopub_tx.clone();
//         tokio::spawn(async move {
//             while let Ok(message) = iopub.read().await {
//                 debug!("Received message from iopub: {:?}", message);
//                 if let Err(e) = iopub_tx.send(message).await {
//                     error!("Failed to forward IOPub message: {}", e);
//                     break;
//                 }
//             }
//         });
// 
//         Ok(Self {
//             iopub_rx,
//             shell_tx,
//             session_id,
//         })
//     }
// 
//     pub async fn execute_code(&self, code: String) -> Result<String> {
//         let msg_id = uuid::Uuid::new_v4().to_string();
// 
//         let content = JupyterMessageContent::ExecuteRequest(ExecuteRequest {
//             code,
//             silent: false,
//             store_history: true,
//             user_expressions: Some(HashMap::new()),
//             allow_stdin: false,
//             stop_on_error: true,
//         });
// 
//         let header = Header {
//             msg_id: msg_id.clone(),
//             session: self.session_id.clone(),
//             username: String::from("kernel"),
//             date: chrono::Utc::now().to_rfc3339().parse()?,
//             msg_type: String::from("execute_request"),
//             version: String::from("5.3"),
//         };
// 
//         let message = JupyterMessage {
//             zmq_identities: Vec::new(),
//             header,
//             parent_header: None,
//             metadata: Value::Object(Default::default()),
//             content: content,
//             buffers: Vec::new(),
//             channel: Some(Channel::Shell),
//         };
// 
//         self.shell_tx.send(message).await?;
//         Ok(msg_id)
//     }
// 
//     pub async fn receive_message(&mut self) -> Option<JupyterClientMessage> {
//         self.iopub_rx.recv().await.map(Into::into)
//     }
// }
// 
// // Example Tauri command
// #[tauri::command]
// pub async fn execute_jupyter_code(
//     state: tauri::State<'_, JupyterState>,
//     code: String,
// ) -> Result<String, String> {
//     let client = state.client.lock().await;
//     client.execute_code(code)
//         .await
//         .map_err(|e| e.to_string())
// }
// 
// pub struct JupyterState {
//     client: tokio::sync::Mutex<JupyterClient>,
// }
// 
// impl JupyterState {
//     pub async fn new(connection_file: PathBuf) -> Result<Self> {
//         let client = JupyterClient::new(connection_file).await?;
//         Ok(Self {
//             client: tokio::sync::Mutex::new(client)
//         })
//     }
// }
use anyhow::Result;
use base64::prelude::*;
use bytes::Bytes;
use log::{debug, error};
use serde::{Deserialize, Serialize, Serializer};
use serde_json::Value;
use std::path::PathBuf;
use std::collections::HashMap;
use tokio::sync::{mpsc, Mutex};
use std::sync::Arc;

use jupyter_protocol::{Channel, ConnectionInfo, ExecuteRequest, Header, JupyterMessage, JupyterMessageContent};

#[derive(Serialize, Deserialize)]
#[derive(Debug)]
pub struct JupyterClientMessage {
    header: Header,
    parent_header: Option<Header>,
    metadata: Value,
    content: JupyterMessageContent,
    #[serde(
        serialize_with = "serialize_base64",
        deserialize_with = "deserialize_base64"
    )]
    buffers: Vec<Bytes>,
    channel: Option<Channel>,
}

impl From<JupyterMessage> for JupyterClientMessage {
    fn from(msg: JupyterMessage) -> Self {
        JupyterClientMessage {
            header: msg.header,
            parent_header: msg.parent_header,
            metadata: msg.metadata,
            content: msg.content,
            buffers: msg.buffers,
            channel: msg.channel,
        }
    }
}

impl From<JupyterClientMessage> for JupyterMessage {
    fn from(msg: JupyterClientMessage) -> Self {
        JupyterMessage {
            zmq_identities: Vec::new(),
            header: msg.header,
            parent_header: msg.parent_header,
            metadata: msg.metadata,
            content: msg.content,
            buffers: msg.buffers,
            channel: msg.channel,
        }
    }
}

fn serialize_base64<S>(data: &[Bytes], serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    data.iter()
        .map(|bytes| BASE64_STANDARD.encode(bytes))
        .collect::<Vec<_>>()
        .serialize(serializer)
}

fn deserialize_base64<'de, D>(deserializer: D) -> Result<Vec<Bytes>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let encoded: Vec<String> = Vec::deserialize(deserializer)?;
    encoded
        .iter()
        .map(|s| {
            BASE64_STANDARD
                .decode(s)
                .map(Bytes::from)
                .map_err(serde::de::Error::custom)
        })
        .collect()
}

#[derive(Debug)]
pub struct JupyterClient {
    iopub_rx: Arc<Mutex<mpsc::Receiver<JupyterMessage>>>,
    shell_tx: Arc<mpsc::Sender<JupyterMessage>>,
    session_id: Arc<String>,
}

// Implement Send + Sync explicitly
unsafe impl Send for JupyterClient {}
unsafe impl Sync for JupyterClient {}

impl JupyterClient {
    pub async fn new(connection_file_path: PathBuf) -> Result<Self> {
        let content = tokio::fs::read_to_string(&connection_file_path).await?;
        let connection_info = serde_json::from_str::<ConnectionInfo>(&content)?;

        let session_id = format!("client-{}", uuid::Uuid::new_v4());

        let mut iopub = runtimelib::create_client_iopub_connection(
            &connection_info,
            "",
            &session_id,
        ).await?;

        let mut shell = runtimelib::create_client_shell_connection(
            &connection_info,
            &session_id
        ).await?;

        let (shell_tx, mut shell_rx) = mpsc::channel::<JupyterMessage>(100);
        let (iopub_tx, iopub_rx) = mpsc::channel::<JupyterMessage>(100);

        tokio::spawn(async move {
            while let Some(message) = shell_rx.recv().await {
                if let Err(e) = shell.send(message).await {
                    error!("Failed to send shell message: {}", e);
                }
            }
        });

        let iopub_tx = iopub_tx.clone();
        tokio::spawn(async move {
            while let Ok(message) = iopub.read().await {
                debug!("Received message from iopub: {:?}", message);
                if let Err(e) = iopub_tx.send(message).await {
                    error!("Failed to forward IOPub message: {}", e);
                    break;
                }
            }
        });

        Ok(Self {
            iopub_rx: Arc::new(Mutex::new(iopub_rx)),
            shell_tx: Arc::new(shell_tx),
            session_id: Arc::new(session_id),
        })
    }

    pub async fn execute_code(&self, code: String) -> Result<String> {
        let msg_id = uuid::Uuid::new_v4().to_string();

        let content = JupyterMessageContent::ExecuteRequest(ExecuteRequest {
            code,
            silent: false,
            store_history: true,
            user_expressions: Some(HashMap::new()),
            allow_stdin: false,
            stop_on_error: true,
        });

        let header = Header {
            msg_id: msg_id.clone(),
            session: self.session_id.as_ref().clone(),
            username: String::from("kernel"),
            date: chrono::Utc::now().to_rfc3339().parse()?,
            msg_type: String::from("execute_request"),
            version: String::from("5.3"),
        };

        let message = JupyterMessage {
            zmq_identities: Vec::new(),
            header,
            parent_header: None,
            metadata: Value::Object(Default::default()),
            content: content,
            buffers: Vec::new(),
            channel: Some(Channel::Shell),
        };

        self.shell_tx.send(message).await?;
        Ok(msg_id)
    }

    pub async fn receive_message(&self) -> Option<JupyterClientMessage> {
        let mut rx = self.iopub_rx.lock().await;
        rx.recv().await.map(Into::into)
    }
}