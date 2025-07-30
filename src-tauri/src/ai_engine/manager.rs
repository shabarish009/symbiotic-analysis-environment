//! AI Engine Manager
//! 
//! Main manager for the AI engine lifecycle, including process spawning,
//! monitoring, health checking, and communication management.

use crate::ai_engine::{
    communication::IPCChannel,
    config::AIEngineConfig,
    health::{HealthMonitor, HealthStats},
    types::{AIEngineStatus, AIEngineError, AIStatusUpdate},
};
use std::sync::Arc;
use std::time::Duration;
use tokio::process::Command;
use tokio::sync::{RwLock, mpsc};
use tokio::time::{sleep, timeout};

/// AI Engine Manager
pub struct AIEngineManager {
    /// Current status of the AI engine
    status: Arc<RwLock<AIEngineStatus>>,
    
    /// Configuration for the AI engine
    config: AIEngineConfig,
    
    /// IPC communication channel
    ipc_channel: Arc<IPCChannel>,
    
    /// Health monitor
    health_monitor: Option<HealthMonitor>,
    
    /// Status update sender
    status_sender: mpsc::UnboundedSender<AIStatusUpdate>,
    
    /// Status update receiver
    status_receiver: Arc<tokio::sync::Mutex<mpsc::UnboundedReceiver<AIStatusUpdate>>>,
    
    /// Restart attempt counter
    restart_attempts: Arc<RwLock<u32>>,
    
    /// Shutdown flag
    shutdown_requested: Arc<RwLock<bool>>,
}

impl AIEngineManager {
    /// Create a new AI Engine Manager
    pub fn new(config: AIEngineConfig) -> Self {
        let (status_sender, status_receiver) = mpsc::unbounded_channel();
        
        Self {
            status: Arc::new(RwLock::new(AIEngineStatus::Stopped)),
            config,
            ipc_channel: Arc::new(IPCChannel::new()),
            health_monitor: None,
            status_sender,
            status_receiver: Arc::new(tokio::sync::Mutex::new(status_receiver)),
            restart_attempts: Arc::new(RwLock::new(0)),
            shutdown_requested: Arc::new(RwLock::new(false)),
        }
    }
    
    /// Start the AI engine
    pub async fn start(&mut self) -> Result<(), AIEngineError> {
        log::info!("Starting AI Engine...");
        
        // Validate configuration
        self.config.validate()
            .map_err(|e| AIEngineError::ConfigurationError(e))?;
        
        // Update status to starting
        self.update_status(AIEngineStatus::Starting).await;
        
        // Reset restart attempts
        *self.restart_attempts.write().await = 0;
        
        // Reset shutdown flag
        *self.shutdown_requested.write().await = false;
        
        // Spawn the AI Core process
        match self.spawn_ai_process().await {
            Ok(()) => {
                log::info!("AI Engine started successfully");
                self.update_status(AIEngineStatus::Ready).await;
                
                // Start health monitoring
                self.start_health_monitoring().await;
                
                // Start restart monitoring
                self.start_restart_monitoring().await;
                
                Ok(())
            }
            Err(e) => {
                log::error!("Failed to start AI Engine: {}", e);
                self.update_status(AIEngineStatus::Error(e.to_string())).await;
                Err(e)
            }
        }
    }
    
    /// Stop the AI engine
    pub async fn stop(&mut self) -> Result<(), AIEngineError> {
        log::info!("Stopping AI Engine...");
        
        // Set shutdown flag
        *self.shutdown_requested.write().await = true;
        
        // Stop health monitoring
        if let Some(mut monitor) = self.health_monitor.take() {
            monitor.stop();
        }
        
        // Terminate the process
        self.ipc_channel.terminate().await?;
        
        // Update status
        self.update_status(AIEngineStatus::Stopped).await;
        
        log::info!("AI Engine stopped");
        Ok(())
    }
    
