// AI Engine module
mod ai_engine;

// Database connection module
mod database;

// Template engine module
mod template_engine;

use ai_engine::{
    AIEngineManager, AIEngineConfig, AIEngineStatus, SQLGenerationRequest,
    SQLGenerationResponse, SQLGenerationProgress, CancellationRequest,
    task_manager::AITaskManager,
    types::{AIAnalysisRequest, AIAnalysisResult}
};
use database::{ConnectionManager, ConnectionConfig, DatabaseCredentials, DatabaseType};
use template_engine::{
    TemplateManager, Template, TemplateCategory, CreateTemplateRequest, UpdateTemplateRequest,
    CreateCategoryRequest, UpdateCategoryRequest, TemplateFilter, TemplateStatistics,
    TemplateImportResult, ProcessedTemplate, ParameterSubstitution
};
use std::sync::Arc;
use std::collections::HashMap;
use tauri::Manager;
use tokio::sync::{RwLock, mpsc};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// Global AI Engine Manager
type AIEngineManagerState = Arc<RwLock<Option<AIEngineManager>>>;

// Global AI Task Manager for Story 3.6
type AITaskManagerState = Arc<AITaskManager>;

// Global Template Manager for Story 3.7
type TemplateManagerState = Arc<TemplateManager>;

// Global Database Connection Manager
type DatabaseManagerState = Arc<RwLock<Option<ConnectionManager>>>;

// Schema Cache Entry
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SchemaCacheEntry {
    schema_data: serde_json::Value,
    cached_at: DateTime<Utc>,
    ttl_seconds: u64,
}

impl SchemaCacheEntry {
    fn new(schema_data: serde_json::Value, ttl_seconds: u64) -> Self {
        Self {
            schema_data,
            cached_at: Utc::now(),
            ttl_seconds,
        }
    }

    fn is_expired(&self) -> bool {
        let elapsed = Utc::now().signed_duration_since(self.cached_at);
        elapsed.num_seconds() as u64 > self.ttl_seconds
    }
}

