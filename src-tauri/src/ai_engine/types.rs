// In src-tauri/src/ai_engine/types.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AIEngineStatus {
    Stopped,
    Starting,
    Ready,
    Processing,
    Error(String),
    HealthCheckFailed,
    ProcessCrashed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIEngineConfig {
    pub python_executable: String,
    pub ai_core_script: String,
    pub health_check_interval: u64, // in milliseconds
    pub restart_attempts: u32,
}

impl Default for AIEngineConfig {
    fn default() -> Self {
        AIEngineConfig {
            python_executable: "python".to_string(), // Assumes python is in PATH
            ai_core_script: "ai_core/main.py".to_string(),
            health_check_interval: 5000, // 5 seconds
            restart_attempts: 3,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct HealthStats {
    pub is_healthy: bool,
    pub last_result: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcMessage {
    pub jsonrpc: String,
    pub method: String,
    pub params: HashMap<String, serde_json::Value>,
    pub id: Option<u64>,
}

// SQL Generation Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SQLGenerationRequest {
    pub prompt: String,
    pub connection_id: String,
    pub schema_context: Option<serde_json::Value>,
    pub generation_options: Option<SQLGenerationOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SQLGenerationOptions {
    pub timeout_seconds: Option<u32>,
    pub include_explanation: Option<bool>,
    pub validate_syntax: Option<bool>,
    pub optimize_performance: Option<bool>,
    pub confidence_threshold: Option<f32>,
}

impl Default for SQLGenerationOptions {
    fn default() -> Self {
        Self {
            timeout_seconds: Some(15),
            include_explanation: Some(true),
            validate_syntax: Some(true),
            optimize_performance: Some(false),
            confidence_threshold: Some(0.7),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SQLGenerationResponse {
    pub success: bool,
    pub generated_sql: Option<String>,
    pub explanation: Option<String>,
    pub confidence_level: Option<String>, // "High", "Medium", "Low"
    pub confidence_score: Option<f32>,
    pub warnings: Option<Vec<String>>,
    pub clarifying_questions: Option<Vec<String>>,
    pub error_message: Option<String>,
    pub generation_time_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SQLGenerationProgress {
    pub stage: String, // "analyzing", "generating", "validating", etc.
    pub progress_percent: Option<u8>,
    pub message: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CancellationRequest {
    pub generation_id: String,
    pub reason: Option<String>,
}

// AI Analysis Types for Story 3.6
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AITaskType {
    Explain,
    Optimize,
    Validate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIAnalysisRequest {
    pub sql: String,
    pub task_type: AITaskType,
    pub connection_id: String,
    pub schema_context: Option<serde_json::Value>,
    pub analysis_options: Option<AIAnalysisOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIAnalysisOptions {
    pub timeout_seconds: Option<u32>,
    pub include_confidence: Option<bool>,
    pub detailed_explanation: Option<bool>,
    pub performance_estimates: Option<bool>,
    pub severity_filtering: Option<Vec<String>>, // For validation: "error", "warning", "info"
}

impl Default for AIAnalysisOptions {
    fn default() -> Self {
        Self {
            timeout_seconds: Some(30),
            include_confidence: Some(true),
            detailed_explanation: Some(true),
            performance_estimates: Some(true),
            severity_filtering: Some(vec!["error".to_string(), "warning".to_string(), "info".to_string()]),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIAnalysisResult {
    pub analysis_id: String,
    pub task_type: AITaskType,
    pub success: bool,
    pub result: Option<AnalysisResultData>,
    pub confidence_score: Option<f32>,
    pub execution_time_ms: Option<u64>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AnalysisResultData {
    Explanation {
        summary: String,
        detailed_steps: Vec<ExplanationStep>,
        data_sources: Vec<String>,
        operations: Vec<String>,
        expected_result_description: String,
    },
    Optimization {
        original_query: String,
        optimized_query: Option<String>,
        optimizations: Vec<OptimizationSuggestion>,
        performance_impact: Option<PerformanceEstimate>,
    },
    Validation {
        is_valid: bool,
        issues: Vec<ValidationIssue>,
        quick_fixes: Vec<QuickFix>,
        overall_score: Option<f32>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExplanationStep {
    pub step_number: u32,
    pub operation: String,
    pub description: String,
    pub tables_involved: Vec<String>,
    pub columns_involved: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationSuggestion {
    pub suggestion_id: String,
    pub category: String, // "index", "query_structure", "join_order", etc.
    pub description: String,
    pub impact_level: String, // "High", "Medium", "Low"
    pub before_snippet: Option<String>,
    pub after_snippet: Option<String>,
    pub reasoning: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceEstimate {
    pub estimated_improvement_percent: Option<f32>,
    pub execution_time_before: Option<String>,
    pub execution_time_after: Option<String>,
    pub resource_usage_impact: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationIssue {
    pub issue_id: String,
    pub severity: String, // "error", "warning", "info"
    pub category: String, // "syntax", "semantic", "performance", "best_practice"
    pub message: String,
    pub line_number: Option<u32>,
    pub column_number: Option<u32>,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickFix {
    pub fix_id: String,
    pub description: String,
    pub original_text: String,
    pub replacement_text: String,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIAnalysisProgress {
    pub analysis_id: String,
    pub task_type: AITaskType,
    pub stage: String, // "analyzing", "processing", "formatting", etc.
    pub progress_percent: Option<u8>,
    pub message: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct AITaskInfo {
    pub task_id: String,
    pub task_type: AITaskType,
    pub status: AITaskStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AITaskStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Cancelled,
}
