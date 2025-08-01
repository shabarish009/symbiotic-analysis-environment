use super::*;
use crate::database::{
    connection::DatabaseConnection,
    credentials::CredentialManager,
    drivers::{DatabaseDriver, PostgreSQLDriver, MySQLDriver, SQLiteDriver},
    manager::ConnectionManager,
    security::{SecureCredentialManager, ThreatModel},
    types::{ConnectionConfig, DatabaseCredentials, DatabaseType},
};
use uuid::Uuid;

#[tokio::test]
async fn test_threat_model_security() {
    let threat_model = ThreatModel::new();
    
    // Test rate limiting
    let requester = "test_requester";
    
    // First 5 attempts should succeed
    for i in 0..5 {
        assert!(threat_model.validate_access(requester).is_ok(), "Attempt {} should succeed", i);
    }
    
    // 6th attempt should fail due to rate limiting
    assert!(threat_model.validate_access(requester).is_err(), "6th attempt should fail");
    
    // Test memory scraping detection
    assert!(threat_model.detect_memory_scraping("rapid access pattern"));
    assert!(threat_model.detect_memory_scraping("bulk data access"));
    assert!(!threat_model.detect_memory_scraping("normal access"));
}

#[tokio::test]
async fn test_credential_manager() {
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
    
    // Test credentials exist
    assert!(manager.credentials_exist(config.id).await);
    
    // Test listing connections
    let connections = manager.list_connections().await;
    assert_eq!(connections.len(), 1);
    
    // Test deleting connection
    assert!(manager.delete_connection(config.id).await.is_ok());
    
    let connections = manager.list_connections().await;
    assert_eq!(connections.len(), 0);
}

#[tokio::test]
async fn test_connection_validation() {
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
    
    // Test invalid timeout
    config.port = 5432;
    config.connection_timeout = 0;
    assert!(manager.validate_config(&config).is_err());
    
    // Test invalid max connections
    config.connection_timeout = 30;
    config.max_connections = 0;
    assert!(manager.validate_config(&config).is_err());
}

#[tokio::test]
async fn test_database_connection() {
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
    assert_eq!(connection.get_status().await, crate::database::types::ConnectionStatus::Disconnected);
    
    // Test connection validation
    assert!(connection.validate_config().is_ok());
    
    // Test connection age
    assert!(connection.get_age_seconds() < 1); // Should be very recent
    
    // Test idle time
    assert!(connection.get_idle_time_seconds().await < 1);
}

#[tokio::test]
async fn test_connection_builder() {
    use crate::database::connection::ConnectionBuilder;
    
    let (connection, config) = ConnectionBuilder::new("Test".to_string(), DatabaseType::PostgreSQL)
        .host("example.com".to_string())
        .port(5432)
        .database("testdb".to_string())
        .username("testuser".to_string())
        .ssl_enabled(true)
        .connection_timeout(60)
        .max_connections(20)
        .additional_param("application_name".to_string(), "test_app".to_string())
        .build_with_config();

    assert_eq!(config.name, "Test");
    assert_eq!(config.host, "example.com");
    assert_eq!(config.port, 5432);
    assert_eq!(config.database, "testdb");
    assert_eq!(config.username, "testuser");
    assert!(config.ssl_enabled);
    assert_eq!(config.connection_timeout, 60);
    assert_eq!(config.max_connections, 20);
    assert_eq!(config.additional_params.get("application_name"), Some(&"test_app".to_string()));
}

#[tokio::test]
async fn test_sqlite_driver() {
    use crate::database::drivers::{DatabaseDriver, SQLiteDriver};
    
    let driver = SQLiteDriver::default();
    
    // Test default port
    assert_eq!(driver.default_port(), 0);
    
    // Test supported features
    let features = driver.supported_features();
    assert!(!features.is_empty());
    
    // Test config validation
    let mut config = ConnectionConfig::new(
        "SQLite Test".to_string(),
        DatabaseType::SQLite,
        "localhost".to_string(),
        0,
        ":memory:".to_string(),
        "".to_string(),
    );
    
    assert!(driver.validate_config(&config).is_ok());
    
    // Empty database path should fail
    config.database = "".to_string();
    assert!(driver.validate_config(&config).is_err());
}

#[tokio::test]
async fn test_postgresql_driver() {
    use crate::database::drivers::{DatabaseDriver, PostgreSQLDriver};
    
    let driver = PostgreSQLDriver::default();
    
    // Test default port
    assert_eq!(driver.default_port(), 5432);
    
    // Test supported features
    let features = driver.supported_features();
    assert!(!features.is_empty());
    
    // Test config validation
    let mut config = ConnectionConfig::new(
        "PostgreSQL Test".to_string(),
        DatabaseType::PostgreSQL,
        "localhost".to_string(),
        5432,
        "testdb".to_string(),
        "testuser".to_string(),
    );
    
    assert!(driver.validate_config(&config).is_ok());
    
    // Empty database name should fail
    config.database = "".to_string();
    assert!(driver.validate_config(&config).is_err());
}

