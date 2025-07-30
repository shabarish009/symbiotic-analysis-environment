//! AI Engine Communication Module
//! 
//! Handles JSON-RPC communication between the Tauri shell and Python AI Core

use crate::ai_engine::types::{JsonRpcMessage, JsonRpcResponse, AIEngineError};
use serde_json;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Child;
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::{timeout, Duration};
use uuid::Uuid;

/// IPC Channel for JSON-RPC communication
pub struct IPCChannel {
    /// Child process handle
    process: Arc<Mutex<Option<Child>>>,
    
    /// Stdin writer
    stdin_writer: Arc<Mutex<Option<tokio::process::ChildStdin>>>,
    
    /// Pending requests waiting for responses
    pending_requests: Arc<RwLock<HashMap<String, tokio::sync::oneshot::Sender<JsonRpcResponse>>>>,
    
    /// Message sender for outgoing messages
    message_sender: mpsc::UnboundedSender<JsonRpcMessage>,
    
    /// Notification receiver for incoming notifications
    notification_receiver: Arc<Mutex<mpsc::UnboundedReceiver<JsonRpcMessage>>>,
    
    /// Response receiver for incoming responses
    response_receiver: Arc<Mutex<mpsc::UnboundedReceiver<JsonRpcResponse>>>,
}

impl IPCChannel {
    /// Create a new IPC channel
    pub fn new() -> Self {
        let (message_sender, _message_receiver) = mpsc::unbounded_channel();
        let (_notification_sender, notification_receiver) = mpsc::unbounded_channel();
        let (_response_sender, response_receiver) = mpsc::unbounded_channel();
        
        Self {
            process: Arc::new(Mutex::new(None)),
            stdin_writer: Arc::new(Mutex::new(None)),
            pending_requests: Arc::new(RwLock::new(HashMap::new())),
            message_sender,
            notification_receiver: Arc::new(Mutex::new(notification_receiver)),
            response_receiver: Arc::new(Mutex::new(response_receiver)),
        }
    }
    
    /// Start the communication channel with a process
    pub async fn start_with_process(&mut self, mut child: Child) -> Result<(), AIEngineError> {
        // Take stdin and stdout from the child process
        let stdin = child.stdin.take()
            .ok_or_else(|| AIEngineError::CommunicationError("Failed to get stdin".to_string()))?;
        
        let stdout = child.stdout.take()
            .ok_or_else(|| AIEngineError::CommunicationError("Failed to get stdout".to_string()))?;
        
        // Store the process and stdin writer
        *self.process.lock().await = Some(child);
        *self.stdin_writer.lock().await = Some(stdin);
        
        // Start the stdout reader task
        self.start_stdout_reader(stdout).await;
        
        // Start the stdin writer task
        self.start_stdin_writer().await;
        
        Ok(())
    }
    
