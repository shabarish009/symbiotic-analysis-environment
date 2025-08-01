use crate::database::security::SecureCredentialManager;
use crate::database::types::{ConnectionConfig, ConnectionError, ConnectionResult, DatabaseCredentials};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// High-level credential manager that coordinates with security layer
#[derive(Debug)]
pub struct CredentialManager {
    secure_manager: Arc<SecureCredentialManager>,
    // Cache for connection configs (non-sensitive data only)
    config_cache: Arc<RwLock<std::collections::HashMap<Uuid, ConnectionConfig>>>,
}

impl CredentialManager {
    pub fn new() -> Self {
        Self {
            secure_manager: Arc::new(SecureCredentialManager::new()),
            config_cache: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    /// Store complete connection information (config + credentials)
    pub async fn store_connection(
        &self,
        config: ConnectionConfig,
        credentials: DatabaseCredentials,
    ) -> ConnectionResult<()> {
        // Validate that credentials match the config
        if config.id != credentials.connection_id {
            return Err(ConnectionError::ConfigurationError(
                "Connection ID mismatch between config and credentials".to_string(),
            ));
        }

        // Store credentials securely in OS keychain
        self.secure_manager.store_credentials(config.id, &credentials)?;

        // Cache the configuration (non-sensitive data only)
        {
            let mut cache = self.config_cache.write().await;
            cache.insert(config.id, config);
        }

        Ok(())
    }

    /// Retrieve connection configuration (non-sensitive data only)
    pub async fn get_connection_config(&self, connection_id: Uuid) -> ConnectionResult<ConnectionConfig> {
        let cache = self.config_cache.read().await;
        cache
            .get(&connection_id)
            .cloned()
            .ok_or_else(|| ConnectionError::ConfigurationError("Connection not found".to_string()))
    }

    /// Retrieve credentials for a connection
    pub async fn get_credentials(&self, connection_id: Uuid) -> ConnectionResult<DatabaseCredentials> {
        // Verify connection exists in our cache
        {
            let cache = self.config_cache.read().await;
            if !cache.contains_key(&connection_id) {
                return Err(ConnectionError::ConfigurationError("Connection not found".to_string()));
            }
        }

        // Retrieve credentials from secure storage
        self.secure_manager.retrieve_credentials(connection_id)
    }

    /// Update connection configuration
    pub async fn update_connection_config(&self, config: ConnectionConfig) -> ConnectionResult<()> {
        // Update the cache
        {
            let mut cache = self.config_cache.write().await;
            cache.insert(config.id, config);
        }

        Ok(())
    }

    /// Update credentials for a connection
    pub async fn update_credentials(
        &self,
        connection_id: Uuid,
        credentials: DatabaseCredentials,
    ) -> ConnectionResult<()> {
        // Verify connection exists
        {
            let cache = self.config_cache.read().await;
            if !cache.contains_key(&connection_id) {
                return Err(ConnectionError::ConfigurationError("Connection not found".to_string()));
            }
        }

        // Update credentials in secure storage
        self.secure_manager.store_credentials(connection_id, &credentials)
    }

    /// Delete a connection (both config and credentials)
    pub async fn delete_connection(&self, connection_id: Uuid) -> ConnectionResult<()> {
        // Remove from cache
        {
            let mut cache = self.config_cache.write().await;
            cache.remove(&connection_id);
        }

        // Delete credentials from secure storage
        self.secure_manager.delete_credentials(connection_id)
    }

    /// List all connection configurations
    pub async fn list_connections(&self) -> Vec<ConnectionConfig> {
        let cache = self.config_cache.read().await;
        cache.values().cloned().collect()
    }

    /// Check if credentials exist for a connection
    pub async fn credentials_exist(&self, connection_id: Uuid) -> bool {
        self.secure_manager.credentials_exist(connection_id)
    }

    /// Load connections from persistent storage
    pub async fn load_connections(&self) -> ConnectionResult<()> {
        // In a real implementation, this would load from a config file
        // For now, we'll implement a simple JSON-based storage
        // This is safe because it only contains non-sensitive data
        
        let config_path = self.get_config_file_path()?;
        
        if !config_path.exists() {
            // No existing config file, start with empty state
            return Ok(());
        }

        let config_data = std::fs::read_to_string(&config_path)
            .map_err(|e| ConnectionError::ConfigurationError(format!("Failed to read config file: {}", e)))?;

        let configs: Vec<ConnectionConfig> = serde_json::from_str(&config_data)
            .map_err(|e| ConnectionError::ConfigurationError(format!("Failed to parse config file: {}", e)))?;

        // Load into cache
        {
            let mut cache = self.config_cache.write().await;
            for config in configs {
                cache.insert(config.id, config);
            }
        }

        Ok(())
    }

    /// Save connections to persistent storage
    pub async fn save_connections(&self) -> ConnectionResult<()> {
        let configs = self.list_connections().await;
        let config_data = serde_json::to_string_pretty(&configs)
            .map_err(|e| ConnectionError::ConfigurationError(format!("Failed to serialize configs: {}", e)))?;

        let config_path = self.get_config_file_path()?;
        
        // Ensure directory exists
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| ConnectionError::ConfigurationError(format!("Failed to create config directory: {}", e)))?;
        }

        std::fs::write(&config_path, config_data)
            .map_err(|e| ConnectionError::ConfigurationError(format!("Failed to write config file: {}", e)))?;

        Ok(())
    }

