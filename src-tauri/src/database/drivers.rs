use crate::database::types::{
    ConnectionConfig, ConnectionError, ConnectionResult, ConnectionTestResult,
    DatabaseCredentials, DatabaseType,
};
use async_trait::async_trait;
use std::time::Instant;

/// Database driver trait for unified interface across different database types
#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    /// Test connection to the database
    async fn test_connection(
        &self,
        config: &ConnectionConfig,
        credentials: &DatabaseCredentials,
    ) -> ConnectionResult<ConnectionTestResult>;

    /// Get the connection string for this database type
    fn build_connection_string(
        &self,
        config: &ConnectionConfig,
        credentials: &DatabaseCredentials,
    ) -> ConnectionResult<String>;

    /// Get the default port for this database type
    fn default_port(&self) -> u16;

    /// Get supported features for this database type
    fn supported_features(&self) -> Vec<DatabaseFeature>;

    /// Validate database-specific configuration
    fn validate_config(&self, config: &ConnectionConfig) -> ConnectionResult<()>;
}

/// Database features that may be supported
#[derive(Debug, Clone, PartialEq)]
pub enum DatabaseFeature {
    SSL,
    WindowsAuthentication,
    ConnectionPooling,
    Transactions,
    PreparedStatements,
    BulkInsert,
    StoredProcedures,
    Views,
    Triggers,
    FullTextSearch,
}

/// PostgreSQL driver implementation
#[derive(Debug, Default)]
pub struct PostgreSQLDriver;

#[async_trait]
impl DatabaseDriver for PostgreSQLDriver {
    async fn test_connection(
        &self,
        config: &ConnectionConfig,
        credentials: &DatabaseCredentials,
    ) -> ConnectionResult<ConnectionTestResult> {
        let start_time = Instant::now();
        
        let connection_string = self.build_connection_string(config, credentials)?;
        
        match sqlx::PgPool::connect(&connection_string).await {
            Ok(pool) => {
                // Test with a simple query
                match sqlx::query("SELECT version()").fetch_one(&pool).await {
                    Ok(row) => {
                        let version: String = row.try_get(0).unwrap_or_else(|_| "Unknown".to_string());
                        let response_time = start_time.elapsed().as_millis() as u64;
                        
                        pool.close().await;
                        
                        Ok(ConnectionTestResult::success(response_time, Some(version)))
                    }
                    Err(e) => Ok(ConnectionTestResult::failure(format!("Query failed: {}", e))),
                }
            }
            Err(e) => Ok(ConnectionTestResult::failure(format!("Connection failed: {}", e))),
        }
    }

    fn build_connection_string(
        &self,
        config: &ConnectionConfig,
        credentials: &DatabaseCredentials,
    ) -> ConnectionResult<String> {
        // Validate and sanitize all input parameters
        self.validate_connection_parameters(config)?;

        let ssl_mode = if config.ssl_enabled { "require" } else { "disable" };

        let mut connection_string = format!(
            "postgresql://{}:{}@{}:{}/{}?sslmode={}",
            urlencoding::encode(&config.username),
            urlencoding::encode(&credentials.password),
            urlencoding::encode(&config.host), // SECURITY FIX: Encode host
            config.port,
            urlencoding::encode(&config.database),
            ssl_mode
        );

        // Add additional parameters with validation
        for (key, value) in &config.additional_params {
            // Validate parameter names and values
            if !self.is_safe_parameter_name(key) || !self.is_safe_parameter_value(value) {
                return Err(ConnectionError::SecurityViolation(
                    format!("Unsafe connection parameter: {}={}", key, value)
                ));
            }
            connection_string.push_str(&format!("&{}={}",
                urlencoding::encode(key),
                urlencoding::encode(value)
            ));
        }

        Ok(connection_string)
    }

