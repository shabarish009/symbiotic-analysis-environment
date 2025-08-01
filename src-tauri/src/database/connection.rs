use crate::database::drivers::{DatabaseDriver, DatabaseDriverFactory};
use crate::database::types::{
    ConnectionConfig, ConnectionError, ConnectionResult, ConnectionStats,
    ConnectionStatus, ConnectionTestResult, DatabaseCredentials,
};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Represents an active database connection with its associated metadata
#[derive(Debug)]
pub struct DatabaseConnection {
    pub config: ConnectionConfig,
    pub status: Arc<RwLock<ConnectionStatus>>,
    pub stats: Arc<RwLock<ConnectionStats>>,
    driver: Box<dyn DatabaseDriver>,
    created_at: Instant,
    last_activity: Arc<RwLock<Instant>>,
}

impl DatabaseConnection {
    /// Create a new database connection
    pub fn new(config: ConnectionConfig) -> Self {
        let driver = DatabaseDriverFactory::create_driver(&config.database_type);
        let now = Instant::now();
        
        let mut stats = ConnectionStats::default();
        stats.connection_id = config.id;
        
        Self {
            config,
            status: Arc::new(RwLock::new(ConnectionStatus::Disconnected)),
            stats: Arc::new(RwLock::new(stats)),
            driver,
            created_at: now,
            last_activity: Arc::new(RwLock::new(now)),
        }
    }

    /// Test the connection to the database
    pub async fn test_connection(&self, credentials: &DatabaseCredentials) -> ConnectionResult<ConnectionTestResult> {
        // Update status to testing
        {
            let mut status = self.status.write().await;
            *status = ConnectionStatus::Testing;
        }

        // Update last activity
        {
            let mut last_activity = self.last_activity.write().await;
            *last_activity = Instant::now();
        }

        // Perform the actual connection test
        let result = self.driver.test_connection(&self.config, credentials).await;

        // Update status based on result
        {
            let mut status = self.status.write().await;
            *status = if result.as_ref().map(|r| r.success).unwrap_or(false) {
                ConnectionStatus::Connected
            } else {
                ConnectionStatus::Error(
                    result.as_ref()
                        .map(|r| r.message.clone())
                        .unwrap_or_else(|e| e.to_string())
                )
            };
        }

        // Update statistics
        if let Ok(test_result) = &result {
            let mut stats = self.stats.write().await;
            stats.total_queries += 1;
            if test_result.success {
                stats.successful_queries += 1;
            } else {
                stats.failed_queries += 1;
            }
            
            // Update average response time
            let total_time = stats.average_response_time_ms * (stats.total_queries - 1) as f64 + test_result.response_time_ms as f64;
            stats.average_response_time_ms = total_time / stats.total_queries as f64;
            
            stats.last_activity = chrono::Utc::now();
        }

        result
    }

    /// Get the current connection status
    pub async fn get_status(&self) -> ConnectionStatus {
        let status = self.status.read().await;
        status.clone()
    }

    /// Get connection statistics
    pub async fn get_stats(&self) -> ConnectionStats {
        let mut stats = self.stats.read().await.clone();
        stats.uptime_seconds = self.created_at.elapsed().as_secs();
        stats
    }

    /// Validate the connection configuration
    pub fn validate_config(&self) -> ConnectionResult<()> {
        self.driver.validate_config(&self.config)
    }

    /// Get the connection string (for debugging purposes only - never log this)
    pub fn build_connection_string(&self, credentials: &DatabaseCredentials) -> ConnectionResult<String> {
        self.driver.build_connection_string(&self.config, credentials)
    }

    /// Get supported features for this database type
    pub fn get_supported_features(&self) -> Vec<crate::database::drivers::DatabaseFeature> {
        self.driver.supported_features()
    }

    /// Update connection configuration
    pub fn update_config(&mut self, new_config: ConnectionConfig) -> ConnectionResult<()> {
        // Validate the new configuration
        let new_driver = DatabaseDriverFactory::create_driver(&new_config.database_type);
        new_driver.validate_config(&new_config)?;

        // Update the connection
        self.config = new_config;
        self.driver = new_driver;

        Ok(())
    }

    /// Check if the connection is healthy
    pub async fn is_healthy(&self) -> bool {
        let status = self.status.read().await;
        matches!(*status, ConnectionStatus::Connected)
    }

    /// Get connection age in seconds
    pub fn get_age_seconds(&self) -> u64 {
        self.created_at.elapsed().as_secs()
    }

    /// Get time since last activity in seconds
    pub async fn get_idle_time_seconds(&self) -> u64 {
        let last_activity = self.last_activity.read().await;
        last_activity.elapsed().as_secs()
    }