// Global Schema Cache
type SchemaCacheState = Arc<RwLock<HashMap<String, SchemaCacheEntry>>>;

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
        let manager = AIEngineManager::new(config);

        manager.start().await;
        *manager_guard = Some(manager);
        Ok("AI Engine started successfully".to_string())
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

    if let Some(manager) = manager_guard.take() {
        manager.stop().await;
        Ok("AI Engine stopped successfully".to_string())
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

// SQL Generation Commands
#[tauri::command]
async fn generate_sql_from_prompt(
    request: SQLGenerationRequest,
    ai_manager: tauri::State<'_, AIEngineManagerState>,
    app_handle: tauri::AppHandle,
) -> Result<SQLGenerationResponse, String> {
    log::info!("Generating SQL from prompt: {}", request.prompt);

    let manager_guard = ai_manager.read().await;
    if let Some(manager) = manager_guard.as_ref() {
        // Create a progress channel for real-time updates
        let (progress_tx, mut progress_rx) = mpsc::channel::<SQLGenerationProgress>(32);
        let app_handle_clone = app_handle.clone();

        // Spawn a task to emit progress events to the frontend
        tokio::spawn(async move {
            while let Some(progress) = progress_rx.recv().await {
                let _ = app_handle_clone.emit_all("sql-generation-progress", &progress);
            }
        });

        // Generate SQL with progress tracking
        manager.generate_sql_from_prompt(request, Some(progress_tx)).await
    } else {
        Err("AI Engine is not initialized".to_string())
    }
}

#[tauri::command]
async fn cancel_sql_generation(
    generation_id: String,
    ai_manager: tauri::State<'_, AIEngineManagerState>,
) -> Result<String, String> {
    log::info!("Cancelling SQL generation: {}", generation_id);

    let manager_guard = ai_manager.read().await;
    if let Some(manager) = manager_guard.as_ref() {
        match manager.cancel_sql_generation(generation_id).await {
            Ok(_) => Ok("Generation cancelled successfully".to_string()),
            Err(e) => Err(e),
        }
    } else {
        Err("AI Engine is not initialized".to_string())
    }
}

// Story 3.6: Unified AI Analysis Command
#[tauri::command]
async fn analyze_sql_query(
    request: AIAnalysisRequest,
    app_handle: tauri::AppHandle,
    task_manager: tauri::State<'_, AITaskManagerState>,
) -> Result<AIAnalysisResult, String> {
    log::info!("Starting SQL analysis: {:?} for connection: {}", request.task_type, request.connection_id);

    // Execute analysis using the unified task manager
    match task_manager.execute_analysis(request, app_handle).await {
        Ok(result) => {
            log::info!("Analysis completed successfully: {}", result.analysis_id);
            Ok(result)
        }
        Err(e) => {
            log::error!("Analysis failed: {}", e);
            Err(e)
        }
    }
}

#[tauri::command]
async fn cancel_sql_analysis(
    analysis_id: String,
    task_manager: tauri::State<'_, AITaskManagerState>,
) -> Result<String, String> {
    log::info!("Cancelling SQL analysis: {}", analysis_id);

    match task_manager.cancel_analysis(&analysis_id) {
        Ok(_) => Ok("Analysis cancelled successfully".to_string()),
        Err(e) => Err(e),
    }
}

// NOTE: send_request method not implemented in architect's version
// #[tauri::command]
// async fn send_ai_request(
//     ai_manager: tauri::State<'_, AIEngineManagerState>,
//     method: String,
//     params: Option<serde_json::Value>,
// ) -> Result<serde_json::Value, String> {
//     let manager_guard = ai_manager.read().await;
//
//     if let Some(manager) = manager_guard.as_ref() {
//         match manager.send_request(method, params).await {
//             Ok(result) => Ok(result),
//             Err(e) => {
//                 log::error!("AI request failed: {}", e);
//                 Err(format!("AI request failed: {}", e))
//             }
//         }
//     } else {
//         Err("AI Engine is not running".to_string())
//     }
// }

// NOTE: Thought Process Commands not implemented in architect's version
// #[tauri::command]
// async fn subscribe_thought_process(
//     ai_manager: tauri::State<'_, AIEngineManagerState>,
//     query_id: Option<String>,
// ) -> Result<String, String> {
//     // Implementation commented out - requires send_request method
//     Err("Not implemented in current version".to_string())
// }

// NOTE: These methods not implemented in architect's version
// #[tauri::command]
// async fn unsubscribe_thought_process(
//     ai_manager: tauri::State<'_, AIEngineManagerState>,
//     subscriber_id: String,
// ) -> Result<String, String> {
//     Err("Not implemented in current version".to_string())
// }

// #[tauri::command]
// async fn get_thought_process_history(
//     ai_manager: tauri::State<'_, AIEngineManagerState>,
//     limit: Option<u32>,
// ) -> Result<Value, String> {
//     Err("Not implemented in current version".to_string())
// }

// NOTE: Memory system commands not implemented in architect's version
// #[tauri::command]
// async fn get_memory_context(
//     query: String,
//     project_id: String,
//     ai_manager: tauri::State<'_, AIEngineManagerState>
// ) -> Result<Value, String> {
//     Err("Not implemented in current version".to_string())
// }

// #[tauri::command]
// async fn get_memory_statistics(
//     project_id: Option<String>,
//     ai_manager: tauri::State<'_, AIEngineManagerState>
// ) -> Result<Value, String> {
//     Err("Not implemented in current version".to_string())
// }

// NOTE: Additional methods not implemented in architect's version
// #[tauri::command]
// async fn get_query_history(
//     project_id: String,
//     limit: Option<u32>,
//     ai_manager: tauri::State<'_, AIEngineManagerState>
// ) -> Result<Value, String> {
//     Err("Not implemented in current version".to_string())
// }

// #[tauri::command]
// async fn get_schema_suggestions(
//     project_id: String,
//     partial_query: String,
//     ai_manager: tauri::State<'_, AIEngineManagerState>
// ) -> Result<Value, String> {
//     Err("Not implemented in current version".to_string())
// }

// NOTE: Additional methods not implemented in architect's version
// #[tauri::command]
// async fn create_memory_project(
//     project_id: String,
//     name: String,
//     metadata: Option<Value>,
//     ai_manager: tauri::State<'_, AIEngineManagerState>
// ) -> Result<Value, String> {
//     Err("Not implemented in current version".to_string())
// }

// #[tauri::command]
// async fn store_schema_info(
//     project_id: String,
//     schema_info: Value,
//     ai_manager: tauri::State<'_, AIEngineManagerState>
// ) -> Result<Value, String> {
//     Err("Not implemented in current version".to_string())
// }

// Database Connection Management Commands

#[tauri::command]
async fn init_database_manager(
    db_manager: tauri::State<'_, DatabaseManagerState>
) -> Result<String, String> {
    let mut manager_guard = db_manager.write().await;

    if manager_guard.is_some() {
        return Ok("Database manager already initialized".to_string());
    }

    match ConnectionManager::new().await {
        Ok(manager) => {
            *manager_guard = Some(manager);
            Ok("Database manager initialized successfully".to_string())
        }
        Err(e) => Err(format!("Failed to initialize database manager: {}", e))
    }
}

#[tauri::command]
async fn add_database_connection(
    name: String,
    database_type: String,
    host: String,
    port: u16,
    database: String,
    username: String,
    password: String,
    ssl_enabled: bool,
    db_manager: tauri::State<'_, DatabaseManagerState>
) -> Result<String, String> {
    let manager_guard = db_manager.read().await;
    let manager = manager_guard.as_ref()
        .ok_or_else(|| "Database manager not initialized".to_string())?;

    // Parse database type
    let db_type = match database_type.as_str() {
        "PostgreSQL" => DatabaseType::PostgreSQL,
        "MySQL" => DatabaseType::MySQL,
        "SQLite" => DatabaseType::SQLite,
        "SqlServer" => DatabaseType::SqlServer,
        "Oracle" => DatabaseType::Oracle,
        _ => return Err(format!("Unsupported database type: {}", database_type))
    };

    // Create connection configuration
    let mut config = ConnectionConfig::new(name, db_type, host, port, database, username);
    config.ssl_enabled = ssl_enabled;

    // Create credentials
    let credentials = DatabaseCredentials::new(config.id, password);

    // Add connection
    match manager.add_connection(config.clone(), credentials).await {
        Ok(_) => Ok(config.id.to_string()),
        Err(e) => Err(format!("Failed to add connection: {}", e))
    }
}

#[tauri::command]
async fn test_database_connection(
    connection_id: String,
    db_manager: tauri::State<'_, DatabaseManagerState>
) -> Result<serde_json::Value, String> {
    let manager_guard = db_manager.read().await;
    let manager = manager_guard.as_ref()
        .ok_or_else(|| "Database manager not initialized".to_string())?;

    let uuid = Uuid::parse_str(&connection_id)
        .map_err(|e| format!("Invalid connection ID: {}", e))?;

    match manager.test_connection(uuid).await {
        Ok(result) => Ok(serde_json::to_value(result).unwrap()),
        Err(e) => Err(format!("Connection test failed: {}", e))
    }
}

#[tauri::command]
async fn list_database_connections(
    db_manager: tauri::State<'_, DatabaseManagerState>
) -> Result<serde_json::Value, String> {
    let manager_guard = db_manager.read().await;
    let manager = manager_guard.as_ref()
        .ok_or_else(|| "Database manager not initialized".to_string())?;

    let connections = manager.list_connections().await;
    Ok(serde_json::to_value(connections).unwrap())
}

#[tauri::command]
async fn remove_database_connection(
    connection_id: String,
    db_manager: tauri::State<'_, DatabaseManagerState>
) -> Result<String, String> {
    let manager_guard = db_manager.read().await;
    let manager = manager_guard.as_ref()
        .ok_or_else(|| "Database manager not initialized".to_string())?;

    let uuid = Uuid::parse_str(&connection_id)
        .map_err(|e| format!("Invalid connection ID: {}", e))?;

    match manager.remove_connection(uuid).await {
        Ok(_) => Ok("Connection removed successfully".to_string()),
        Err(e) => Err(format!("Failed to remove connection: {}", e))
    }
}

#[tauri::command]
async fn get_database_connection_summary(
    connection_id: String,
    db_manager: tauri::State<'_, DatabaseManagerState>
) -> Result<serde_json::Value, String> {
    let manager_guard = db_manager.read().await;
    let manager = manager_guard.as_ref()
        .ok_or_else(|| "Database manager not initialized".to_string())?;

    let uuid = Uuid::parse_str(&connection_id)
        .map_err(|e| format!("Invalid connection ID: {}", e))?;

    match manager.get_connection_summary(uuid).await {
        Ok(summary) => Ok(serde_json::to_value(summary).unwrap()),
        Err(e) => Err(format!("Failed to get connection summary: {}", e))
    }
}

#[tauri::command]
async fn get_supported_database_types(
    db_manager: tauri::State<'_, DatabaseManagerState>
) -> Result<Vec<String>, String> {
    let manager_guard = db_manager.read().await;
    let manager = manager_guard.as_ref()
        .ok_or_else(|| "Database manager not initialized".to_string())?;

    let types = manager.get_supported_database_types();
    Ok(types.iter().map(|t| t.to_string()).collect())
}

// Removed duplicate get_database_schema function - using enhanced version below

#[tauri::command]
async fn validate_sql_syntax(
    sql: String,
    dialect: String,
    connection_id: Option<String>,
    db_manager: tauri::State<'_, DatabaseManagerState>
) -> Result<serde_json::Value, String> {
    // Basic SQL syntax validation
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let mut suggestions = Vec::new();

    // Simple validation rules
    if sql.trim().is_empty() {
        return Ok(serde_json::json!({
            "is_valid": true,
            "errors": [],
            "warnings": [],
            "suggestions": []
        }));
    }

    // Check for basic SQL structure
    let sql_upper = sql.to_uppercase();

    // Check for SELECT without FROM (basic validation)
    if sql_upper.contains("SELECT") && !sql_upper.contains("FROM") && !sql_upper.contains("DUAL") {
        warnings.push(serde_json::json!({
            "line": 1,
            "column": 1,
            "length": 6,
            "message": "SELECT statement without FROM clause",
            "severity": "warning"
        }));
    }

    // Check for unmatched parentheses
    let open_parens = sql.matches('(').count();
    let close_parens = sql.matches(')').count();
    if open_parens != close_parens {
        errors.push(serde_json::json!({
            "line": 1,
            "column": 1,
            "length": sql.len(),
            "message": "Unmatched parentheses",
            "severity": "error"
        }));
    }

    // Add suggestions based on dialect
    match dialect.as_str() {
        "postgresql" => {
            suggestions.push("Consider using PostgreSQL-specific features like JSONB or arrays".to_string());
        },
        "mysql" => {
            suggestions.push("Consider using MySQL-specific functions like GROUP_CONCAT".to_string());
        },
        "sqlite" => {
            suggestions.push("Remember that SQLite has dynamic typing".to_string());
        },
        _ => {}
    }

    let is_valid = errors.is_empty();

    Ok(serde_json::json!({
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "suggestions": suggestions
    }))
}

#[tauri::command]
async fn execute_sql_query(
    connection_id: String,
    query: String,
    query_id: String,
    db_manager: tauri::State<'_, DatabaseManagerState>
) -> Result<serde_json::Value, String> {
    // Input validation
    if query.trim().is_empty() {
        return Err("Query cannot be empty".to_string());
    }

    if connection_id.trim().is_empty() {
        return Err("Connection ID cannot be empty".to_string());
    }

    let manager_guard = db_manager.read().await;
    let manager = manager_guard.as_ref()
        .ok_or_else(|| "Database manager not initialized".to_string())?;

    let uuid = Uuid::parse_str(&connection_id)
        .map_err(|e| format!("Invalid connection ID format: {}", e))?;

    let start_time = std::time::Instant::now();

    // Basic SQL injection prevention (for demo purposes)
    let query_upper = query.to_uppercase();
    let dangerous_patterns = ["DROP TABLE", "DELETE FROM", "TRUNCATE TABLE", "ALTER TABLE"];
    for pattern in dangerous_patterns.iter() {
        if query_upper.contains(pattern) {
            return Ok(serde_json::json!({
                "query_id": query_id,
                "success": false,
                "error": format!("Potentially dangerous operation detected: {}", pattern),
                "execution_time": start_time.elapsed().as_millis() as u64
            }));
        }
    }

    // Simulate different query types and results
    let execution_time = start_time.elapsed().as_millis() as u64;

    // Generate mock data based on query content for more realistic testing
    let (mock_columns, mock_rows) = if query_upper.contains("LARGE") || query_upper.contains("STRESS") {
        // Generate large dataset for performance testing
        let row_count = if query_upper.contains("100000") { 100000 }
                       else if query_upper.contains("50000") { 50000 }
                       else { 10000 };

        let columns = vec![
            serde_json::json!({"name": "id", "type": "INTEGER", "nullable": false}),
            serde_json::json!({"name": "name", "type": "VARCHAR", "nullable": true}),
            serde_json::json!({"name": "email", "type": "VARCHAR", "nullable": true}),
            serde_json::json!({"name": "created_at", "type": "TIMESTAMP", "nullable": false}),
            serde_json::json!({"name": "status", "type": "VARCHAR", "nullable": false}),
        ];

        let rows: Vec<Vec<serde_json::Value>> = (1..=row_count).map(|i| {
            vec![
                serde_json::json!(i),
                serde_json::json!(format!("User {}", i)),
                serde_json::json!(format!("user{}@example.com", i)),
                serde_json::json!("2025-07-31T10:00:00Z"),
                serde_json::json!(if i % 2 == 0 { "Active" } else { "Inactive" }),
            ]
        }).collect();

        (columns, rows)
    } else {
        // Standard small dataset
        let columns = vec![
            serde_json::json!({"name": "id", "type": "INTEGER", "nullable": false}),
            serde_json::json!({"name": "name", "type": "VARCHAR", "nullable": true}),
            serde_json::json!({"name": "created_at", "type": "TIMESTAMP", "nullable": false})
        ];

        let rows = vec![
            vec![
                serde_json::json!(1),
                serde_json::json!("Sample Data"),
                serde_json::json!("2025-07-31T10:00:00Z")
            ],
            vec![
                serde_json::json!(2),
                serde_json::json!("Test Record"),
                serde_json::json!("2025-07-31T10:01:00Z")
            ],
            vec![
                serde_json::json!(3),
                serde_json::json!(null),
                serde_json::json!("2025-07-31T10:02:00Z")
            ]
        ];

        (columns, rows)
    };

    Ok(serde_json::json!({
        "query_id": query_id,
        "columns": mock_columns,
        "rows": mock_rows,
        "row_count": mock_rows.len(),
        "execution_time": execution_time,
        "affected_rows": 0,
        "success": true
    }))
}

#[tauri::command]
async fn get_database_schema(
    connection_id: String,
    include_system_objects: bool,
    db_manager: tauri::State<'_, DatabaseManagerState>,
    schema_cache: tauri::State<'_, SchemaCacheState>
) -> Result<serde_json::Value, String> {
    // Input validation
    if connection_id.trim().is_empty() {
        return Err("Connection ID cannot be empty".to_string());
    }

    let manager_guard = db_manager.read().await;
    let manager = manager_guard.as_ref()
        .ok_or_else(|| "Database manager not initialized".to_string())?;

    let uuid = Uuid::parse_str(&connection_id)
        .map_err(|e| format!("Invalid connection ID format: {}", e))?;

    // Create cache key
    let cache_key = format!("{}_{}", connection_id, include_system_objects);

    // Check cache first
    {
        let cache_guard = schema_cache.read().await;
        if let Some(cached_entry) = cache_guard.get(&cache_key) {
            if !cached_entry.is_expired() {
                // Return cached data with updated timestamp
                let mut cached_result = cached_entry.schema_data.clone();
                if let Some(obj) = cached_result.as_object_mut() {
                    obj.insert("cached".to_string(), serde_json::Value::Bool(true));
                    obj.insert("cache_age_seconds".to_string(),
                        serde_json::Value::Number(
                            serde_json::Number::from(
                                Utc::now().signed_duration_since(cached_entry.cached_at).num_seconds()
                            )
                        )
                    );
                }
                return Ok(cached_result);
            }
        }
    }

    let start_time = std::time::Instant::now();

    // For now, return mock schema data
    // This will be replaced with actual database introspection once drivers are complete
    let execution_time = start_time.elapsed().as_millis() as u64;

    // Generate mock schema based on connection type
    let mock_databases = vec![
        serde_json::json!({
            "name": "northwind",
            "schemas": [
                {
                    "name": "public",
                    "tables": [
                        {
                            "name": "customers",
                            "type": "table",
                            "row_count": 91,
                            "columns": [
                                {
                                    "name": "customer_id",
                                    "data_type": "VARCHAR",
                                    "nullable": false,
                                    "is_primary_key": true,
                                    "is_foreign_key": false,
                                    "max_length": 5
                                },
                                {
                                    "name": "company_name",
                                    "data_type": "VARCHAR",
                                    "nullable": false,
                                    "is_primary_key": false,
                                    "is_foreign_key": false,
                                    "max_length": 40
                                },
                                {
                                    "name": "contact_name",
                                    "data_type": "VARCHAR",
                                    "nullable": true,
                                    "is_primary_key": false,
                                    "is_foreign_key": false,
                                    "max_length": 30
                                },
                                {
                                    "name": "country",
                                    "data_type": "VARCHAR",
                                    "nullable": true,
                                    "is_primary_key": false,
                                    "is_foreign_key": false,
                                    "max_length": 15
                                }
                            ],
                            "indexes": [
                                {
                                    "name": "pk_customers",
                                    "is_primary": true,
                                    "is_unique": true,
                                    "columns": ["customer_id"]
                                }
                            ]
                        },
                        {
                            "name": "orders",
                            "type": "table",
                            "row_count": 830,
                            "columns": [
                                {
                                    "name": "order_id",
                                    "data_type": "INTEGER",
                                    "nullable": false,
                                    "is_primary_key": true,
                                    "is_foreign_key": false
                                },
                                {
                                    "name": "customer_id",
                                    "data_type": "VARCHAR",
                                    "nullable": true,
                                    "is_primary_key": false,
                                    "is_foreign_key": true,
                                    "max_length": 5
                                },
                                {
                                    "name": "order_date",
                                    "data_type": "DATE",
                                    "nullable": true,
                                    "is_primary_key": false,
                                    "is_foreign_key": false
                                },
                                {
                                    "name": "required_date",
                                    "data_type": "DATE",
                                    "nullable": true,
                                    "is_primary_key": false,
                                    "is_foreign_key": false
                                }
                            ],
                            "indexes": [
                                {
                                    "name": "pk_orders",
                                    "is_primary": true,
                                    "is_unique": true,
                                    "columns": ["order_id"]
                                },
                                {
                                    "name": "fk_orders_customers",
                                    "is_primary": false,
                                    "is_unique": false,
                                    "columns": ["customer_id"]
                                }
                            ]
                        },
                        {
                            "name": "products",
                            "type": "table",
                            "row_count": 77,
                            "columns": [
                                {
                                    "name": "product_id",
                                    "data_type": "INTEGER",
                                    "nullable": false,
                                    "is_primary_key": true,
                                    "is_foreign_key": false
                                },
                                {
                                    "name": "product_name",
                                    "data_type": "VARCHAR",
                                    "nullable": false,
                                    "is_primary_key": false,
                                    "is_foreign_key": false,
                                    "max_length": 40
                                },
                                {
                                    "name": "unit_price",
                                    "data_type": "DECIMAL",
                                    "nullable": true,
                                    "is_primary_key": false,
                                    "is_foreign_key": false,
                                    "precision": 10,
                                    "scale": 2
                                },
                                {
                                    "name": "discontinued",
                                    "data_type": "BOOLEAN",
                                    "nullable": false,
                                    "is_primary_key": false,
                                    "is_foreign_key": false,
                                    "default_value": "false"
                                }
                            ]
                        }
                    ],
                    "views": [
                        {
                            "name": "customer_orders_view",
                            "type": "view",
                            "columns": [
                                {
                                    "name": "customer_name",
                                    "data_type": "VARCHAR",
                                    "nullable": true
                                },
                                {
                                    "name": "order_count",
                                    "data_type": "INTEGER",
                                    "nullable": false
                                },
                                {
                                    "name": "total_amount",
                                    "data_type": "DECIMAL",
                                    "nullable": true
                                }
                            ]
                        }
                    ],
                    "procedures": [
                        {
                            "name": "get_customer_orders",
                            "type": "procedure",
                            "parameters": [
                                {
                                    "name": "customer_id",
                                    "data_type": "VARCHAR",
                                    "direction": "IN"
                                }
                            ]
                        }
                    ]
                }
            ]
        })
    ];

    Ok(serde_json::json!({
        "connection_id": connection_id,
        "databases": mock_databases,
        "last_updated": chrono::Utc::now().to_rfc3339(),
        "execution_time": execution_time,
        "success": true
    }))
}

#[tauri::command]
async fn get_table_details(
    connection_id: String,
    database_name: String,
    schema_name: String,
    table_name: String,
    db_manager: tauri::State<'_, DatabaseManagerState>
) -> Result<serde_json::Value, String> {
    // Input validation
    if connection_id.trim().is_empty() {
        return Err("Connection ID cannot be empty".to_string());
    }
    if table_name.trim().is_empty() {
        return Err("Table name cannot be empty".to_string());
    }

    let manager_guard = db_manager.read().await;
    let manager = manager_guard.as_ref()
        .ok_or_else(|| "Database manager not initialized".to_string())?;

    let uuid = Uuid::parse_str(&connection_id)
        .map_err(|e| format!("Invalid connection ID format: {}", e))?;

    let start_time = std::time::Instant::now();

    // Mock detailed table information
    let execution_time = start_time.elapsed().as_millis() as u64;

    // Generate detailed mock data based on table name
    let table_details = match table_name.as_str() {
        "customers" => serde_json::json!({
            "name": "customers",
            "type": "table",
            "database": database_name,
            "schema": schema_name,
            "row_count": 91,
            "size_bytes": 8192,
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-07-31T10:00:00Z",
            "columns": [
                {
                    "name": "customer_id",
                    "data_type": "VARCHAR",
                    "nullable": false,
                    "is_primary_key": true,
                    "is_foreign_key": false,
                    "max_length": 5,
                    "ordinal_position": 1,
                    "default_value": null,
                    "comment": "Unique customer identifier"
                },
                {
                    "name": "company_name",
                    "data_type": "VARCHAR",
                    "nullable": false,
                    "is_primary_key": false,
                    "is_foreign_key": false,
                    "max_length": 40,
                    "ordinal_position": 2,
                    "default_value": null,
                    "comment": "Company name"
                },
                {
                    "name": "contact_name",
                    "data_type": "VARCHAR",
                    "nullable": true,
                    "is_primary_key": false,
                    "is_foreign_key": false,
                    "max_length": 30,
                    "ordinal_position": 3,
                    "default_value": null,
                    "comment": "Primary contact name"
                }
            ],
            "indexes": [
                {
                    "name": "pk_customers",
                    "is_primary": true,
                    "is_unique": true,
                    "columns": ["customer_id"],
                    "size_bytes": 1024
                }
            ],
            "foreign_keys": [],
            "triggers": [],
            "constraints": [
                {
                    "name": "pk_customers",
                    "type": "PRIMARY KEY",
                    "columns": ["customer_id"]
                }
            ]
        }),
        "orders" => serde_json::json!({
            "name": "orders",
            "type": "table",
            "database": database_name,
            "schema": schema_name,
            "row_count": 830,
            "size_bytes": 32768,
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-07-31T10:00:00Z",
            "columns": [
                {
                    "name": "order_id",
                    "data_type": "INTEGER",
                    "nullable": false,
                    "is_primary_key": true,
                    "is_foreign_key": false,
                    "ordinal_position": 1,
                    "default_value": null,
                    "comment": "Unique order identifier"
                },
                {
                    "name": "customer_id",
                    "data_type": "VARCHAR",
                    "nullable": true,
                    "is_primary_key": false,
                    "is_foreign_key": true,
                    "max_length": 5,
                    "ordinal_position": 2,
                    "default_value": null,
                    "comment": "Reference to customer"
                }
            ],
            "foreign_keys": [
                {
                    "name": "fk_orders_customers",
                    "columns": ["customer_id"],
                    "referenced_table": "customers",
                    "referenced_columns": ["customer_id"],
                    "on_delete": "SET NULL",
                    "on_update": "CASCADE"
                }
            ]
        }),
        _ => serde_json::json!({
            "name": table_name,
            "type": "table",
            "database": database_name,
            "schema": schema_name,
            "row_count": 0,
            "columns": [],
            "indexes": [],
            "foreign_keys": []
        })
    };

    Ok(serde_json::json!({
        "connection_id": connection_id,
        "table_details": table_details,
        "execution_time": execution_time,
        "success": true
    }))
}

#[tauri::command]
async fn search_schema_objects(
    connection_id: String,
    search_term: String,
    object_types: Vec<String>,
    db_manager: tauri::State<'_, DatabaseManagerState>
) -> Result<serde_json::Value, String> {
    // Input validation
    if connection_id.trim().is_empty() {
        return Err("Connection ID cannot be empty".to_string());
    }
    if search_term.trim().is_empty() {
        return Err("Search term cannot be empty".to_string());
    }

    let manager_guard = db_manager.read().await;
    let manager = manager_guard.as_ref()
        .ok_or_else(|| "Database manager not initialized".to_string())?;

    let uuid = Uuid::parse_str(&connection_id)
        .map_err(|e| format!("Invalid connection ID format: {}", e))?;

    let start_time = std::time::Instant::now();

    // Mock search results
    let execution_time = start_time.elapsed().as_millis() as u64;
    let search_lower = search_term.to_lowercase();

    let mut results = Vec::new();

    // Mock search through schema objects
    let all_objects = vec![
        ("customers", "table", "public", "northwind"),
        ("orders", "table", "public", "northwind"),
        ("products", "table", "public", "northwind"),
        ("customer_orders_view", "view", "public", "northwind"),
        ("get_customer_orders", "procedure", "public", "northwind"),
        ("customer_id", "column", "customers", "northwind"),
        ("company_name", "column", "customers", "northwind"),
        ("order_id", "column", "orders", "northwind"),
        ("product_name", "column", "products", "northwind"),
    ];

    for (name, obj_type, parent, database) in all_objects {
        if name.to_lowercase().contains(&search_lower) {
            if object_types.is_empty() || object_types.contains(&obj_type.to_string()) {
                results.push(serde_json::json!({
                    "name": name,
                    "type": obj_type,
                    "parent": parent,
                    "database": database,
                    "schema": "public",
                    "match_type": if name.to_lowercase().starts_with(&search_lower) { "prefix" } else { "contains" }
                }));
            }
        }
    }

    // Sort results by relevance (prefix matches first, then alphabetical)
    results.sort_by(|a, b| {
        let a_match = a["match_type"].as_str().unwrap_or("");
        let b_match = b["match_type"].as_str().unwrap_or("");
        let a_name = a["name"].as_str().unwrap_or("");
        let b_name = b["name"].as_str().unwrap_or("");

        match (a_match, b_match) {
            ("prefix", "contains") => std::cmp::Ordering::Less,
            ("contains", "prefix") => std::cmp::Ordering::Greater,
            _ => a_name.cmp(b_name)
        }
    });

    Ok(serde_json::json!({
        "connection_id": connection_id,
        "search_term": search_term,
        "results": results,
        "result_count": results.len(),
        "execution_time": execution_time,
        "success": true
    }))
}

// Template Management Commands - Story 3.7

#[tauri::command]
async fn create_template(
    request: CreateTemplateRequest,
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<Template, String> {
    template_manager.create_template(request).await
}

#[tauri::command]
async fn get_templates(
    filter: Option<TemplateFilter>,
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<Vec<Template>, String> {
    let filter = filter.unwrap_or_default();
    template_manager.get_templates(filter).await
}

#[tauri::command]
async fn get_template_by_id(
    id: String,
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<Template, String> {
    template_manager.get_template_by_id(&id).await
}

#[tauri::command]
async fn update_template(
    id: String,
    updates: UpdateTemplateRequest,
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<Template, String> {
    template_manager.update_template(id, updates).await
}

#[tauri::command]
async fn delete_template(
    id: String,
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<(), String> {
    template_manager.delete_template(id).await
}

#[tauri::command]
async fn increment_template_usage(
    id: String,
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<(), String> {
    template_manager.increment_usage_count(id).await
}

#[tauri::command]
async fn create_template_category(
    request: CreateCategoryRequest,
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<TemplateCategory, String> {
    template_manager.create_category(request).await
}

#[tauri::command]
async fn get_template_categories(
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<Vec<TemplateCategory>, String> {
    template_manager.get_categories().await
}

#[tauri::command]
async fn update_template_category(
    id: String,
    updates: UpdateCategoryRequest,
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<TemplateCategory, String> {
    template_manager.update_category(id, updates).await
}

#[tauri::command]
async fn delete_template_category(
    id: String,
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<(), String> {
    template_manager.delete_category(id).await
}

#[tauri::command]
async fn search_templates(
    query: String,
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<Vec<Template>, String> {
    template_manager.search_templates(query).await
}

#[tauri::command]
async fn get_template_statistics(
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<TemplateStatistics, String> {
    template_manager.get_template_statistics().await
}

#[tauri::command]
async fn export_templates(
    template_ids: Vec<String>,
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<String, String> {
    template_manager.export_templates(template_ids).await
}

#[tauri::command]
async fn import_templates(
    template_data: String,
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<TemplateImportResult, String> {
    template_manager.import_templates(template_data).await
}

#[tauri::command]
async fn process_template_parameters(
    template_id: String,
    substitutions: Vec<ParameterSubstitution>,
    template_manager: tauri::State<'_, TemplateManagerState>,
) -> Result<ProcessedTemplate, String> {
    template_manager.process_template_parameters(template_id, substitutions).await
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

            // Initialize AI Task Manager state (Story 3.6)
            let task_manager: AITaskManagerState = Arc::new(AITaskManager::new());
            app.manage(task_manager);

            // Initialize Database Manager state
            let db_manager: DatabaseManagerState = Arc::new(RwLock::new(None));
            app.manage(db_manager);

            // Initialize Template Manager state (Story 3.7)
            let cortex_db_path = app.path_resolver()
                .app_data_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("cortex.db");

            let template_manager = TemplateManager::new(cortex_db_path.to_str().unwrap())
                .map_err(|e| format!("Failed to initialize template manager: {}", e))?;
            let template_manager_state: TemplateManagerState = Arc::new(template_manager);
            app.manage(template_manager_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            start_ai_engine,
            stop_ai_engine,
            get_ai_engine_status,
            // SQL Generation commands
            generate_sql_from_prompt,
            cancel_sql_generation,
            // SQL Analysis commands (Story 3.6)
            analyze_sql_query,
            cancel_sql_analysis,
            // Database connection management commands
            init_database_manager,
            add_database_connection,
            test_database_connection,
            list_database_connections,
            remove_database_connection,
            get_database_connection_summary,
            get_supported_database_types,
            // SQL Editor commands
            get_database_schema,
            validate_sql_syntax,
            execute_sql_query,
            // Schema Explorer commands
            get_table_details,
            search_schema_objects,
            // Template Management commands (Story 3.7)
            create_template,
            get_templates,
            get_template_by_id,
            update_template,
            delete_template,
            increment_template_usage,
            create_template_category,
            get_template_categories,
            update_template_category,
            delete_template_category,
            search_templates,
            get_template_statistics,
            export_templates,
            import_templates,
            process_template_parameters
            // NOTE: Other commands commented out - not implemented in architect's version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