    /// Get the path to the configuration file
    fn get_config_file_path(&self) -> ConnectionResult<std::path::PathBuf> {
        let mut path = dirs::config_dir()
            .ok_or_else(|| ConnectionError::ConfigurationError("Could not determine config directory".to_string()))?;
        
        path.push("symbiotic-analysis");
        path.push("database-connections.json");
        
        Ok(path)
    }

    /// Validate connection configuration
    pub fn validate_config(&self, config: &ConnectionConfig) -> ConnectionResult<()> {
        if config.name.trim().is_empty() {
            return Err(ConnectionError::ConfigurationError("Connection name cannot be empty".to_string()));
        }

        if config.host.trim().is_empty() {
            return Err(ConnectionError::ConfigurationError("Host cannot be empty".to_string()));
        }

        if config.username.trim().is_empty() {
            return Err(ConnectionError::ConfigurationError("Username cannot be empty".to_string()));
        }

        if config.port == 0 || config.port > 65535 {
            return Err(ConnectionError::ConfigurationError("Invalid port number".to_string()));
        }

        if config.connection_timeout == 0 || config.connection_timeout > 300 {
            return Err(ConnectionError::ConfigurationError("Connection timeout must be between 1 and 300 seconds".to_string()));
        }

        if config.max_connections == 0 || config.max_connections > 100 {
            return Err(ConnectionError::ConfigurationError("Max connections must be between 1 and 100".to_string()));
        }

        Ok(())
    }

    /// Get security audit information
    pub fn get_security_audit(&self) -> Vec<crate::database::security::SecurityEvent> {
        self.secure_manager.security_audit()
    }

    /// Generate connection hash for validation
    pub fn generate_connection_hash(&self, config: &ConnectionConfig) -> String {
        let connection_data = format!("{}:{}:{}:{}", config.host, config.port, config.database, config.username);
        self.secure_manager.generate_connection_hash(&connection_data)
    }
}

impl Default for CredentialManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::types::DatabaseType;

    #[tokio::test]
    async fn test_credential_manager_basic_operations() {
        let manager = CredentialManager::new();
        
        let config = ConnectionConfig::new(
            "Test Connection".to_string(),
            DatabaseType::PostgreSQL,
            "localhost".to_string(),
            5432,
            "testdb".to_string(),
            "testuser".to_string(),
        );
        
        let credentials = DatabaseCredentials::new(config.id, "testpass".to_string());
        
        // Test storing connection
        assert!(manager.store_connection(config.clone(), credentials).await.is_ok());
        
        // Test retrieving config
        let retrieved_config = manager.get_connection_config(config.id).await;
        assert!(retrieved_config.is_ok());
        assert_eq!(retrieved_config.unwrap().name, config.name);
        
        // Test listing connections
        let connections = manager.list_connections().await;
        assert_eq!(connections.len(), 1);
        
        // Test deleting connection
        assert!(manager.delete_connection(config.id).await.is_ok());
        
        let connections = manager.list_connections().await;
        assert_eq!(connections.len(), 0);
    }

    #[test]
    fn test_config_validation() {
        let manager = CredentialManager::new();
        
        let mut config = ConnectionConfig::new(
            "Test".to_string(),
            DatabaseType::PostgreSQL,
            "localhost".to_string(),
            5432,
            "testdb".to_string(),
            "testuser".to_string(),
        );
        
        // Valid config should pass
        assert!(manager.validate_config(&config).is_ok());
        
        // Empty name should fail
        config.name = "".to_string();
        assert!(manager.validate_config(&config).is_err());
        
        // Reset name and test invalid port
        config.name = "Test".to_string();
        config.port = 0;
        assert!(manager.validate_config(&config).is_err());
    }
}
