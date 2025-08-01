// In src-tauri/src/ai_engine/manager.rs
use super::types::{
    AIEngineConfig, AIEngineStatus, SQLGenerationRequest, SQLGenerationResponse,
    SQLGenerationProgress, CancellationRequest
};
use std::process::Stdio;
use std::sync::Arc;
use std::collections::HashMap;
use tokio::process::{Child, Command};
use tokio::sync::{broadcast, RwLock, mpsc};
use tokio::time::{self, Duration, timeout};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use serde_json;
use uuid::Uuid;
use chrono::Utc;

pub struct AIEngineManager {
    pub config: Arc<AIEngineConfig>,
    pub status: Arc<RwLock<AIEngineStatus>>,
    status_broadcaster: broadcast::Sender<AIEngineStatus>,
    process_handle: Arc<RwLock<Option<Child>>>,
    active_generations: Arc<RwLock<HashMap<String, mpsc::Sender<()>>>>, // For cancellation
}

impl AIEngineManager {
    pub fn new(config: AIEngineConfig) -> Self {
        let (tx, _) = broadcast::channel(32);
        Self {
            config: Arc::new(config),
            status: Arc::new(RwLock::new(AIEngineStatus::Stopped)),
            status_broadcaster: tx,
            process_handle: Arc::new(RwLock::new(None)),
            active_generations: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    pub async fn start(&self) {
        let mut status = self.status.write().await;
        if *status != AIEngineStatus::Stopped {
            println!("Engine is already running or starting.");
            return;
        }

        *status = AIEngineStatus::Starting;
        self.status_broadcaster.send(status.clone()).ok();
        println!("Attempting to start AI Core process...");

        let child_process = Command::new(&self.config.python_executable)
            .arg(&self.config.ai_core_script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();

        if let Ok(mut process) = child_process {
            *self.process_handle.write().await = Some(process);
            *status = AIEngineStatus::Ready;
            println!("AI Core process started successfully.");
            self.status_broadcaster.send(status.clone()).ok();

            self.spawn_health_check_loop();
        } else {
            let error_msg = "Failed to spawn AI Core process.".to_string();
            *status = AIEngineStatus::Error(error_msg.clone());
            println!("{}", error_msg);
            self.status_broadcaster.send(status.clone()).ok();
        }
    }
    pub async fn stop(&self) {
        let mut status = self.status.write().await;
        let mut process_handle = self.process_handle.write().await;

        if let Some(mut child) = process_handle.take() {
            if let Err(e) = child.kill().await {
                println!("Failed to kill AI Core process: {}", e);
            } else {
                println!("AI Core process stopped.");
            }
        }
        *status = AIEngineStatus::Stopped;
        self.status_broadcaster.send(status.clone()).ok();
    }
    fn spawn_health_check_loop(&self) {
        let status = Arc::clone(&self.status);
        let config = Arc::clone(&self.config);
        let process_handle = Arc::clone(&self.process_handle);
        let broadcaster = self.status_broadcaster.clone();

        tokio::spawn(async move {
            loop {
                time::sleep(Duration::from_millis(config.health_check_interval)).await;
                let current_status = status.read().await.clone();

                if matches!(current_status, AIEngineStatus::Stopped | AIEngineStatus::Error(_)) {
                    break;
                }

                if let Some(child) = process_handle.write().await.as_mut() {
                     match child.try_wait() {
                        Ok(Some(_)) => {
                            let mut s = status.write().await;
                            *s = AIEngineStatus::ProcessCrashed;
                            broadcaster.send(s.clone()).ok();
                            break;
                        }
                        Ok(None) => {
                            // Health check logic would go here
                        }
                        Err(_) => {
                            let mut s = status.write().await;
                            *s = AIEngineStatus::HealthCheckFailed;
                            broadcaster.send(s.clone()).ok();
                            break;
                        }
                    }
                } else {
                    let mut s = status.write().await;
                    *s = AIEngineStatus::ProcessCrashed;
                    broadcaster.send(s.clone()).ok();
                    break;
                }
            }
        });
    }

    pub fn get_status_receiver(&self) -> broadcast::Receiver<AIEngineStatus> {
        self.status_broadcaster.subscribe()
    }

    pub async fn get_status(&self) -> AIEngineStatus {
        self.status.read().await.clone()
    }

    /// Generate SQL from natural language prompt with progress tracking and cancellation support
    pub async fn generate_sql_from_prompt(
        &self,
        request: SQLGenerationRequest,
        progress_callback: Option<mpsc::Sender<SQLGenerationProgress>>,
    ) -> Result<SQLGenerationResponse, String> {
        // Check if AI engine is ready
        let status = self.get_status().await;
        if status != AIEngineStatus::Ready {
            return Err(format!("AI Engine is not ready. Current status: {:?}", status));
        }

        let generation_id = Uuid::new_v4().to_string();
        let (cancel_tx, mut cancel_rx) = mpsc::channel::<()>(1);

        // Register this generation for potential cancellation
        {
            let mut active = self.active_generations.write().await;
            active.insert(generation_id.clone(), cancel_tx);
        }

        let start_time = std::time::Instant::now();

        // Send initial progress
        if let Some(ref progress_tx) = progress_callback {
            let _ = progress_tx.send(SQLGenerationProgress {
                stage: "analyzing".to_string(),
                progress_percent: Some(10),
                message: "Analyzing request...".to_string(),
                timestamp: Utc::now(),
            }).await;
        }

        // Prepare the JSON-RPC request for the AI Core
        let ai_request = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "generate_sql",
            "params": {
                "prompt": request.prompt,
                "connection_id": request.connection_id,
                "schema_context": request.schema_context,
                "options": request.generation_options.unwrap_or_default()
            },
            "id": generation_id
        });

        // Send schema consultation progress
        if let Some(ref progress_tx) = progress_callback {
            let _ = progress_tx.send(SQLGenerationProgress {
                stage: "consulting_schema".to_string(),
                progress_percent: Some(30),
                message: "Consulting database schema...".to_string(),
                timestamp: Utc::now(),
            }).await;
        }

        // Simulate AI processing with timeout and cancellation support
        let timeout_duration = Duration::from_secs(
            request.generation_options
                .as_ref()
                .and_then(|opts| opts.timeout_seconds)
                .unwrap_or(15) as u64
        );

        let generation_result = timeout(timeout_duration, async {
            // Send generation progress
            if let Some(ref progress_tx) = progress_callback {
                let _ = progress_tx.send(SQLGenerationProgress {
                    stage: "generating".to_string(),
                    progress_percent: Some(60),
                    message: "Generating SQL...".to_string(),
                    timestamp: Utc::now(),
                }).await;
            }

            // Check for cancellation
            tokio::select! {
                _ = cancel_rx.recv() => {
                    return Err("Generation cancelled by user".to_string());
                }
                _ = tokio::time::sleep(Duration::from_millis(500)) => {
                    // Continue with generation
                }
            }

            // Send validation progress
            if let Some(ref progress_tx) = progress_callback {
                let _ = progress_tx.send(SQLGenerationProgress {
                    stage: "validating".to_string(),
                    progress_percent: Some(90),
                    message: "Validating query...".to_string(),
                    timestamp: Utc::now(),
                }).await;
            }

            // For now, return a mock response - this will be replaced with actual AI Core communication
            Ok(SQLGenerationResponse {
                success: true,
                generated_sql: Some(format!(
                    "-- Generated SQL for: {}\nSELECT * FROM users WHERE created_at >= NOW() - INTERVAL '30 days';",
                    request.prompt
                )),
                explanation: Some(format!(
                    "This query retrieves all users who were created in the last 30 days based on your request: '{}'",
                    request.prompt
                )),
                confidence_level: Some("High".to_string()),
                confidence_score: Some(0.85),
                warnings: None,
                clarifying_questions: None,
                error_message: None,
                generation_time_ms: Some(start_time.elapsed().as_millis() as u64),
            })
        }).await;

        // Clean up the active generation
        {
            let mut active = self.active_generations.write().await;
            active.remove(&generation_id);
        }

        match generation_result {
            Ok(result) => result,
            Err(_) => Err("SQL generation timed out".to_string()),
        }
    }

    /// Cancel an active SQL generation
    pub async fn cancel_sql_generation(&self, generation_id: String) -> Result<(), String> {
        let active = self.active_generations.read().await;
        if let Some(cancel_tx) = active.get(&generation_id) {
            let _ = cancel_tx.send(()).await;
            Ok(())
        } else {
            Err("Generation not found or already completed".to_string())
        }
    }
}