    /// Start the stdout reader task
    async fn start_stdout_reader(&self, stdout: tokio::process::ChildStdout) {
        let pending_requests = Arc::clone(&self.pending_requests);
        let _notification_receiver = Arc::clone(&self.notification_receiver);
        let _response_receiver = Arc::clone(&self.response_receiver);

        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut line = String::new();

            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => {
                        log::warn!("AI Core stdout closed");
                        break;
                    }
                    Ok(_) => {
                        let trimmed = line.trim();
                        if trimmed.is_empty() {
                            continue;
                        }

                        log::debug!("Received from AI Core: {}", trimmed);

                        // Try to parse as JSON-RPC response first
                        if let Ok(response) = serde_json::from_str::<JsonRpcResponse>(trimmed) {
                            // Handle response - check for both string and number IDs
                            let id_str = match &response.id {
                                serde_json::Value::String(s) => Some(s.clone()),
                                serde_json::Value::Number(n) => Some(n.to_string()),
                                _ => None,
                            };

                            if let Some(id) = id_str {
                                let mut pending = pending_requests.write().await;
                                if let Some(sender) = pending.remove(&id) {
                                    if let Err(_) = sender.send(response) {
                                        log::warn!("Failed to send response to waiting request: {}", id);
                                    }
                                } else {
                                    log::warn!("Received response for unknown request ID: {}", id);
                                }
                            }
                        } else if let Ok(message) = serde_json::from_str::<JsonRpcMessage>(trimmed) {
                            // Handle notification (messages without ID)
                            if message.id.is_none() {
                                // For now, just log notifications - in future versions we can handle them
                                log::info!("Received notification: {}", message.method);
                            } else {
                                log::warn!("Received request from AI Core (not supported): {}", message.method);
                            }
                        } else {
                            log::warn!("Failed to parse JSON-RPC message: {}", trimmed);
                        }
                    }
                    Err(e) => {
                        log::error!("Error reading from AI Core stdout: {}", e);
                        break;
                    }
                }
            }
        });
    }
    
    /// Start the stdin writer task
    async fn start_stdin_writer(&mut self) {
        let stdin_writer = Arc::clone(&self.stdin_writer);
        let mut receiver = {
            let (sender, receiver) = mpsc::unbounded_channel::<JsonRpcMessage>();
            self.message_sender = sender;
            receiver
        };

        tokio::spawn(async move {
            while let Some(message) = receiver.recv().await {
                let mut writer_guard = stdin_writer.lock().await;
                if let Some(writer) = writer_guard.as_mut() {
                    match serde_json::to_string(&message) {
                        Ok(json) => {
                            let line = format!("{}\n", json);
                            log::debug!("Sending to AI Core: {}", json);

                            if let Err(e) = writer.write_all(line.as_bytes()).await {
                                log::error!("Error writing to AI Core stdin: {}", e);
                                break;
                            }

                            if let Err(e) = writer.flush().await {
                                log::error!("Error flushing AI Core stdin: {}", e);
                                break;
                            }
                        }
                        Err(e) => {
                            log::error!("Error serializing JSON-RPC message: {}", e);
                        }
                    }
                } else {
                    log::warn!("AI Core stdin not available");
                    break;
                }
            }
        });
    }
    
    /// Send a JSON-RPC request and wait for response
    pub async fn send_request(
        &self,
        method: String,
        params: Option<serde_json::Value>,
        timeout_duration: Duration,
    ) -> Result<JsonRpcResponse, AIEngineError> {
        let id = Uuid::new_v4().to_string();
        let message = JsonRpcMessage::new_request(method, params, Some(serde_json::Value::String(id.clone())));
        
        // Create a oneshot channel for the response
        let (response_sender, response_receiver) = tokio::sync::oneshot::channel();
        
        // Store the response sender
        {
            let mut pending = self.pending_requests.write().await;
            pending.insert(id.clone(), response_sender);
        }
        
        // Send the message
        self.message_sender.send(message)
            .map_err(|e| AIEngineError::CommunicationError(format!("Failed to send message: {}", e)))?;
        
        // Wait for response with timeout
        match timeout(timeout_duration, response_receiver).await {
            Ok(Ok(response)) => Ok(response),
            Ok(Err(_)) => {
                // Remove from pending requests
                let mut pending = self.pending_requests.write().await;
                pending.remove(&id);
                Err(AIEngineError::CommunicationError("Response channel closed".to_string()))
            }
            Err(_) => {
                // Remove from pending requests
                let mut pending = self.pending_requests.write().await;
                pending.remove(&id);
                Err(AIEngineError::TimeoutError("Request timed out".to_string()))
            }
        }
    }
    
    /// Send a JSON-RPC notification (no response expected)
    pub async fn send_notification(
        &self,
        method: String,
        params: Option<serde_json::Value>,
    ) -> Result<(), AIEngineError> {
        let message = JsonRpcMessage::new_notification(method, params);
        
        self.message_sender.send(message)
            .map_err(|e| AIEngineError::CommunicationError(format!("Failed to send notification: {}", e)))?;
        
        Ok(())
    }
    
    /// Check if the process is still running
    pub async fn is_process_running(&self) -> bool {
        let mut process_guard = self.process.lock().await;
        if let Some(process) = process_guard.as_mut() {
            // Try to get the exit status without waiting
            match process.try_wait() {
                Ok(Some(_)) => false, // Process has exited
                Ok(None) => true,     // Process is still running
                Err(_) => false,      // Error checking status, assume not running
            }
        } else {
            false
        }
    }
    
    /// Terminate the process
    pub async fn terminate(&self) -> Result<(), AIEngineError> {
        let mut process_guard = self.process.lock().await;
        if let Some(mut process) = process_guard.take() {
            // Try graceful shutdown first
            let _ = self.send_notification("shutdown".to_string(), None).await;
            
            // Wait a bit for graceful shutdown
            tokio::time::sleep(Duration::from_secs(2)).await;
            
            // Force kill if still running
            if let Err(e) = process.kill().await {
                log::warn!("Error killing AI Core process: {}", e);
            }
            
            // Wait for the process to exit
            if let Err(e) = process.wait().await {
                log::warn!("Error waiting for AI Core process to exit: {}", e);
            }
        }
        
        // Clear stdin writer
        *self.stdin_writer.lock().await = None;
        
        Ok(())
    }
}
