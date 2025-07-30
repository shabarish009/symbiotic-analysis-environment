//! AI Engine Tests
//! 
//! Comprehensive tests for the AI engine implementation

#[cfg(test)]
mod tests {
    use super::super::*;
    use std::time::Duration;
    use tokio::time::timeout;

    #[tokio::test]
    async fn test_ai_engine_config_validation() {
        let mut config = AIEngineConfig::default();
        
        // Test valid configuration
        assert!(config.validate().is_ok());
        
        // Test invalid timeout
        config.startup_timeout = Duration::from_secs(0);
        assert!(config.validate().is_err());
        
        // Test timeout too large
        config.startup_timeout = Duration::from_secs(400);
        assert!(config.validate().is_err());
        
        // Reset to valid
        config.startup_timeout = Duration::from_secs(30);
        assert!(config.validate().is_ok());
        
        // Test too many restart attempts
        config.max_restart_attempts = 20;
        assert!(config.validate().is_err());
    }

    #[tokio::test]
    async fn test_ai_engine_config_security() {
        let mut config = AIEngineConfig::default();
        
        // Test path traversal protection
        config.python_executable = std::path::PathBuf::from("../../../usr/bin/python");
        assert!(config.validate().is_err());
        
        config.ai_core_script = std::path::PathBuf::from("../../../etc/passwd");
        assert!(config.validate().is_err());
        
        config.working_directory = std::path::PathBuf::from("../../..");
        assert!(config.validate().is_err());
        
        // Test environment variable validation
        config = AIEngineConfig::default();
        config.environment_variables.insert("TEST\0".to_string(), "value".to_string());
        assert!(config.validate().is_err());
        
        config.environment_variables.clear();
        config.environment_variables.insert("TEST".to_string(), "value\0".to_string());
        assert!(config.validate().is_err());
        
        // Test oversized environment variables
        config.environment_variables.clear();
        config.environment_variables.insert("A".repeat(2000), "value".to_string());
        assert!(config.validate().is_err());
        
        config.environment_variables.clear();
        config.environment_variables.insert("TEST".to_string(), "A".repeat(20000));
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_json_rpc_message_creation() {
        // Test request creation
        let request = JsonRpcMessage::new_request(
            "test_method".to_string(),
            Some(serde_json::json!({"param": "value"})),
            Some(serde_json::Value::String("123".to_string()))
        );
        
        assert_eq!(request.jsonrpc, "2.0");
        assert_eq!(request.method, "test_method");
        assert!(request.params.is_some());
        assert!(request.id.is_some());
        
        // Test notification creation
        let notification = JsonRpcMessage::new_notification(
            "test_notification".to_string(),
            Some(serde_json::json!({"data": "test"}))
        );
        
        assert_eq!(notification.jsonrpc, "2.0");
        assert_eq!(notification.method, "test_notification");
        assert!(notification.params.is_some());
        assert!(notification.id.is_none());
    }

    #[test]
    fn test_ai_status_update() {
        let status_update = AIStatusUpdate::new(
            AIEngineStatus::Ready,
            Some("Test message".to_string())
        );
        
        assert_eq!(status_update.status, AIEngineStatus::Ready);
        assert_eq!(status_update.message, Some("Test message".to_string()));
        assert!(status_update.timestamp > 0);
    }

    #[test]
    fn test_health_check_result() {
        let healthy = HealthCheckResult::healthy(100);
        assert!(healthy.healthy);
        assert_eq!(healthy.response_time_ms, 100);
        assert!(healthy.error.is_none());
        assert!(healthy.timestamp > 0);
        
        let unhealthy = HealthCheckResult::unhealthy("Test error".to_string());
        assert!(!unhealthy.healthy);
        assert_eq!(unhealthy.response_time_ms, 0);
        assert_eq!(unhealthy.error, Some("Test error".to_string()));
        assert!(unhealthy.timestamp > 0);
    }

    #[test]
    fn test_ai_engine_status_display() {
        assert_eq!(AIEngineStatus::Starting.to_string(), "Starting");
        assert_eq!(AIEngineStatus::Ready.to_string(), "Ready");
        assert_eq!(AIEngineStatus::Stopped.to_string(), "Stopped");
        assert_eq!(AIEngineStatus::Restarting.to_string(), "Restarting");
        assert_eq!(AIEngineStatus::Error("test".to_string()).to_string(), "Error: test");
    }

    #[tokio::test]
    async fn test_ipc_channel_creation() {
        let channel = IPCChannel::new();
        
        // Test that the channel is not running initially
        assert!(!channel.is_process_running().await);
    }

    #[tokio::test]
    async fn test_health_monitor_creation() {
        let ipc_channel = std::sync::Arc::new(IPCChannel::new());
        let monitor = HealthMonitor::new(
            ipc_channel,
            Duration::from_secs(5),
            Duration::from_secs(2)
        );
        
        // Test initial state
        assert!(monitor.last_health_result().await.is_none());
        assert!(!monitor.is_healthy().await);
        
        let stats = monitor.get_health_stats().await;
        assert!(!stats.is_healthy);
        assert!(stats.last_check_time.is_none());
    }

    #[tokio::test]
    async fn test_ai_engine_manager_creation() {
        let config = AIEngineConfig::default();
        let manager = AIEngineManager::new(config);
        
        // Test initial status
        let status = manager.get_status().await;
        assert_eq!(status, AIEngineStatus::Stopped);
        
        // Test health stats (should be None initially)
        let health_stats = manager.get_health_stats().await;
        assert!(health_stats.is_none());
    }

    #[test]
    fn test_error_types() {
        let errors = vec![
            AIEngineError::ProcessSpawnError("test".to_string()),
            AIEngineError::ProcessCrashed("test".to_string()),
            AIEngineError::CommunicationError("test".to_string()),
            AIEngineError::ConfigurationError("test".to_string()),
            AIEngineError::TimeoutError("test".to_string()),
            AIEngineError::JsonRpcError("test".to_string()),
            AIEngineError::HealthCheckFailed("test".to_string()),
            AIEngineError::StartupFailed("test".to_string()),
        ];
        
        for error in errors {
            // Test that all errors implement Display
            let _error_string = error.to_string();
            
            // Test that all errors implement Debug
            let _debug_string = format!("{:?}", error);
        }
    }

    #[test]
    fn test_config_builder_pattern() {
        let config = AIEngineConfig::new()
            .with_python_executable(std::path::PathBuf::from("python3"))
            .with_startup_timeout(Duration::from_secs(60))
            .with_max_restart_attempts(5)
            .with_debug_logging(true);
        
        assert_eq!(config.python_executable, std::path::PathBuf::from("python3"));
        assert_eq!(config.startup_timeout, Duration::from_secs(60));
        assert_eq!(config.max_restart_attempts, 5);
        assert!(config.debug_logging);
    }

    #[test]
    fn test_json_serialization() {
        let status = AIEngineStatus::Ready;
        let json = serde_json::to_string(&status).unwrap();
        let deserialized: AIEngineStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(status, deserialized);
        
        let error_status = AIEngineStatus::Error("test error".to_string());
        let json = serde_json::to_string(&error_status).unwrap();
        let deserialized: AIEngineStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(error_status, deserialized);
    }

    #[tokio::test]
    async fn test_concurrent_access() {
        let config = AIEngineConfig::default();
        let manager = std::sync::Arc::new(tokio::sync::RwLock::new(AIEngineManager::new(config)));
        
        // Test concurrent status reads
        let handles: Vec<_> = (0..10).map(|_| {
            let manager = std::sync::Arc::clone(&manager);
            tokio::spawn(async move {
                let manager_guard = manager.read().await;
                manager_guard.get_status().await
            })
        }).collect();
        
        for handle in handles {
            let status = handle.await.unwrap();
            assert_eq!(status, AIEngineStatus::Stopped);
        }
    }
}
