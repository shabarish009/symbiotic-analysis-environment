// AI Engine module
mod ai_engine;

use ai_engine::{AIEngineManager, AIEngineConfig, AIEngineStatus};
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::RwLock;
use serde_json::Value;

// Global AI Engine Manager
type AIEngineManagerState = Arc<RwLock<Option<AIEngineManager>>>;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to the Symbiotic Analysis Environment.", name)
}

// AI Engine Commands
#[tauri::command]
async fn start_ai_engine(
    ai_manager: tauri::State<'_, AIEngineManagerState>,
) -> Result<String, String> {
    log::info!("Starting AI Engine via Tauri command");

    let mut manager_guard = ai_manager.write().await;

    if manager_guard.is_none() {
        // Create a new AI Engine Manager with default configuration
        let config = AIEngineConfig::default();
        let mut manager = AIEngineManager::new(config);

        match manager.start().await {
            Ok(()) => {
                *manager_guard = Some(manager);
                Ok("AI Engine started successfully".to_string())
            }
            Err(e) => {
                log::error!("Failed to start AI Engine: {}", e);
                Err(format!("Failed to start AI Engine: {}", e))
            }
        }
    } else {
        Err("AI Engine is already running".to_string())
    }
}

#[tauri::command]
async fn stop_ai_engine(
    ai_manager: tauri::State<'_, AIEngineManagerState>,
) -> Result<String, String> {
    log::info!("Stopping AI Engine via Tauri command");

    let mut manager_guard = ai_manager.write().await;

    if let Some(mut manager) = manager_guard.take() {
        match manager.stop().await {
            Ok(()) => Ok("AI Engine stopped successfully".to_string()),
            Err(e) => {
                log::error!("Failed to stop AI Engine: {}", e);
                Err(format!("Failed to stop AI Engine: {}", e))
            }
        }
    } else {
        Err("AI Engine is not running".to_string())
    }
}

#[tauri::command]
async fn get_ai_engine_status(
    ai_manager: tauri::State<'_, AIEngineManagerState>,
) -> Result<String, String> {
    let manager_guard = ai_manager.read().await;

    if let Some(manager) = manager_guard.as_ref() {
        let status = manager.get_status().await;
        Ok(serde_json::to_string(&status).unwrap_or_else(|_| "unknown".to_string()))
    } else {
        Ok(serde_json::to_string(&AIEngineStatus::Stopped).unwrap_or_else(|_| "stopped".to_string()))
    }
}

#[tauri::command]
async fn send_ai_request(
    ai_manager: tauri::State<'_, AIEngineManagerState>,
    method: String,
    params: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let manager_guard = ai_manager.read().await;

    if let Some(manager) = manager_guard.as_ref() {
        match manager.send_request(method, params).await {
            Ok(result) => Ok(result),
            Err(e) => {
                log::error!("AI request failed: {}", e);
                Err(format!("AI request failed: {}", e))
            }
        }
    } else {
        Err("AI Engine is not running".to_string())
    }
}

// Thought Process Commands
#[tauri::command]
async fn subscribe_thought_process(
    ai_manager: tauri::State<'_, AIEngineManagerState>,
    query_id: Option<String>,
) -> Result<String, String> {
    log::info!("Subscribing to thought process updates");

    let manager_guard = ai_manager.read().await;

    if let Some(manager) = manager_guard.as_ref() {
        // Send subscription request to AI Core
        let params = serde_json::json!({
            "query_id": query_id
        });

        match manager.send_request("thought_process.subscribe".to_string(), Some(params)).await {
            Ok(response) => {
                // IMPROVEMENT: Enhanced response validation
                if let Some(success) = response.get("success") {
                    if success.as_bool().unwrap_or(false) {
                        if let Some(subscriber_id) = response.get("subscriber_id") {
                            let id = subscriber_id.as_str().unwrap_or("unknown").to_string();
                            if id != "unknown" && !id.is_empty() {
                                Ok(id)
                            } else {
                                Err("Invalid subscriber ID received".to_string())
                            }
                        } else {
                            Err("No subscriber ID in response".to_string())
                        }
                    } else {
                        let error_msg = response.get("error")
                            .and_then(|e| e.as_str())
                            .unwrap_or("Unknown error");
                        Err(format!("Subscription failed: {}", error_msg))
                    }
                } else {
                    Err("Invalid response format".to_string())
                }
            }
            Err(e) => {
                log::error!("Failed to subscribe to thought process: {}", e);
                Err(format!("Failed to subscribe: {}", e))
            }
        }
    } else {
        Err("AI Engine is not running".to_string())
    }
}

