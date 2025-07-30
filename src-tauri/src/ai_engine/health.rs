//! AI Engine Health Monitoring
//! 
//! Health checking and monitoring for the AI engine process

use crate::ai_engine::communication::IPCChannel;
use crate::ai_engine::types::{HealthCheckResult, AIEngineError};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};

/// Health Monitor for the AI Engine
pub struct HealthMonitor {
    /// IPC channel for communication
    ipc_channel: Arc<IPCChannel>,
    
    /// Health check interval
    check_interval: Duration,
    
    /// Health check timeout
    check_timeout: Duration,
    
    /// Last health check result
    last_result: Arc<RwLock<Option<HealthCheckResult>>>,
    
    /// Health check task handle
    task_handle: Option<tokio::task::JoinHandle<()>>,
    
    /// Health status callback
    status_callback: Option<Arc<dyn Fn(HealthCheckResult) + Send + Sync>>,
}

impl HealthMonitor {
    /// Create a new health monitor
    pub fn new(
        ipc_channel: Arc<IPCChannel>,
        check_interval: Duration,
        check_timeout: Duration,
    ) -> Self {
        Self {
            ipc_channel,
            check_interval,
            check_timeout,
            last_result: Arc::new(RwLock::new(None)),
            task_handle: None,
            status_callback: None,
        }
    }
    
    /// Set a callback for health status updates
    pub fn set_status_callback<F>(&mut self, callback: F)
    where
        F: Fn(HealthCheckResult) + Send + Sync + 'static,
    {
        self.status_callback = Some(Arc::new(callback));
    }
    
    /// Start health monitoring
    pub fn start(&mut self) {
        if self.task_handle.is_some() {
            log::warn!("Health monitor is already running");
            return;
        }
        
        let ipc_channel = Arc::clone(&self.ipc_channel);
        let check_interval = self.check_interval;
        let check_timeout = self.check_timeout;
        let last_result = Arc::clone(&self.last_result);
        let status_callback = self.status_callback.clone();
        
        let handle = tokio::spawn(async move {
            let mut interval_timer = interval(check_interval);
            
            loop {
                interval_timer.tick().await;
                
                let result = Self::perform_health_check(
                    &ipc_channel,
                    check_timeout,
                ).await;
                
                // Update last result
                {
                    let mut last = last_result.write().await;
                    *last = Some(result.clone());
                }
                
                // Call status callback if set
                if let Some(callback) = &status_callback {
                    callback(result);
                }
            }
        });
        
        self.task_handle = Some(handle);
        log::info!("Health monitor started with interval: {:?}", self.check_interval);
    }
    
    /// Stop health monitoring
    pub fn stop(&mut self) {
        if let Some(handle) = self.task_handle.take() {
            handle.abort();
            log::info!("Health monitor stopped");
        }
    }
    
    /// Perform a single health check
    pub async fn check_health(&self) -> HealthCheckResult {
        Self::perform_health_check(&self.ipc_channel, self.check_timeout).await
    }
    
    /// Get the last health check result
    pub async fn last_health_result(&self) -> Option<HealthCheckResult> {
        let last = self.last_result.read().await;
        last.clone()
    }
    
    /// Check if the AI engine is healthy based on the last check
    pub async fn is_healthy(&self) -> bool {
        if let Some(result) = self.last_health_result().await {
            result.healthy
        } else {
            false
        }
    }
    
    /// Perform the actual health check
    async fn perform_health_check(
        ipc_channel: &IPCChannel,
        timeout_duration: Duration,
    ) -> HealthCheckResult {
        let start_time = Instant::now();
        
        // First check if the process is still running
        if !ipc_channel.is_process_running().await {
            return HealthCheckResult::unhealthy("AI Core process is not running".to_string());
        }
        
        // Send a ping request
        match ipc_channel.send_request(
            "ping".to_string(),
            None,
            timeout_duration,
        ).await {
            Ok(response) => {
                let response_time = start_time.elapsed().as_millis() as u64;
                
                // Check if the response indicates success
                if response.error.is_some() {
                    HealthCheckResult::unhealthy(
                        format!("Ping failed: {:?}", response.error)
                    )
                } else {
                    HealthCheckResult::healthy(response_time)
                }
            }
            Err(AIEngineError::TimeoutError(_)) => {
                HealthCheckResult::unhealthy("Health check timed out".to_string())
            }
            Err(e) => {
                HealthCheckResult::unhealthy(format!("Health check error: {}", e))
            }
        }
    }
    
    /// Get health statistics
    pub async fn get_health_stats(&self) -> HealthStats {
        let last_result = self.last_health_result().await;
        
        HealthStats {
            is_healthy: last_result.as_ref().map(|r| r.healthy).unwrap_or(false),
            last_check_time: last_result.as_ref().map(|r| r.timestamp),
            last_response_time: last_result.as_ref().map(|r| r.response_time_ms),
            last_error: last_result.as_ref().and_then(|r| r.error.clone()),
        }
    }
}

impl Drop for HealthMonitor {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Health statistics
#[derive(Debug, Clone)]
pub struct HealthStats {
    pub is_healthy: bool,
    pub last_check_time: Option<u64>,
    pub last_response_time: Option<u64>,
    pub last_error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_engine::communication::IPCChannel;
    
    #[tokio::test]
    async fn test_health_monitor_creation() {
        let ipc_channel = Arc::new(IPCChannel::new());
        let monitor = HealthMonitor::new(
            ipc_channel,
            Duration::from_secs(5),
            Duration::from_secs(2),
        );
        
        assert!(monitor.task_handle.is_none());
        assert!(monitor.last_health_result().await.is_none());
    }
    
    #[tokio::test]
    async fn test_health_stats() {
        let ipc_channel = Arc::new(IPCChannel::new());
        let monitor = HealthMonitor::new(
            ipc_channel,
            Duration::from_secs(5),
            Duration::from_secs(2),
        );
        
        let stats = monitor.get_health_stats().await;
        assert!(!stats.is_healthy);
        assert!(stats.last_check_time.is_none());
        assert!(stats.last_response_time.is_none());
        assert!(stats.last_error.is_none());
    }
}