    /// Validate connection parameters for security
    fn validate_connection_parameters(&self, config: &ConnectionConfig) -> ConnectionResult<()> {
        // Check for suspicious characters in host
        if config.host.contains(';') || config.host.contains('\'') || config.host.contains('"') {
            return Err(ConnectionError::SecurityViolation(
                "Host contains potentially dangerous characters".to_string()
            ));
        }

        // Validate port range
        if config.port == 0 || config.port > 65535 {
            return Err(ConnectionError::ConfigurationError(
                "Invalid port number".to_string()
            ));
        }

        Ok(())
    }

    /// Check if parameter name is safe
    fn is_safe_parameter_name(&self, name: &str) -> bool {
        // Allow only alphanumeric characters, underscores, and hyphens
        name.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') &&
        !name.is_empty() &&
        name.len() <= 64
    }

    /// Check if parameter value is safe
    fn is_safe_parameter_value(&self, value: &str) -> bool {
        // Reject values with dangerous characters
        !value.contains(';') &&
        !value.contains('\'') &&
        !value.contains('"') &&
        !value.contains('\0') &&
        value.len() <= 256
    }

    fn default_port(&self) -> u16 {
        5432
    }

    fn supported_features(&self) -> Vec<DatabaseFeature> {
        vec![
            DatabaseFeature::SSL,
            DatabaseFeature::ConnectionPooling,
            DatabaseFeature::Transactions,
            DatabaseFeature::PreparedStatements,
            DatabaseFeature::BulkInsert,
            DatabaseFeature::StoredProcedures,
            DatabaseFeature::Views,
            DatabaseFeature::Triggers,
            DatabaseFeature::FullTextSearch,
        ]
    }

    fn validate_config(&self, config: &ConnectionConfig) -> ConnectionResult<()> {
        if config.database.trim().is_empty() {
            return Err(ConnectionError::ConfigurationError(
                "Database name is required for PostgreSQL".to_string(),
            ));
        }
        Ok(())
    }
}

/// MySQL driver implementation
#[derive(Debug, Default)]
pub struct MySQLDriver;

#[async_trait]
impl DatabaseDriver for MySQLDriver {
    async fn test_connection(
        &self,
        config: &ConnectionConfig,
        credentials: &DatabaseCredentials,
    ) -> ConnectionResult<ConnectionTestResult> {
        let start_time = Instant::now();
        
        let connection_string = self.build_connection_string(config, credentials)?;
        
        match sqlx::MySqlPool::connect(&connection_string).await {
            Ok(pool) => {
                match sqlx::query("SELECT VERSION()").fetch_one(&pool).await {
                    Ok(row) => {
                        let version: String = row.try_get(0).unwrap_or_else(|_| "Unknown".to_string());
                        let response_time = start_time.elapsed().as_millis() as u64;
                        
                        pool.close().await;
                        
                        Ok(ConnectionTestResult::success(response_time, Some(version)))
                    }
                    Err(e) => Ok(ConnectionTestResult::failure(format!("Query failed: {}", e))),
                }
            }
            Err(e) => Ok(ConnectionTestResult::failure(format!("Connection failed: {}", e))),
        }
    }

    fn build_connection_string(
        &self,
        config: &ConnectionConfig,
        credentials: &DatabaseCredentials,
    ) -> ConnectionResult<String> {
        // Validate and sanitize all input parameters
        self.validate_connection_parameters(config)?;

        let ssl_mode = if config.ssl_enabled { "REQUIRED" } else { "DISABLED" };

        let mut connection_string = format!(
            "mysql://{}:{}@{}:{}/{}?ssl-mode={}",
            urlencoding::encode(&config.username),
            urlencoding::encode(&credentials.password),
            urlencoding::encode(&config.host), // SECURITY FIX: Encode host
            config.port,
            urlencoding::encode(&config.database),
            ssl_mode
        );

        // Add additional parameters with validation
        for (key, value) in &config.additional_params {
            // Validate parameter names and values
            if !self.is_safe_parameter_name(key) || !self.is_safe_parameter_value(value) {
                return Err(ConnectionError::SecurityViolation(
                    format!("Unsafe connection parameter: {}={}", key, value)
                ));
            }
            connection_string.push_str(&format!("&{}={}",
                urlencoding::encode(key),
                urlencoding::encode(value)
            ));
        }

        Ok(connection_string)
    }

