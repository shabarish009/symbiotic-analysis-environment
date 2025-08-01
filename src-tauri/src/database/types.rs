use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use thiserror::Error;
use uuid::Uuid;

/// Supported database types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DatabaseType {
    PostgreSQL,
    MySQL,
    SQLite,
    SqlServer,
    Oracle,
}

impl fmt::Display for DatabaseType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DatabaseType::PostgreSQL => write!(f, "PostgreSQL"),
            DatabaseType::MySQL => write!(f, "MySQL"),
            DatabaseType::SQLite => write!(f, "SQLite"),
            DatabaseType::SqlServer => write!(f, "SQL Server"),
            DatabaseType::Oracle => write!(f, "Oracle"),
        }
    }
}

/// Connection status enumeration
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error(String),
    Testing,
}

/// Database connection configuration (non-sensitive data only)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: Uuid,
    pub name: String,
    pub database_type: DatabaseType,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub ssl_enabled: bool,
    pub connection_timeout: u32,
    pub max_connections: u32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub additional_params: HashMap<String, String>,
}

impl ConnectionConfig {
    pub fn new(
        name: String,
        database_type: DatabaseType,
        host: String,
        port: u16,
        database: String,
        username: String,
    ) -> Self {
        let now = chrono::Utc::now();
        Self {
            id: Uuid::new_v4(),
            name,
            database_type,
            host,
            port,
            database,
            username,
            ssl_enabled: true, // Default to secure
            connection_timeout: 30,
            max_connections: 10,
            created_at: now,
            updated_at: now,
            additional_params: HashMap::new(),
        }
    }

    /// Get the keychain service name for this connection
    pub fn keychain_service(&self) -> String {
        format!("symbiotic-db-{}", self.id)
    }

    /// Get the keychain account name for this connection
    pub fn keychain_account(&self) -> String {
        format!("{}@{}", self.username, self.host)
    }
}

/// Database credentials (sensitive data)
#[derive(Debug, Clone)]
pub struct DatabaseCredentials {
    pub connection_id: Uuid,
    pub password: String,
    pub certificate_path: Option<String>,
    pub private_key_path: Option<String>,
}

impl DatabaseCredentials {
    pub fn new(connection_id: Uuid, password: String) -> Self {
        Self {
            connection_id,
            password,
            certificate_path: None,
            private_key_path: None,
        }
    }
}

/// Connection pool abstraction
#[derive(Debug)]
pub struct ConnectionPool {
    pub config: ConnectionConfig,
    pub status: ConnectionStatus,
    pub active_connections: u32,
    pub max_connections: u32,
    pub last_used: chrono::DateTime<chrono::Utc>,
}

/// Database connection errors
#[derive(Error, Debug)]
pub enum ConnectionError {
    #[error("Database connection failed: {0}")]
    ConnectionFailed(String),
    
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),
    
    #[error("Database not found: {0}")]
    DatabaseNotFound(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("SSL/TLS error: {0}")]
    SslError(String),
    
    #[error("Timeout error: {0}")]
    TimeoutError(String),
    
    #[error("Configuration error: {0}")]
    ConfigurationError(String),
    
    #[error("Credential error: {0}")]
    CredentialError(String),
    
    #[error("Security violation: {0}")]
    SecurityViolation(String),
    
    #[error("Unsupported database type: {0}")]
    UnsupportedDatabaseType(String),
    
    #[error("Internal error: {0}")]
    InternalError(String),
}

/// Result type for database operations
pub type ConnectionResult<T> = Result<T, ConnectionError>;

/// Connection test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub message: String,
    pub response_time_ms: u64,
    pub server_version: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl ConnectionTestResult {
    pub fn success(response_time_ms: u64, server_version: Option<String>) -> Self {
        Self {
            success: true,
            message: "Connection successful".to_string(),
            response_time_ms,
            server_version,
            timestamp: chrono::Utc::now(),
        }
    }

    pub fn failure(message: String) -> Self {
        Self {
            success: false,
            message,
            response_time_ms: 0,
            server_version: None,
            timestamp: chrono::Utc::now(),
        }
    }
}

/// Database connection statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStats {
    pub connection_id: Uuid,
    pub total_queries: u64,
    pub successful_queries: u64,
    pub failed_queries: u64,
    pub average_response_time_ms: f64,
    pub last_activity: chrono::DateTime<chrono::Utc>,
    pub uptime_seconds: u64,
}

impl Default for ConnectionStats {
    fn default() -> Self {
        Self {
            connection_id: Uuid::new_v4(),
            total_queries: 0,
            successful_queries: 0,
            failed_queries: 0,
            average_response_time_ms: 0.0,
            last_activity: chrono::Utc::now(),
            uptime_seconds: 0,
        }
    }
}