#[tauri::command]
async fn unsubscribe_thought_process(
    ai_manager: tauri::State<'_, AIEngineManagerState>,
    subscriber_id: String,
) -> Result<String, String> {
    log::info!("Unsubscribing from thought process updates");

    let manager_guard = ai_manager.read().await;

    if let Some(manager) = manager_guard.as_ref() {
        let params = serde_json::json!({
            "subscriber_id": subscriber_id
        });

        match manager.send_request("thought_process.unsubscribe".to_string(), Some(params)).await {
            Ok(_) => Ok("Unsubscribed successfully".to_string()),
            Err(e) => {
                log::error!("Failed to unsubscribe from thought process: {}", e);
                Err(format!("Failed to unsubscribe: {}", e))
            }
        }
    } else {
        Err("AI Engine is not running".to_string())
    }
}

#[tauri::command]
async fn get_thought_process_history(
    ai_manager: tauri::State<'_, AIEngineManagerState>,
    limit: Option<u32>,
) -> Result<Value, String> {
    log::info!("Getting thought process history");

    let manager_guard = ai_manager.read().await;

    if let Some(manager) = manager_guard.as_ref() {
        let params = serde_json::json!({
            "limit": limit.unwrap_or(50)
        });

        match manager.send_request("thought_process.history".to_string(), Some(params)).await {
            Ok(response) => Ok(response),
            Err(e) => {
                log::error!("Failed to get thought process history: {}", e);
                Err(format!("Failed to get history: {}", e))
            }
        }
    } else {
        Err("AI Engine is not running".to_string())
    }
}

// Memory system Tauri commands
#[tauri::command]
async fn get_memory_context(
    query: String,
    project_id: String,
    ai_manager: tauri::State<'_, AIEngineManagerState>
) -> Result<Value, String> {
    // SECURITY: Input validation
    if query.trim().is_empty() {
        return Err("Query cannot be empty".to_string());
    }
    if query.len() > 10000 {
        return Err("Query too long (max 10000 characters)".to_string());
    }
    if project_id.trim().is_empty() {
        return Err("Project ID cannot be empty".to_string());
    }
    if !project_id.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
        return Err("Invalid project ID format".to_string());
    }

    log::info!("Getting memory context for project: {}", project_id);

    let manager_guard = ai_manager.read().await;

    if let Some(manager) = manager_guard.as_ref() {
        let params = serde_json::json!({
            "query": query,
            "project_id": project_id
        });

        match manager.send_request("memory.get_context".to_string(), Some(params)).await {
            Ok(response) => Ok(response),
            Err(e) => {
                log::error!("Failed to get memory context: {}", e);
                Err(format!("Failed to get memory context: {}", e))
            }
        }
    } else {
        Err("AI Engine is not running".to_string())
    }
}

#[tauri::command]
async fn get_memory_statistics(
    project_id: Option<String>,
    ai_manager: tauri::State<'_, AIEngineManagerState>
) -> Result<Value, String> {
    log::info!("Getting memory statistics");

    let manager_guard = ai_manager.read().await;

    if let Some(manager) = manager_guard.as_ref() {
        let params = if let Some(pid) = project_id {
            serde_json::json!({"project_id": pid})
        } else {
            serde_json::json!({})
        };

        match manager.send_request("memory.get_statistics".to_string(), Some(params)).await {
            Ok(response) => Ok(response),
            Err(e) => {
                log::error!("Failed to get memory statistics: {}", e);
                Err(format!("Failed to get memory statistics: {}", e))
            }
        }
    } else {
        Err("AI Engine is not running".to_string())
    }
}