    /// Validate connection parameters for security
    fn validate_connection_parameters(&self, config: &ConnectionConfig) -> ConnectionResult<()> {
        // Check for suspicious characters in host
        if config.host.contains(';') || config.host.contains('\'') || config.host.contains('"') {
            return Err(ConnectionError::SecurityViolation(
                "Host contains potentially dangerous characters".to_string()
            ));
        }

        // Validate port range
        if config.port == 0 || config.port > 65535 {
            return Err(ConnectionError::ConfigurationError(
                "Invalid port number".to_string()
            ));
        }

        Ok(())
    }

    /// Check if parameter name is safe
    fn is_safe_parameter_name(&self, name: &str) -> bool {
        // Allow only alphanumeric characters, underscores, and hyphens
        name.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') &&
        !name.is_empty() &&
        name.len() <= 64
    }

    /// Check if parameter value is safe
    fn is_safe_parameter_value(&self, value: &str) -> bool {
        // Reject values with dangerous characters
        !value.contains(';') &&
        !value.contains('\'') &&
        !value.contains('"') &&
        !value.contains('\0') &&
        value.len() <= 256
    }

    fn default_port(&self) -> u16 {
        3306
    }

    fn supported_features(&self) -> Vec<DatabaseFeature> {
        vec![
            DatabaseFeature::SSL,
            DatabaseFeature::ConnectionPooling,
            DatabaseFeature::Transactions,
            DatabaseFeature::PreparedStatements,
            DatabaseFeature::BulkInsert,
            DatabaseFeature::StoredProcedures,
            DatabaseFeature::Views,
            DatabaseFeature::Triggers,
            DatabaseFeature::FullTextSearch,
        ]
    }

    fn validate_config(&self, config: &ConnectionConfig) -> ConnectionResult<()> {
        if config.database.trim().is_empty() {
            return Err(ConnectionError::ConfigurationError(
                "Database name is required for MySQL".to_string(),
            ));
        }
        Ok(())
    }
}

/// SQLite driver implementation
#[derive(Debug, Default)]
pub struct SQLiteDriver;

#[async_trait]
impl DatabaseDriver for SQLiteDriver {
    async fn test_connection(
        &self,
        config: &ConnectionConfig,
        _credentials: &DatabaseCredentials,
    ) -> ConnectionResult<ConnectionTestResult> {
        let start_time = Instant::now();
        
        let connection_string = self.build_connection_string(config, _credentials)?;
        
        match sqlx::SqlitePool::connect(&connection_string).await {
            Ok(pool) => {
                match sqlx::query("SELECT sqlite_version()").fetch_one(&pool).await {
                    Ok(row) => {
                        let version: String = row.try_get(0).unwrap_or_else(|_| "Unknown".to_string());
                        let response_time = start_time.elapsed().as_millis() as u64;
                        
                        pool.close().await;
                        
                        Ok(ConnectionTestResult::success(response_time, Some(format!("SQLite {}", version))))
                    }
                    Err(e) => Ok(ConnectionTestResult::failure(format!("Query failed: {}", e))),
                }
            }
            Err(e) => Ok(ConnectionTestResult::failure(format!("Connection failed: {}", e))),
        }
    }