    /// Get current status
    pub async fn get_status(&self) -> AIEngineStatus {
        let status = self.status.read().await;
        status.clone()
    }
    
    /// Get status update receiver
    pub fn get_status_receiver(&self) -> Arc<tokio::sync::Mutex<mpsc::UnboundedReceiver<AIStatusUpdate>>> {
        Arc::clone(&self.status_receiver)
    }
    
    /// Get health statistics
    pub async fn get_health_stats(&self) -> Option<HealthStats> {
        if let Some(monitor) = &self.health_monitor {
            Some(monitor.get_health_stats().await)
        } else {
            None
        }
    }
    
    /// Send a request to the AI engine
    pub async fn send_request(
        &self,
        method: String,
        params: Option<serde_json::Value>,
    ) -> Result<serde_json::Value, AIEngineError> {
        let response = self.ipc_channel.send_request(
            method,
            params,
            self.config.health_check_timeout,
        ).await?;
        
        if let Some(error) = response.error {
            Err(AIEngineError::JsonRpcError(error.message))
        } else {
            Ok(response.result.unwrap_or(serde_json::Value::Null))
        }
    }
    
    /// Send a notification to the AI engine
    pub async fn send_notification(
        &self,
        method: String,
        params: Option<serde_json::Value>,
    ) -> Result<(), AIEngineError> {
        self.ipc_channel.send_notification(method, params).await
    }
    
    /// Spawn the AI Core process
    async fn spawn_ai_process(&mut self) -> Result<(), AIEngineError> {
        log::info!("Spawning AI Core process...");

        // Security: Validate paths before spawning process
        if !self.config.python_executable.exists() &&
           self.config.python_executable != std::path::PathBuf::from("python") &&
           self.config.python_executable != std::path::PathBuf::from("python3") {
            return Err(AIEngineError::ProcessSpawnError(
                "Python executable not found or not allowed".to_string()
            ));
        }

        if !self.config.ai_core_script.exists() {
            return Err(AIEngineError::ProcessSpawnError(
                "AI Core script not found".to_string()
            ));
        }

        let mut command = Command::new(&self.config.python_executable);
        command
            .arg(&self.config.ai_core_script)
            .current_dir(&self.config.working_directory)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true); // Ensure child process is killed when dropped

        // Security: Only set safe environment variables
        for (key, value) in &self.config.environment_variables {
            // Skip potentially dangerous environment variables
            if !key.starts_with("PATH") && !key.starts_with("LD_") && !key.starts_with("DYLD_") {
                command.env(key, value);
            } else {
                log::warn!("Skipping potentially dangerous environment variable: {}", key);
            }
        }

        let child = command.spawn()
            .map_err(|e| AIEngineError::ProcessSpawnError(format!("Failed to spawn process: {}", e)))?;

        log::info!("AI Core process spawned with PID: {:?}", child.id());

        // Start communication with the process
        let mut ipc_channel = IPCChannel::new();
        ipc_channel.start_with_process(child).await?;
        self.ipc_channel = Arc::new(ipc_channel);

        // Wait for the AI Core to report ready status
        self.wait_for_ready().await?;