    /// Mark connection as active (called when used)
    pub async fn mark_active(&self) {
        let mut last_activity = self.last_activity.write().await;
        *last_activity = Instant::now();
    }

    /// Disconnect the connection
    pub async fn disconnect(&self) {
        let mut status = self.status.write().await;
        *status = ConnectionStatus::Disconnected;
    }

    /// Get connection summary for display
    pub async fn get_summary(&self) -> ConnectionSummary {
        let status = self.get_status().await;
        let stats = self.get_stats().await;
        
        ConnectionSummary {
            id: self.config.id,
            name: self.config.name.clone(),
            database_type: self.config.database_type.clone(),
            host: self.config.host.clone(),
            port: self.config.port,
            database: self.config.database.clone(),
            username: self.config.username.clone(),
            status,
            total_queries: stats.total_queries,
            successful_queries: stats.successful_queries,
            failed_queries: stats.failed_queries,
            average_response_time_ms: stats.average_response_time_ms,
            uptime_seconds: stats.uptime_seconds,
            last_activity: stats.last_activity,
        }
    }
}

/// Connection summary for UI display
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConnectionSummary {
    pub id: Uuid,
    pub name: String,
    pub database_type: crate::database::types::DatabaseType,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub status: ConnectionStatus,
    pub total_queries: u64,
    pub successful_queries: u64,
    pub failed_queries: u64,
    pub average_response_time_ms: f64,
    pub uptime_seconds: u64,
    pub last_activity: chrono::DateTime<chrono::Utc>,
}

/// Connection builder for easier construction
pub struct ConnectionBuilder {
    config: ConnectionConfig,
}

impl ConnectionBuilder {
    pub fn new(name: String, database_type: crate::database::types::DatabaseType) -> Self {
        let config = ConnectionConfig::new(
            name,
            database_type,
            "localhost".to_string(),
            DatabaseDriverFactory::get_default_port(&database_type),
            "".to_string(),
            "".to_string(),
        );
        
        Self { config }
    }

    pub fn host(mut self, host: String) -> Self {
        self.config.host = host;
        self
    }

    pub fn port(mut self, port: u16) -> Self {
        self.config.port = port;
        self
    }

    pub fn database(mut self, database: String) -> Self {
        self.config.database = database;
        self
    }

    pub fn username(mut self, username: String) -> Self {
        self.config.username = username;
        self
    }

    pub fn ssl_enabled(mut self, enabled: bool) -> Self {
        self.config.ssl_enabled = enabled;
        self
    }

    pub fn connection_timeout(mut self, timeout: u32) -> Self {
        self.config.connection_timeout = timeout;
        self
    }

    pub fn max_connections(mut self, max: u32) -> Self {
        self.config.max_connections = max;
        self
    }

    pub fn additional_param(mut self, key: String, value: String) -> Self {
        self.config.additional_params.insert(key, value);
        self
    }

    pub fn build(self) -> DatabaseConnection {
        DatabaseConnection::new(self.config)
    }

    pub fn build_with_config(self) -> (DatabaseConnection, ConnectionConfig) {
        let connection = DatabaseConnection::new(self.config.clone());
        (connection, self.config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::types::{DatabaseType, DatabaseCredentials};

    #[tokio::test]
    async fn test_connection_creation() {
        let config = ConnectionConfig::new(
            "Test Connection".to_string(),
            DatabaseType::SQLite,
            "localhost".to_string(),
            0,
            ":memory:".to_string(),
            "".to_string(),
        );

        let connection = DatabaseConnection::new(config.clone());
        assert_eq!(connection.config.name, config.name);
        assert_eq!(connection.get_status().await, ConnectionStatus::Disconnected);
    }

    #[tokio::test]
    async fn test_connection_builder() {
        let (connection, config) = ConnectionBuilder::new("Test".to_string(), DatabaseType::PostgreSQL)
            .host("example.com".to_string())
            .port(5432)
            .database("testdb".to_string())
            .username("testuser".to_string())
            .ssl_enabled(true)
            .build_with_config();

        assert_eq!(config.name, "Test");
        assert_eq!(config.host, "example.com");
        assert_eq!(config.port, 5432);
        assert_eq!(config.database, "testdb");
        assert_eq!(config.username, "testuser");
        assert!(config.ssl_enabled);
    }

    #[test]
    fn test_connection_validation() {
        let config = ConnectionConfig::new(
            "Test".to_string(),
            DatabaseType::SQLite,
            "localhost".to_string(),
            0,
            ":memory:".to_string(),
            "".to_string(),
        );

        let connection = DatabaseConnection::new(config);
        assert!(connection.validate_config().is_ok());
    }
}
