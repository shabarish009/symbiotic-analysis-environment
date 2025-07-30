//! AI Engine Types and Enums
//! 
//! Core types and enumerations for AI engine management

use serde::{Deserialize, Serialize};
use std::fmt;
use thiserror::Error;

/// AI Engine Status enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AIEngineStatus {
    /// Engine is starting up
    Starting,
    /// Engine is ready and operational
    Ready,
    /// Engine encountered an error
    Error(String),
    /// Engine is stopped
    Stopped,
    /// Engine is restarting after a failure
    Restarting,
}

impl fmt::Display for AIEngineStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AIEngineStatus::Starting => write!(f, "Starting"),
            AIEngineStatus::Ready => write!(f, "Ready"),
            AIEngineStatus::Error(msg) => write!(f, "Error: {}", msg),
            AIEngineStatus::Stopped => write!(f, "Stopped"),
            AIEngineStatus::Restarting => write!(f, "Restarting"),
        }
    }
}

/// AI Engine Error types
#[derive(Error, Debug)]
pub enum AIEngineError {
    #[error("Failed to spawn AI process: {0}")]
    ProcessSpawnError(String),
    
    #[error("AI process crashed: {0}")]
    ProcessCrashed(String),
    
    #[error("Communication error: {0}")]
    CommunicationError(String),
    
    #[error("Configuration error: {0}")]
    ConfigurationError(String),
    
    #[error("Timeout error: {0}")]
    TimeoutError(String),
    
    #[error("JSON-RPC error: {0}")]
    JsonRpcError(String),
    
    #[error("Health check failed: {0}")]
    HealthCheckFailed(String),
    
    #[error("Startup failed: {0}")]
    StartupFailed(String),
}

/// JSON-RPC Message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcMessage {
    pub jsonrpc: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<serde_json::Value>,
}

impl JsonRpcMessage {
    /// Create a new JSON-RPC request
    pub fn new_request(method: String, params: Option<serde_json::Value>, id: Option<serde_json::Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method,
            params,
            id,
        }
    }
    
    /// Create a new JSON-RPC notification (no response expected)
    pub fn new_notification(method: String, params: Option<serde_json::Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method,
            params,
            id: None,
        }
    }
}

/// JSON-RPC Response structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
    pub id: serde_json::Value,
}

/// JSON-RPC Error structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// AI Status Update message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIStatusUpdate {
    pub status: AIEngineStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    pub timestamp: u64,
}

impl AIStatusUpdate {
    pub fn new(status: AIEngineStatus, message: Option<String>) -> Self {
        Self {
            status,
            message,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }
    }
}

/// Health check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub healthy: bool,
    pub response_time_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub timestamp: u64,
}

impl HealthCheckResult {
    pub fn healthy(response_time_ms: u64) -> Self {
        Self {
            healthy: true,
            response_time_ms,
            error: None,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }
    }
    
    pub fn unhealthy(error: String) -> Self {
        Self {
            healthy: false,
            response_time_ms: 0,
            error: Some(error),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }
    }
}