#[tauri::command]
async fn get_query_history(
    project_id: String,
    limit: Option<u32>,
    ai_manager: tauri::State<'_, AIEngineManagerState>
) -> Result<Value, String> {
    // SECURITY: Input validation
    if project_id.trim().is_empty() {
        return Err("Project ID cannot be empty".to_string());
    }
    if !project_id.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
        return Err("Invalid project ID format".to_string());
    }
    if let Some(l) = limit {
        if l > 1000 {
            return Err("Limit too high (max 1000)".to_string());
        }
    }

    log::info!("Getting query history for project: {}", project_id);

    let manager_guard = ai_manager.read().await;

    if let Some(manager) = manager_guard.as_ref() {
        let params = serde_json::json!({
            "project_id": project_id,
            "limit": limit.unwrap_or(50)
        });

        match manager.send_request("memory.get_query_history".to_string(), Some(params)).await {
            Ok(response) => Ok(response),
            Err(e) => {
                log::error!("Failed to get query history: {}", e);
                Err(format!("Failed to get query history: {}", e))
            }
        }
    } else {
        Err("AI Engine is not running".to_string())
    }
}

#[tauri::command]
async fn get_schema_suggestions(
    project_id: String,
    partial_query: String,
    ai_manager: tauri::State<'_, AIEngineManagerState>
) -> Result<Value, String> {
    log::info!("Getting schema suggestions for project: {}", project_id);

    let manager_guard = ai_manager.read().await;

    if let Some(manager) = manager_guard.as_ref() {
        let params = serde_json::json!({
            "project_id": project_id,
            "partial_query": partial_query
        });

        match manager.send_request("memory.get_schema_suggestions".to_string(), Some(params)).await {
            Ok(response) => Ok(response),
            Err(e) => {
                log::error!("Failed to get schema suggestions: {}", e);
                Err(format!("Failed to get schema suggestions: {}", e))
            }
        }
    } else {
        Err("AI Engine is not running".to_string())
    }
}

#[tauri::command]
async fn create_memory_project(
    project_id: String,
    name: String,
    metadata: Option<Value>,
    ai_manager: tauri::State<'_, AIEngineManagerState>
) -> Result<Value, String> {
    log::info!("Creating memory project: {}", project_id);

    let manager_guard = ai_manager.read().await;

    if let Some(manager) = manager_guard.as_ref() {
        let params = serde_json::json!({
            "project_id": project_id,
            "name": name,
            "metadata": metadata.unwrap_or(serde_json::json!({}))
        });

        match manager.send_request("memory.create_project".to_string(), Some(params)).await {
            Ok(response) => Ok(response),
            Err(e) => {
                log::error!("Failed to create project: {}", e);
                Err(format!("Failed to create project: {}", e))
            }
        }
    } else {
        Err("AI Engine is not running".to_string())
    }
}

#[tauri::command]
async fn store_schema_info(
    project_id: String,
    schema_info: Value,
    ai_manager: tauri::State<'_, AIEngineManagerState>
) -> Result<Value, String> {
    log::info!("Storing schema info for project: {}", project_id);

    let manager_guard = ai_manager.read().await;

    if let Some(manager) = manager_guard.as_ref() {
        let params = serde_json::json!({
            "project_id": project_id,
            "schema_info": schema_info
        });

        match manager.send_request("memory.store_schema".to_string(), Some(params)).await {
            Ok(response) => Ok(response),
            Err(e) => {
                log::error!("Failed to store schema info: {}", e);
                Err(format!("Failed to store schema info: {}", e))
            }
        }
    } else {
        Err("AI Engine is not running".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize AI Engine Manager state
            let ai_manager: AIEngineManagerState = Arc::new(RwLock::new(None));
            app.manage(ai_manager);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            start_ai_engine,
            stop_ai_engine,
            get_ai_engine_status,
            send_ai_request,
            subscribe_thought_process,
            unsubscribe_thought_process,
            get_thought_process_history,
            // Memory system commands
            get_memory_context,
            get_memory_statistics,
            get_query_history,
            get_schema_suggestions,
            create_memory_project,
            store_schema_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