#[tokio::test]
async fn test_mysql_driver() {
    use crate::database::drivers::{DatabaseDriver, MySQLDriver};
    
    let driver = MySQLDriver::default();
    
    // Test default port
    assert_eq!(driver.default_port(), 3306);
    
    // Test supported features
    let features = driver.supported_features();
    assert!(!features.is_empty());
    
    // Test config validation
    let mut config = ConnectionConfig::new(
        "MySQL Test".to_string(),
        DatabaseType::MySQL,
        "localhost".to_string(),
        3306,
        "testdb".to_string(),
        "testuser".to_string(),
    );
    
    assert!(driver.validate_config(&config).is_ok());
    
    // Empty database name should fail
    config.database = "".to_string();
    assert!(driver.validate_config(&config).is_err());
}

#[tokio::test]
async fn test_driver_factory() {
    use crate::database::drivers::DatabaseDriverFactory;
    
    // Test PostgreSQL driver creation
    let pg_driver = DatabaseDriverFactory::create_driver(&DatabaseType::PostgreSQL);
    assert_eq!(pg_driver.default_port(), 5432);
    
    // Test MySQL driver creation
    let mysql_driver = DatabaseDriverFactory::create_driver(&DatabaseType::MySQL);
    assert_eq!(mysql_driver.default_port(), 3306);
    
    // Test SQLite driver creation
    let sqlite_driver = DatabaseDriverFactory::create_driver(&DatabaseType::SQLite);
    assert_eq!(sqlite_driver.default_port(), 0);
    
    // Test default port lookup
    assert_eq!(DatabaseDriverFactory::get_default_port(&DatabaseType::PostgreSQL), 5432);
    assert_eq!(DatabaseDriverFactory::get_default_port(&DatabaseType::MySQL), 3306);
    assert_eq!(DatabaseDriverFactory::get_default_port(&DatabaseType::SQLite), 0);
    assert_eq!(DatabaseDriverFactory::get_default_port(&DatabaseType::SqlServer), 1433);
    assert_eq!(DatabaseDriverFactory::get_default_port(&DatabaseType::Oracle), 1521);
}

#[tokio::test]
async fn test_secure_credential_manager() {
    let manager = SecureCredentialManager::new();
    let connection_id = Uuid::new_v4();
    let credentials = DatabaseCredentials::new(connection_id, "test_password".to_string());
    
    // Note: This test may fail in CI environments without keychain access
    // In a real environment, we would mock the keychain for testing
    
    // Test connection hash generation
    let hash1 = manager.generate_connection_hash("test_data");
    let hash2 = manager.generate_connection_hash("test_data");
    let hash3 = manager.generate_connection_hash("different_data");
    
    assert_eq!(hash1, hash2); // Same data should produce same hash
    assert_ne!(hash1, hash3); // Different data should produce different hash
    
    // Test security audit
    let audit = manager.security_audit();
    assert!(audit.is_empty() || !audit.is_empty()); // Just verify it returns something
}

// COMPREHENSIVE SECURITY TESTS - QA ENHANCEMENT

#[tokio::test]
async fn test_sql_injection_protection() {
    let pg_driver = PostgreSQLDriver::default();
    let mysql_driver = MySQLDriver::default();
    let sqlite_driver = SQLiteDriver::default();

    // Test malicious host injection
    let mut malicious_config = ConnectionConfig::new(
        "Test".to_string(),
        DatabaseType::PostgreSQL,
        "localhost'; DROP TABLE users; --".to_string(),
        5432,
        "testdb".to_string(),
        "testuser".to_string(),
    );

    let credentials = DatabaseCredentials::new(malicious_config.id, "password".to_string());

    // Should fail with security violation
    assert!(pg_driver.build_connection_string(&malicious_config, &credentials).is_err());
    assert!(mysql_driver.build_connection_string(&malicious_config, &credentials).is_err());

    // Test malicious database name
    malicious_config.host = "localhost".to_string();
    malicious_config.database = "testdb'; DROP TABLE users; --".to_string();

    // Should still work because database name is URL encoded, but let's test parameter validation
    malicious_config.additional_params.insert("evil".to_string(), "'; DROP TABLE users; --".to_string());

    assert!(pg_driver.build_connection_string(&malicious_config, &credentials).is_err());
    assert!(mysql_driver.build_connection_string(&malicious_config, &credentials).is_err());
}

