//! AI Engine Configuration
//! 
//! Configuration management for the AI engine process

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;

/// AI Engine Configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIEngineConfig {
    /// Path to the Python executable
    pub python_executable: PathBuf,
    
    /// Path to the AI Core script
    pub ai_core_script: PathBuf,
    
    /// Working directory for the AI process
    pub working_directory: PathBuf,
    
    /// Environment variables for the AI process
    pub environment_variables: std::collections::HashMap<String, String>,
    
    /// Startup timeout duration
    pub startup_timeout: Duration,
    
    /// Health check interval
    pub health_check_interval: Duration,
    
    /// Health check timeout
    pub health_check_timeout: Duration,
    
    /// Maximum restart attempts
    pub max_restart_attempts: u32,
    
    /// Restart delay (exponential backoff base)
    pub restart_delay_base: Duration,
    
    /// Maximum restart delay
    pub max_restart_delay: Duration,
    
    /// Enable debug logging
    pub debug_logging: bool,
    
    /// Log file path
    pub log_file_path: Option<PathBuf>,
}

impl Default for AIEngineConfig {
    fn default() -> Self {
        Self {
            python_executable: PathBuf::from("python"),
            ai_core_script: PathBuf::from("ai_core/main.py"),
            working_directory: std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
            environment_variables: std::collections::HashMap::new(),
            startup_timeout: Duration::from_secs(30),
            health_check_interval: Duration::from_secs(10),
            health_check_timeout: Duration::from_secs(5),
            max_restart_attempts: 3,
            restart_delay_base: Duration::from_secs(2),
            max_restart_delay: Duration::from_secs(60),
            debug_logging: cfg!(debug_assertions),
            log_file_path: None,
        }
    }
}

impl AIEngineConfig {
    /// Create a new configuration with default values
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Set the Python executable path
    pub fn with_python_executable(mut self, path: PathBuf) -> Self {
        self.python_executable = path;
        self
    }
    
    /// Set the AI Core script path
    pub fn with_ai_core_script(mut self, path: PathBuf) -> Self {
        self.ai_core_script = path;
        self
    }
    
    /// Set the working directory
    pub fn with_working_directory(mut self, path: PathBuf) -> Self {
        self.working_directory = path;
        self
    }
    
    /// Add an environment variable
    pub fn with_env_var(mut self, key: String, value: String) -> Self {
        self.environment_variables.insert(key, value);
        self
    }
    
    /// Set startup timeout
    pub fn with_startup_timeout(mut self, timeout: Duration) -> Self {
        self.startup_timeout = timeout;
        self
    }
    
    /// Set health check interval
    pub fn with_health_check_interval(mut self, interval: Duration) -> Self {
        self.health_check_interval = interval;
        self
    }
    
    /// Set maximum restart attempts
    pub fn with_max_restart_attempts(mut self, attempts: u32) -> Self {
        self.max_restart_attempts = attempts;
        self
    }
    
    /// Enable debug logging
    pub fn with_debug_logging(mut self, enabled: bool) -> Self {
        self.debug_logging = enabled;
        self
    }
    
    /// Set log file path
    pub fn with_log_file(mut self, path: PathBuf) -> Self {
        self.log_file_path = Some(path);
        self
    }
    
    /// Validate the configuration
    pub fn validate(&self) -> Result<(), String> {
        // Security: Validate Python executable path to prevent arbitrary code execution
        let python_exe_str = self.python_executable.to_string_lossy();
        if python_exe_str.contains("..") || python_exe_str.contains("~") {
            return Err("Python executable path contains potentially unsafe characters".to_string());
        }

        // Check if Python executable exists (allow system python)
        if !self.python_executable.exists() &&
           self.python_executable != PathBuf::from("python") &&
           self.python_executable != PathBuf::from("python3") {
            return Err(format!("Python executable not found: {:?}", self.python_executable));
        }

        // Security: Validate AI Core script path
        let script_path_str = self.ai_core_script.to_string_lossy();
        if script_path_str.contains("..") {
            return Err("AI Core script path contains potentially unsafe characters".to_string());
        }

        // Check if AI Core script exists
        if !self.ai_core_script.exists() {
            return Err(format!("AI Core script not found: {:?}", self.ai_core_script));
        }

        // Security: Validate working directory path
        let work_dir_str = self.working_directory.to_string_lossy();
        if work_dir_str.contains("..") {
            return Err("Working directory path contains potentially unsafe characters".to_string());
        }

        // Check if working directory exists
        if !self.working_directory.exists() {
            return Err(format!("Working directory not found: {:?}", self.working_directory));
        }

        // Validate timeout values
        if self.startup_timeout.as_secs() == 0 {
            return Err("Startup timeout must be greater than 0".to_string());
        }

        if self.startup_timeout.as_secs() > 300 {
            return Err("Startup timeout too large (max 300 seconds)".to_string());
        }

        if self.health_check_interval.as_secs() == 0 {
            return Err("Health check interval must be greater than 0".to_string());
        }

        if self.health_check_timeout.as_secs() == 0 {
            return Err("Health check timeout must be greater than 0".to_string());
        }

        // Validate restart attempts
        if self.max_restart_attempts > 10 {
            return Err("Maximum restart attempts too high (max 10)".to_string());
        }

        // Security: Validate environment variables
        for (key, value) in &self.environment_variables {
            if key.contains('\0') || value.contains('\0') {
                return Err("Environment variables cannot contain null bytes".to_string());
            }
            if key.len() > 1000 || value.len() > 10000 {
                return Err("Environment variable key or value too long".to_string());
            }
        }

        Ok(())
    }
    
    /// Load configuration from a file
    pub fn from_file(path: &PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let content = std::fs::read_to_string(path)?;
        let config: Self = serde_json::from_str(&content)?;
        config.validate().map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, e)) as Box<dyn std::error::Error>)?;
        Ok(config)
    }
    
    /// Save configuration to a file
    pub fn to_file(&self, path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }
}