        log::info!("AI Core process spawned successfully");
        Ok(())
    }
    
    /// Wait for the AI Core to report ready status
    async fn wait_for_ready(&self) -> Result<(), AIEngineError> {
        log::info!("Waiting for AI Core to be ready...");
        
        let ready_check = async {
            loop {
                match self.ipc_channel.send_request(
                    "status".to_string(),
                    None,
                    Duration::from_secs(5),
                ).await {
                    Ok(response) => {
                        if let Some(result) = response.result {
                            if let Ok(status) = serde_json::from_value::<String>(result) {
                                if status == "ready" {
                                    return Ok(());
                                }
                            }
                        }
                    }
                    Err(_) => {
                        // Continue trying
                    }
                }
                
                sleep(Duration::from_millis(500)).await;
            }
        };
        
        timeout(self.config.startup_timeout, ready_check).await
            .map_err(|_| AIEngineError::StartupFailed("Timeout waiting for AI Core to be ready".to_string()))?
    }
    
    /// Start health monitoring
    async fn start_health_monitoring(&mut self) {
        let mut monitor = HealthMonitor::new(
            Arc::clone(&self.ipc_channel),
            self.config.health_check_interval,
            self.config.health_check_timeout,
        );
        
        // Set up health status callback
        let status_sender = self.status_sender.clone();
        let restart_attempts = Arc::clone(&self.restart_attempts);
        let max_attempts = self.config.max_restart_attempts;
        
        monitor.set_status_callback(move |health_result| {
            if !health_result.healthy {
                log::warn!("AI Engine health check failed: {:?}", health_result.error);
                
                // Check if we should attempt restart
                tokio::spawn({
                    let status_sender = status_sender.clone();
                    let restart_attempts = Arc::clone(&restart_attempts);
                    
                    async move {
                        let current_attempts = *restart_attempts.read().await;
                        if current_attempts < max_attempts {
                            let _ = status_sender.send(AIStatusUpdate::new(
                                AIEngineStatus::Restarting,
                                Some(format!("Health check failed, attempting restart ({}/{})", 
                                           current_attempts + 1, max_attempts))
                            ));
                        } else {
                            let _ = status_sender.send(AIStatusUpdate::new(
                                AIEngineStatus::Error("Max restart attempts exceeded".to_string()),
                                None
                            ));
                        }
                    }
                });
            }
        });
        
        monitor.start();
        self.health_monitor = Some(monitor);
        
        log::info!("Health monitoring started");
    }
    
    /// Start restart monitoring
    async fn start_restart_monitoring(&self) {
        let ipc_channel = Arc::clone(&self.ipc_channel);
        let config = self.config.clone();
        let restart_attempts = Arc::clone(&self.restart_attempts);
        let shutdown_requested = Arc::clone(&self.shutdown_requested);
        let status_sender = self.status_sender.clone();
        
        tokio::spawn(async move {
            loop {
                sleep(Duration::from_secs(1)).await;
                
                // Check if shutdown was requested
                if *shutdown_requested.read().await {
                    break;
                }
                
                // Check if process is still running
                if !ipc_channel.is_process_running().await {
                    log::warn!("AI Core process has died");
                    
                    let current_attempts = {
                        let mut attempts = restart_attempts.write().await;
                        *attempts += 1;
                        *attempts
                    };
                    
                    if current_attempts <= config.max_restart_attempts {
                        log::info!("Attempting to restart AI Core ({}/{})", 
                                 current_attempts, config.max_restart_attempts);
                        
                        let _ = status_sender.send(AIStatusUpdate::new(
                            AIEngineStatus::Restarting,
                            Some(format!("Restarting after crash ({}/{})", 
                                       current_attempts, config.max_restart_attempts))
                        ));
                        
                        // Exponential backoff delay
                        let delay = std::cmp::min(
                            config.restart_delay_base.as_secs() * (2_u64.pow(current_attempts - 1)),
                            config.max_restart_delay.as_secs()
                        );
                        
                        sleep(Duration::from_secs(delay)).await;
                        
                        // TODO: Implement restart logic here
                        // This would involve re-spawning the process and re-establishing communication
                        
                    } else {
                        log::error!("Max restart attempts exceeded, giving up");
                        let _ = status_sender.send(AIStatusUpdate::new(
                            AIEngineStatus::Error("Max restart attempts exceeded".to_string()),
                            None
                        ));
                        break;
                    }
                }
            }
        });
    }
    
    /// Update the status and send notification
    async fn update_status(&self, new_status: AIEngineStatus) {
        {
            let mut status = self.status.write().await;
            *status = new_status.clone();
        }
        
        let update = AIStatusUpdate::new(new_status, None);
        let _ = self.status_sender.send(update);
    }
}