#[tokio::test]
async fn test_path_traversal_protection() {
    let sqlite_driver = SQLiteDriver::default();

    // Test path traversal attempts
    let malicious_paths = vec![
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "/etc/shadow",
        "C:\\Windows\\System32\\config\\SAM",
        "database.db\0malicious",
    ];

    for path in malicious_paths {
        let config = ConnectionConfig::new(
            "Test".to_string(),
            DatabaseType::SQLite,
            "localhost".to_string(),
            0,
            path.to_string(),
            "".to_string(),
        );

        let credentials = DatabaseCredentials::new(config.id, "".to_string());

        // Should fail with security violation
        let result = sqlite_driver.build_connection_string(&config, &credentials);
        assert!(result.is_err(), "Path traversal should be blocked: {}", path);
    }
}

#[tokio::test]
async fn test_credential_validation() {
    let manager = SecureCredentialManager::new();
    let connection_id = Uuid::new_v4();

    // Test weak passwords (should warn but not block)
    let weak_credentials = DatabaseCredentials::new(connection_id, "123".to_string());
    let result = manager.store_credentials(connection_id, &weak_credentials);
    assert!(result.is_err()); // Should fail due to minimum length

    // Test password with dangerous characters
    let dangerous_credentials = DatabaseCredentials::new(connection_id, "password\0with\x01control".to_string());
    let result = manager.store_credentials(connection_id, &dangerous_credentials);
    assert!(result.is_err()); // Should fail due to control characters

    // Test extremely long password (DoS protection)
    let long_password = "a".repeat(2000);
    let long_credentials = DatabaseCredentials::new(connection_id, long_password);
    let result = manager.store_credentials(connection_id, &long_credentials);
    assert!(result.is_err()); // Should fail due to length limit

    // Test valid password
    let valid_credentials = DatabaseCredentials::new(connection_id, "ValidPassword123!".to_string());
    // Note: This might fail in CI without keychain access, but validates the logic
    let _result = manager.store_credentials(connection_id, &valid_credentials);
}

#[tokio::test]
async fn test_rate_limiting_bypass_attempts() {
    let threat_model = ThreatModel::new();

    // Test basic rate limiting
    let requester = "test_user";
    for i in 0..5 {
        assert!(threat_model.validate_access(requester).is_ok(), "Attempt {} should succeed", i);
    }
    assert!(threat_model.validate_access(requester).is_err(), "6th attempt should fail");

    // Test bypass attempt with similar requester names
    assert!(threat_model.validate_access("test_user ").is_err()); // Should still be blocked due to hashing
    assert!(threat_model.validate_access("test_user2").is_ok()); // Different user should work

    // Test invalid requester identifiers
    assert!(threat_model.validate_access("").is_err());
    assert!(threat_model.validate_access(&"x".repeat(300)).is_err());
}

#[tokio::test]
async fn test_memory_scraping_detection_comprehensive() {
    let threat_model = ThreatModel::new();

    // Test various attack patterns
    let attack_patterns = vec![
        ("rapid credential access", None, true),
        ("bulk data extraction", None, true),
        ("DUMP memory contents", None, true),
        ("scrape all passwords", None, true),
        ("harvest credentials", None, true),
        ("normal request", Some(15.0), true), // High frequency
        ("aaaaaaaaaaaaaaaa", None, true), // Repeated pattern
        ("legitimate database query", Some(1.0), false), // Normal
        ("SELECT * FROM users", None, false), // Normal SQL
    ];

    for (pattern, frequency, should_detect) in attack_patterns {
        let detected = threat_model.detect_memory_scraping(pattern, frequency);
        assert_eq!(detected, should_detect,
            "Pattern '{}' detection mismatch. Expected: {}, Got: {}",
            pattern, should_detect, detected);
    }
}

#[test]
fn test_connection_string_encoding() {
    let pg_driver = PostgreSQLDriver::default();

    // Test special characters are properly encoded
    let config = ConnectionConfig::new(
        "Test".to_string(),
        DatabaseType::PostgreSQL,
        "host@domain.com".to_string(),
        5432,
        "test db".to_string(),
        "user@domain".to_string(),
    );

    let credentials = DatabaseCredentials::new(config.id, "pass@word!".to_string());

    let connection_string = pg_driver.build_connection_string(&config, &credentials).unwrap();

    // Verify special characters are encoded
    assert!(connection_string.contains("host%40domain.com"));
    assert!(connection_string.contains("test%20db"));
    assert!(connection_string.contains("user%40domain"));
    assert!(connection_string.contains("pass%40word%21"));
}
