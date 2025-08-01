// Template Engine Types - Story 3.7
// Comprehensive type definitions for template management system

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

// Core Template Structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub category_id: String,
    pub content: String,
    pub parameters: Vec<TemplateParameter>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub usage_count: u32,
    pub is_favorite: bool,
}

// Template Parameter for dynamic templates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateParameter {
    pub id: String,
    pub template_id: String,
    pub name: String, // e.g., "start_date" for {{start_date}}
    pub default_value: Option<String>,
    pub description: Option<String>,
}

// Template Category for organization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateCategory {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub template_count: u32, // Computed field for UI display
}

// Request types for template operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub category_id: String,
    pub content: String,
    pub parameters: Vec<CreateParameterRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateParameterRequest {
    pub name: String,
    pub default_value: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTemplateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category_id: Option<String>,
    pub content: Option<String>,
    pub parameters: Option<Vec<CreateParameterRequest>>,
    pub is_favorite: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCategoryRequest {
    pub name: Option<String>,
    pub parent_id: Option<String>,
}

// Filter and search types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateFilter {
    pub search_query: Option<String>,
    pub category_id: Option<String>,
    pub is_favorite: Option<bool>,
    pub sort_by: Option<TemplateSortBy>,
    pub sort_order: Option<SortOrder>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TemplateSortBy {
    Name,
    CreatedAt,
    UpdatedAt,
    UsageCount,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortOrder {
    Asc,
    Desc,
}

// Template usage tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateUsage {
    pub template_id: String,
    pub used_at: DateTime<Utc>,
    pub connection_id: Option<String>,
    pub execution_success: Option<bool>,
}

// Import/Export types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateExport {
    pub templates: Vec<Template>,
    pub categories: Vec<TemplateCategory>,
    pub export_version: String,
    pub exported_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateImportResult {
    pub imported_templates: u32,
    pub imported_categories: u32,
    pub skipped_duplicates: u32,
    pub errors: Vec<String>,
}

// Parameter substitution types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterSubstitution {
    pub parameter_name: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessedTemplate {
    pub original_content: String,
    pub processed_content: String,
    pub substitutions: Vec<ParameterSubstitution>,
    pub missing_parameters: Vec<String>,
}

// Statistics and analytics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateStatistics {
    pub total_templates: u32,
    pub total_categories: u32,
    pub most_used_templates: Vec<Template>,
    pub recent_templates: Vec<Template>,
    pub favorite_templates: Vec<Template>,
    pub category_usage: Vec<CategoryUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryUsage {
    pub category: TemplateCategory,
    pub template_count: u32,
    pub total_usage: u32,
}

// Error types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TemplateError {
    NotFound(String),
    DuplicateName(String),
    InvalidCategory(String),
    DatabaseError(String),
    ValidationError(String),
    ImportError(String),
    ExportError(String),
}

impl std::fmt::Display for TemplateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TemplateError::NotFound(id) => write!(f, "Template not found: {}", id),
            TemplateError::DuplicateName(name) => write!(f, "Template name already exists: {}", name),
            TemplateError::InvalidCategory(id) => write!(f, "Invalid category: {}", id),
            TemplateError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            TemplateError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            TemplateError::ImportError(msg) => write!(f, "Import error: {}", msg),
            TemplateError::ExportError(msg) => write!(f, "Export error: {}", msg),
        }
    }
}

impl std::error::Error for TemplateError {}

// Default implementations
impl Default for TemplateFilter {
    fn default() -> Self {
        Self {
            search_query: None,
            category_id: None,
            is_favorite: None,
            sort_by: Some(TemplateSortBy::UpdatedAt),
            sort_order: Some(SortOrder::Desc),
            limit: None,
            offset: None,
        }
    }
}

impl Default for TemplateSortBy {
    fn default() -> Self {
        TemplateSortBy::UpdatedAt
    }
}

impl Default for SortOrder {
    fn default() -> Self {
        SortOrder::Desc
    }
}
