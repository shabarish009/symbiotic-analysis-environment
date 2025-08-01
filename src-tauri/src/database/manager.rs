use crate::database::connection::{ConnectionSummary, DatabaseConnection};
use crate::database::credentials::CredentialManager;
use crate::database::types::{
    ConnectionConfig, ConnectionError, ConnectionResult, ConnectionTestResult,
    DatabaseCredentials, DatabaseType,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Main connection manager that coordinates all database operations
#[derive(Debug)]
pub struct ConnectionManager {
    /// Active database connections
    connections: Arc<RwLock<HashMap<Uuid, DatabaseConnection>>>,
    /// Credential manager for secure storage
    credential_manager: Arc<CredentialManager>,
    /// Manager configuration
    config: ConnectionManagerConfig,
}

#[derive(Debug, Clone)]
pub struct ConnectionManagerConfig {
    pub max_connections: usize,
    pub connection_timeout_seconds: u32,
    pub idle_timeout_seconds: u32,
    pub auto_cleanup_enabled: bool,
    pub auto_cleanup_interval_seconds: u32,
}

impl Default for ConnectionManagerConfig {
    fn default() -> Self {
        Self {
            max_connections: 50,
            connection_timeout_seconds: 30,
            idle_timeout_seconds: 300, // 5 minutes
            auto_cleanup_enabled: true,
            auto_cleanup_interval_seconds: 60, // 1 minute
        }
    }
}

impl ConnectionManager {
    /// Create a new connection manager
    pub async fn new() -> ConnectionResult<Self> {
        let credential_manager = Arc::new(CredentialManager::new());
        
        // Load existing connections from storage
        credential_manager.load_connections().await?;
        
        let manager = Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            credential_manager,
            config: ConnectionManagerConfig::default(),
        };

        // Start background cleanup task if enabled
        if manager.config.auto_cleanup_enabled {
            manager.start_cleanup_task().await;
        }

        Ok(manager)
    }

    /// Create a new connection manager with custom configuration
    pub async fn new_with_config(config: ConnectionManagerConfig) -> ConnectionResult<Self> {
        let credential_manager = Arc::new(CredentialManager::new());
        credential_manager.load_connections().await?;
        
        let manager = Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            credential_manager,
            config,
        };

        if manager.config.auto_cleanup_enabled {
            manager.start_cleanup_task().await;
        }

        Ok(manager)
    }

    /// Add a new database connection
    pub async fn add_connection(
        &self,
        config: ConnectionConfig,
        credentials: DatabaseCredentials,
    ) -> ConnectionResult<Uuid> {
        // Validate configuration
        self.credential_manager.validate_config(&config)?;

        // Check connection limit
        {
            let connections = self.connections.read().await;
            if connections.len() >= self.config.max_connections {
                return Err(ConnectionError::ConfigurationError(
                    format!("Maximum number of connections ({}) reached", self.config.max_connections)
                ));
            }
        }

        // Store credentials and configuration
        self.credential_manager.store_connection(config.clone(), credentials).await?;

        // Create the connection object
        let connection = DatabaseConnection::new(config.clone());
        let connection_id = config.id;

        // Add to active connections
        {
            let mut connections = self.connections.write().await;
            connections.insert(connection_id, connection);
        }

        // Save connections to persistent storage
        self.credential_manager.save_connections().await?;

        Ok(connection_id)
    }

    /// Remove a database connection
    pub async fn remove_connection(&self, connection_id: Uuid) -> ConnectionResult<()> {
        // Remove from active connections
        {
            let mut connections = self.connections.write().await;
            if let Some(connection) = connections.remove(&connection_id) {
                connection.disconnect().await;
            }
        }

        // Remove credentials and configuration
        self.credential_manager.delete_connection(connection_id).await?;

        // Save updated connections
        self.credential_manager.save_connections().await?;

        Ok(())
    }

    /// Update connection configuration
    pub async fn update_connection_config(&self, config: ConnectionConfig) -> ConnectionResult<()> {
        // Validate configuration
        self.credential_manager.validate_config(&config)?;

        // Update in credential manager
        self.credential_manager.update_connection_config(config.clone()).await?;

        // Update active connection if it exists
        {
            let mut connections = self.connections.write().await;
            if let Some(connection) = connections.get_mut(&config.id) {
                connection.update_config(config)?;
            }
        }

        // Save connections
        self.credential_manager.save_connections().await?;

        Ok(())
    }

    /// Update connection credentials
    pub async fn update_connection_credentials(
        &self,
        connection_id: Uuid,
        credentials: DatabaseCredentials,
    ) -> ConnectionResult<()> {
        // Update credentials in secure storage
        self.credential_manager.update_credentials(connection_id, credentials).await?;

        Ok(())
    }

    /// Test a connection efficiently
    pub async fn test_connection(&self, connection_id: Uuid) -> ConnectionResult<ConnectionTestResult> {
        // Get credentials first
        let credentials = self.credential_manager.get_credentials(connection_id).await?;

        // Check if connection already exists in memory
        {
            let connections = self.connections.read().await;
            if let Some(conn) = connections.get(&connection_id) {
                // Use existing connection for testing
                return conn.test_connection(&credentials).await;
            }
        }

        // Connection not in memory, create temporary connection for testing
        let config = self.credential_manager.get_connection_config(connection_id).await?;
        let temp_connection = DatabaseConnection::new(config);

        // Perform test with temporary connection
        temp_connection.test_connection(&credentials).await
    }

    /// Get connection summary
    pub async fn get_connection_summary(&self, connection_id: Uuid) -> ConnectionResult<ConnectionSummary> {
        let connections = self.connections.read().await;
        let connection = connections.get(&connection_id)
            .ok_or_else(|| ConnectionError::ConfigurationError("Connection not found".to_string()))?;
        
        Ok(connection.get_summary().await)
    }

    /// List all connections
    pub async fn list_connections(&self) -> Vec<ConnectionConfig> {
        self.credential_manager.list_connections().await
    }

    /// List all connection summaries
    pub async fn list_connection_summaries(&self) -> Vec<ConnectionSummary> {
        let mut summaries = Vec::new();
        let connections = self.connections.read().await;
        
        for connection in connections.values() {
            summaries.push(connection.get_summary().await);
        }
        
        summaries
    }

    /// Get connection by ID
    pub async fn get_connection(&self, connection_id: Uuid) -> ConnectionResult<ConnectionConfig> {
        self.credential_manager.get_connection_config(connection_id).await
    }

    /// Check if connection exists
    pub async fn connection_exists(&self, connection_id: Uuid) -> bool {
        let configs = self.list_connections().await;
        configs.iter().any(|config| config.id == connection_id)
    }

    /// Get supported database types
    pub fn get_supported_database_types(&self) -> Vec<DatabaseType> {
        vec![
            DatabaseType::PostgreSQL,
            DatabaseType::MySQL,
            DatabaseType::SQLite,
            // TODO: Add when implemented
            // DatabaseType::SqlServer,
            // DatabaseType::Oracle,
        ]
    }

    /// Get security audit information
    pub fn get_security_audit(&self) -> Vec<crate::database::security::SecurityEvent> {
        self.credential_manager.get_security_audit()
    }

    /// Cleanup idle connections with enhanced logging
    pub async fn cleanup_idle_connections(&self) -> usize {
        let mut cleaned_up = 0;
        let mut to_remove = Vec::new();

        // First pass: identify connections to remove
        {
            let connections = self.connections.read().await;
            for (id, connection) in connections.iter() {
                let idle_time = connection.get_idle_time_seconds().await;
                if idle_time > self.config.idle_timeout_seconds as u64 {
                    to_remove.push(*id);
                }
            }
        }

        // Second pass: remove identified connections
        if !to_remove.is_empty() {
            let mut connections = self.connections.write().await;
            for id in to_remove {
                if let Some(connection) = connections.remove(&id) {
                    connection.disconnect().await;
                    cleaned_up += 1;

                    // Log cleanup for monitoring
                    log::debug!("Cleaned up idle connection: {}", id);
                }
            }

            if cleaned_up > 0 {
                log::info!("Cleaned up {} idle connections", cleaned_up);
            }
        }

        cleaned_up
    }

    /// Force cleanup of all connections (for shutdown)
    pub async fn cleanup_all_connections(&self) -> usize {
        let mut cleaned_up = 0;
        let mut connections = self.connections.write().await;

        for (id, connection) in connections.drain() {
            connection.disconnect().await;
            cleaned_up += 1;
            log::debug!("Disconnected connection during shutdown: {}", id);
        }

        if cleaned_up > 0 {
            log::info!("Disconnected {} connections during cleanup", cleaned_up);
        }

        cleaned_up
    }

    /// Start background cleanup task
    async fn start_cleanup_task(&self) {
        let connections = Arc::clone(&self.connections);
        let cleanup_interval = self.config.auto_cleanup_interval_seconds;
        let idle_timeout = self.config.idle_timeout_seconds;

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(
                std::time::Duration::from_secs(cleanup_interval as u64)
            );

            loop {
                interval.tick().await;
                
                let mut to_remove = Vec::new();
                {
                    let connections_guard = connections.read().await;
                    for (id, connection) in connections_guard.iter() {
                        let idle_time = connection.get_idle_time_seconds().await;
                        if idle_time > idle_timeout as u64 {
                            to_remove.push(*id);
                        }
                    }
                }

                if !to_remove.is_empty() {
                    let mut connections_guard = connections.write().await;
                    for id in to_remove {
                        if let Some(connection) = connections_guard.remove(&id) {
                            connection.disconnect().await;
                        }
                    }
                }
            }
        });
    }

    /// Get manager statistics
    pub async fn get_manager_stats(&self) -> ConnectionManagerStats {
        let connections = self.connections.read().await;
        let total_connections = self.credential_manager.list_connections().await.len();
        let active_connections = connections.len();
        
        let mut total_queries = 0;
        let mut successful_queries = 0;
        let mut failed_queries = 0;
        
        for connection in connections.values() {
            let stats = connection.get_stats().await;
            total_queries += stats.total_queries;
            successful_queries += stats.successful_queries;
            failed_queries += stats.failed_queries;
        }

        ConnectionManagerStats {
            total_connections,
            active_connections,
            max_connections: self.config.max_connections,
            total_queries,
            successful_queries,
            failed_queries,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConnectionManagerStats {
    pub total_connections: usize,
    pub active_connections: usize,
    pub max_connections: usize,
    pub total_queries: u64,
    pub successful_queries: u64,
    pub failed_queries: u64,
}

impl Default for ConnectionManager {
    fn default() -> Self {
        // This is a blocking implementation for Default trait
        // In practice, use ConnectionManager::new() instead
        panic!("Use ConnectionManager::new() instead of default()")
    }
}