    fn build_connection_string(
        &self,
        config: &ConnectionConfig,
        _credentials: &DatabaseCredentials,
    ) -> ConnectionResult<String> {
        // Validate SQLite-specific parameters
        self.validate_sqlite_path(&config.database)?;

        // For SQLite, the database field contains the file path
        let mut connection_string = format!("sqlite:{}", urlencoding::encode(&config.database));

        // Add additional parameters with validation
        for (key, value) in &config.additional_params {
            // Validate parameter names and values
            if !self.is_safe_parameter_name(key) || !self.is_safe_parameter_value(value) {
                return Err(ConnectionError::SecurityViolation(
                    format!("Unsafe connection parameter: {}={}", key, value)
                ));
            }
            let separator = if connection_string.contains('?') { "&" } else { "?" };
            connection_string.push_str(&format!("{}{}={}",
                separator,
                urlencoding::encode(key),
                urlencoding::encode(value)
            ));
        }

        Ok(connection_string)
    }

    /// Validate SQLite file path for security
    fn validate_sqlite_path(&self, path: &str) -> ConnectionResult<()> {
        // Check for path traversal attempts
        if path.contains("..") || path.contains("//") {
            return Err(ConnectionError::SecurityViolation(
                "Path contains potentially dangerous sequences".to_string()
            ));
        }

        // Check for null bytes
        if path.contains('\0') {
            return Err(ConnectionError::SecurityViolation(
                "Path contains null bytes".to_string()
            ));
        }

        // Validate path length
        if path.is_empty() || path.len() > 4096 {
            return Err(ConnectionError::ConfigurationError(
                "Invalid path length".to_string()
            ));
        }

        Ok(())
    }

    /// Check if parameter name is safe
    fn is_safe_parameter_name(&self, name: &str) -> bool {
        // Allow only alphanumeric characters, underscores, and hyphens
        name.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') &&
        !name.is_empty() &&
        name.len() <= 64
    }

    /// Check if parameter value is safe
    fn is_safe_parameter_value(&self, value: &str) -> bool {
        // Reject values with dangerous characters
        !value.contains(';') &&
        !value.contains('\'') &&
        !value.contains('"') &&
        !value.contains('\0') &&
        value.len() <= 256
    }

    fn default_port(&self) -> u16 {
        0 // SQLite doesn't use ports
    }

    fn supported_features(&self) -> Vec<DatabaseFeature> {
        vec![
            DatabaseFeature::Transactions,
            DatabaseFeature::PreparedStatements,
            DatabaseFeature::Views,
            DatabaseFeature::Triggers,
            DatabaseFeature::FullTextSearch,
        ]
    }

    fn validate_config(&self, config: &ConnectionConfig) -> ConnectionResult<()> {
        if config.database.trim().is_empty() {
            return Err(ConnectionError::ConfigurationError(
                "Database file path is required for SQLite".to_string(),
            ));
        }
        
        // Validate that the path is reasonable
        let path = std::path::Path::new(&config.database);
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                return Err(ConnectionError::ConfigurationError(
                    format!("Directory does not exist: {}", parent.display()),
                ));
            }
        }
        
        Ok(())
    }
}

/// Factory for creating database drivers
pub struct DatabaseDriverFactory;

impl DatabaseDriverFactory {
    pub fn create_driver(database_type: &DatabaseType) -> Box<dyn DatabaseDriver> {
        match database_type {
            DatabaseType::PostgreSQL => Box::new(PostgreSQLDriver::default()),
            DatabaseType::MySQL => Box::new(MySQLDriver::default()),
            DatabaseType::SQLite => Box::new(SQLiteDriver::default()),
            DatabaseType::SqlServer => {
                // TODO: Implement SQL Server driver
                panic!("SQL Server driver not yet implemented");
            }
            DatabaseType::Oracle => {
                // TODO: Implement Oracle driver
                panic!("Oracle driver not yet implemented");
            }
        }
    }

    pub fn get_default_port(database_type: &DatabaseType) -> u16 {
        match database_type {
            DatabaseType::PostgreSQL => 5432,
            DatabaseType::MySQL => 3306,
            DatabaseType::SQLite => 0,
            DatabaseType::SqlServer => 1433,
            DatabaseType::Oracle => 1521,
        }
    }
}
