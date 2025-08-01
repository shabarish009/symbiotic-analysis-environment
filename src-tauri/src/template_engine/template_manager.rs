// Template Manager - Story 3.7
// Dedicated manager for all SQLite database interactions for templates
// Zeus Directive: Clean separation from AI and connection management systems

use std::sync::{Arc, Mutex};
use rusqlite::{Connection, params, Row};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use log::{info, warn, error};

use crate::template_engine::types::*;

pub struct TemplateManager {
    db_connection: Arc<Mutex<Connection>>,
}

impl TemplateManager {
    pub fn new(db_path: &str) -> Result<Self, String> {
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open template database: {}", e))?;
        
        let manager = Self {
            db_connection: Arc::new(Mutex::new(conn)),
        };
        
        // Initialize database schema
        manager.initialize_schema()?;
        
        info!("TemplateManager initialized successfully");
        Ok(manager)
    }

    fn initialize_schema(&self) -> Result<(), String> {
        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        // Create template categories table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS template_categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                parent_id TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES template_categories(id) ON DELETE SET NULL
            )",
            [],
        ).map_err(|e| format!("Failed to create template_categories table: {}", e))?;

        // Create templates table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                category_id TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                usage_count INTEGER NOT NULL DEFAULT 0,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (category_id) REFERENCES template_categories(id) ON DELETE CASCADE,
                UNIQUE(name, category_id)
            )",
            [],
        ).map_err(|e| format!("Failed to create templates table: {}", e))?;

        // Create template parameters table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS template_parameters (
                id TEXT PRIMARY KEY,
                template_id TEXT NOT NULL,
                name TEXT NOT NULL,
                default_value TEXT,
                description TEXT,
                FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
            )",
            [],
        ).map_err(|e| format!("Failed to create template_parameters table: {}", e))?;

        // Create indexes for performance
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_templates_category_id ON templates(category_id)",
            [],
        ).map_err(|e| format!("Failed to create category index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_templates_usage_count ON templates(usage_count DESC)",
            [],
        ).map_err(|e| format!("Failed to create usage count index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_templates_updated_at ON templates(updated_at DESC)",
            [],
        ).map_err(|e| format!("Failed to create updated_at index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_template_parameters_template_id ON template_parameters(template_id)",
            [],
        ).map_err(|e| format!("Failed to create parameters index: {}", e))?;

        // Additional performance indexes for large libraries
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_templates_is_favorite ON templates(is_favorite)",
            [],
        ).map_err(|e| format!("Failed to create favorite index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name COLLATE NOCASE)",
            [],
        ).map_err(|e| format!("Failed to create name index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_template_categories_parent_id ON template_categories(parent_id)",
            [],
        ).map_err(|e| format!("Failed to create categories parent_id index: {}", e))?;

        // Create trigger for automatic updated_at timestamp
        conn.execute(
            "CREATE TRIGGER IF NOT EXISTS update_templates_updated_at
            AFTER UPDATE ON templates
            FOR EACH ROW
            BEGIN
                UPDATE templates SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
            END",
            [],
        ).map_err(|e| format!("Failed to create update trigger: {}", e))?;

        // Create default "General" category if it doesn't exist
        self.ensure_default_category(&conn)?;

        info!("Template database schema initialized successfully");
        Ok(())
    }

    fn ensure_default_category(&self, conn: &Connection) -> Result<(), String> {
        let default_category_id = "default-general";
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM template_categories WHERE id = ?1",
            params![default_category_id],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to check default category: {}", e))?;

        if count == 0 {
            conn.execute(
                "INSERT INTO template_categories (id, name, parent_id, created_at) 
                 VALUES (?1, ?2, NULL, ?3)",
                params![
                    default_category_id,
                    "General",
                    Utc::now().to_rfc3339()
                ],
            ).map_err(|e| format!("Failed to create default category: {}", e))?;
            
            info!("Created default 'General' category");
        }

        Ok(())
    }

    // Template CRUD Operations
    pub async fn create_template(&self, request: CreateTemplateRequest) -> Result<Template, String> {
        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        // Validate category exists
        self.validate_category_exists(&conn, &request.category_id)?;

        // Check for duplicate name in category
        let duplicate_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM templates WHERE name = ?1 AND category_id = ?2",
            params![request.name, request.category_id],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to check duplicate template name: {}", e))?;

        if duplicate_count > 0 {
            return Err(format!("Template name '{}' already exists in this category", request.name));
        }

        let template_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        // Begin transaction
        let tx = conn.unchecked_transaction()
            .map_err(|e| format!("Failed to begin transaction: {}", e))?;

        // Insert template
        tx.execute(
            "INSERT INTO templates (id, name, description, category_id, content, created_at, updated_at, usage_count, is_favorite)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 0)",
            params![
                template_id,
                request.name,
                request.description,
                request.category_id,
                request.content,
                now,
                now
            ],
        ).map_err(|e| format!("Failed to insert template: {}", e))?;

        // Insert parameters
        for param in &request.parameters {
            let param_id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO template_parameters (id, template_id, name, default_value, description)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    param_id,
                    template_id,
                    param.name,
                    param.default_value,
                    param.description
                ],
            ).map_err(|e| format!("Failed to insert template parameter: {}", e))?;
        }

        tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

        info!("Created template: {} ({})", request.name, template_id);

        // Return the created template
        self.get_template_by_id(&template_id).await
    }

    pub async fn get_templates(&self, filter: TemplateFilter) -> Result<Vec<Template>, String> {
        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let mut query = String::from(
            "SELECT id, name, description, category_id, content, created_at, updated_at, usage_count, is_favorite
             FROM templates WHERE 1=1"
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        // Apply filters
        if let Some(search) = &filter.search_query {
            query.push_str(" AND (name LIKE ?1 OR description LIKE ?1 OR content LIKE ?1)");
            params.push(Box::new(format!("%{}%", search)));
        }

        if let Some(category_id) = &filter.category_id {
            query.push_str(&format!(" AND category_id = ?{}", params.len() + 1));
            params.push(Box::new(category_id.clone()));
        }

        if let Some(is_favorite) = filter.is_favorite {
            query.push_str(&format!(" AND is_favorite = ?{}", params.len() + 1));
            params.push(Box::new(if is_favorite { 1 } else { 0 }));
        }

        // Apply sorting
        let sort_column = match filter.sort_by.unwrap_or_default() {
            TemplateSortBy::Name => "name",
            TemplateSortBy::CreatedAt => "created_at",
            TemplateSortBy::UpdatedAt => "updated_at",
            TemplateSortBy::UsageCount => "usage_count",
        };

        let sort_order = match filter.sort_order.unwrap_or_default() {
            SortOrder::Asc => "ASC",
            SortOrder::Desc => "DESC",
        };

        query.push_str(&format!(" ORDER BY {} {}", sort_column, sort_order));

        // Apply pagination
        if let Some(limit) = filter.limit {
            query.push_str(&format!(" LIMIT ?{}", params.len() + 1));
            params.push(Box::new(limit));

            if let Some(offset) = filter.offset {
                query.push_str(&format!(" OFFSET ?{}", params.len() + 1));
                params.push(Box::new(offset));
            }
        }

        let mut stmt = conn.prepare(&query)
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let template_rows = stmt.query_map(&param_refs[..], |row| {
            Ok(self.row_to_template_basic(row)?)
        }).map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut templates = Vec::new();
        for template_result in template_rows {
            let mut template = template_result
                .map_err(|e| format!("Failed to parse template row: {}", e))?;
            
            // Load parameters for each template
            template.parameters = self.get_template_parameters(&conn, &template.id)?;
            templates.push(template);
        }

        Ok(templates)
    }

    pub async fn get_template_by_id(&self, id: &str) -> Result<Template, String> {
        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let mut template = conn.query_row(
            "SELECT id, name, description, category_id, content, created_at, updated_at, usage_count, is_favorite
             FROM templates WHERE id = ?1",
            params![id],
            |row| Ok(self.row_to_template_basic(row)?),
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => format!("Template not found: {}", id),
            _ => format!("Failed to get template: {}", e),
        })?;

        // Load parameters
        template.parameters = self.get_template_parameters(&conn, id)?;

        Ok(template)
    }

    fn row_to_template_basic(&self, row: &Row) -> Result<Template, rusqlite::Error> {
        let created_at_str: String = row.get("created_at")?;
        let updated_at_str: String = row.get("updated_at")?;
        let is_favorite_int: i32 = row.get("is_favorite")?;

        Ok(Template {
            id: row.get("id")?,
            name: row.get("name")?,
            description: row.get("description")?,
            category_id: row.get("category_id")?,
            content: row.get("content")?,
            created_at: DateTime::parse_from_rfc3339(&created_at_str)
                .map_err(|_| rusqlite::Error::InvalidColumnType(0, "created_at".to_string(), rusqlite::types::Type::Text))?
                .with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(&updated_at_str)
                .map_err(|_| rusqlite::Error::InvalidColumnType(0, "updated_at".to_string(), rusqlite::types::Type::Text))?
                .with_timezone(&Utc),
            usage_count: row.get::<_, u32>("usage_count")?,
            is_favorite: is_favorite_int != 0,
            parameters: Vec::new(), // Will be loaded separately
        })
    }

    fn get_template_parameters(&self, conn: &Connection, template_id: &str) -> Result<Vec<TemplateParameter>, String> {
        let mut stmt = conn.prepare(
            "SELECT id, template_id, name, default_value, description FROM template_parameters WHERE template_id = ?1"
        ).map_err(|e| format!("Failed to prepare parameters query: {}", e))?;

        let param_rows = stmt.query_map(params![template_id], |row| {
            Ok(TemplateParameter {
                id: row.get("id")?,
                template_id: row.get("template_id")?,
                name: row.get("name")?,
                default_value: row.get("default_value")?,
                description: row.get("description")?,
            })
        }).map_err(|e| format!("Failed to query parameters: {}", e))?;

        let mut parameters = Vec::new();
        for param_result in param_rows {
            parameters.push(param_result.map_err(|e| format!("Failed to parse parameter: {}", e))?);
        }

        Ok(parameters)
    }

    fn validate_category_exists(&self, conn: &Connection, category_id: &str) -> Result<(), String> {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM template_categories WHERE id = ?1",
            params![category_id],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to validate category: {}", e))?;

        if count == 0 {
            return Err(format!("Category not found: {}", category_id));
        }

        Ok(())
    }

    pub async fn update_template(&self, id: String, updates: UpdateTemplateRequest) -> Result<Template, String> {
        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        // Check if template exists
        let exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM templates WHERE id = ?1",
            params![id],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to check template existence: {}", e))?;

        if exists == 0 {
            return Err(format!("Template not found: {}", id));
        }

        // Begin transaction
        let tx = conn.unchecked_transaction()
            .map_err(|e| format!("Failed to begin transaction: {}", e))?;

        // Build dynamic update query
        let mut update_fields = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(name) = &updates.name {
            update_fields.push(format!("name = ?{}", params.len() + 1));
            params.push(Box::new(name.clone()));
        }

        if let Some(description) = &updates.description {
            update_fields.push(format!("description = ?{}", params.len() + 1));
            params.push(Box::new(description.clone()));
        }

        if let Some(category_id) = &updates.category_id {
            // Validate category exists
            self.validate_category_exists(&tx, category_id)?;
            update_fields.push(format!("category_id = ?{}", params.len() + 1));
            params.push(Box::new(category_id.clone()));
        }

        if let Some(content) = &updates.content {
            update_fields.push(format!("content = ?{}", params.len() + 1));
            params.push(Box::new(content.clone()));
        }

        if let Some(is_favorite) = updates.is_favorite {
            update_fields.push(format!("is_favorite = ?{}", params.len() + 1));
            params.push(Box::new(if is_favorite { 1 } else { 0 }));
        }

        if !update_fields.is_empty() {
            let query = format!(
                "UPDATE templates SET {} WHERE id = ?{}",
                update_fields.join(", "),
                params.len() + 1
            );
            params.push(Box::new(id.clone()));

            let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
            tx.execute(&query, &param_refs[..])
                .map_err(|e| format!("Failed to update template: {}", e))?;
        }

        // Update parameters if provided
        if let Some(new_parameters) = &updates.parameters {
            // Delete existing parameters
            tx.execute(
                "DELETE FROM template_parameters WHERE template_id = ?1",
                params![id],
            ).map_err(|e| format!("Failed to delete old parameters: {}", e))?;

            // Insert new parameters
            for param in new_parameters {
                let param_id = Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO template_parameters (id, template_id, name, default_value, description)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        param_id,
                        id,
                        param.name,
                        param.default_value,
                        param.description
                    ],
                ).map_err(|e| format!("Failed to insert updated parameter: {}", e))?;
            }
        }

        tx.commit().map_err(|e| format!("Failed to commit update transaction: {}", e))?;

        info!("Updated template: {}", id);

        // Return updated template
        self.get_template_by_id(&id).await
    }

    pub async fn delete_template(&self, id: String) -> Result<(), String> {
        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let deleted_rows = conn.execute(
            "DELETE FROM templates WHERE id = ?1",
            params![id],
        ).map_err(|e| format!("Failed to delete template: {}", e))?;

        if deleted_rows == 0 {
            return Err(format!("Template not found: {}", id));
        }

        info!("Deleted template: {}", id);
        Ok(())
    }

    pub async fn increment_usage_count(&self, id: String) -> Result<(), String> {
        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let updated_rows = conn.execute(
            "UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?1",
            params![id],
        ).map_err(|e| format!("Failed to increment usage count: {}", e))?;

        if updated_rows == 0 {
            return Err(format!("Template not found: {}", id));
        }

        Ok(())
    }

    // Category Management Operations
    pub async fn create_category(&self, request: CreateCategoryRequest) -> Result<TemplateCategory, String> {
        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        // Check for duplicate name
        let duplicate_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM template_categories WHERE name = ?1",
            params![request.name],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to check duplicate category name: {}", e))?;

        if duplicate_count > 0 {
            return Err(format!("Category name '{}' already exists", request.name));
        }

        // Validate parent category if provided
        if let Some(parent_id) = &request.parent_id {
            self.validate_category_exists(&conn, parent_id)?;
        }

        let category_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO template_categories (id, name, parent_id, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                category_id,
                request.name,
                request.parent_id,
                now
            ],
        ).map_err(|e| format!("Failed to insert category: {}", e))?;

        info!("Created category: {} ({})", request.name, category_id);

        Ok(TemplateCategory {
            id: category_id,
            name: request.name,
            parent_id: request.parent_id,
            created_at: DateTime::parse_from_rfc3339(&now).unwrap().with_timezone(&Utc),
            template_count: 0,
        })
    }

    pub async fn get_categories(&self) -> Result<Vec<TemplateCategory>, String> {
        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let mut stmt = conn.prepare(
            "SELECT c.id, c.name, c.parent_id, c.created_at, COUNT(t.id) as template_count
             FROM template_categories c
             LEFT JOIN templates t ON c.id = t.category_id
             GROUP BY c.id, c.name, c.parent_id, c.created_at
             ORDER BY c.name"
        ).map_err(|e| format!("Failed to prepare categories query: {}", e))?;

        let category_rows = stmt.query_map([], |row| {
            let created_at_str: String = row.get("created_at")?;
            Ok(TemplateCategory {
                id: row.get("id")?,
                name: row.get("name")?,
                parent_id: row.get("parent_id")?,
                created_at: DateTime::parse_from_rfc3339(&created_at_str)
                    .map_err(|_| rusqlite::Error::InvalidColumnType(0, "created_at".to_string(), rusqlite::types::Type::Text))?
                    .with_timezone(&Utc),
                template_count: row.get::<_, u32>("template_count")?,
            })
        }).map_err(|e| format!("Failed to query categories: {}", e))?;

        let mut categories = Vec::new();
        for category_result in category_rows {
            categories.push(category_result.map_err(|e| format!("Failed to parse category: {}", e))?);
        }

        Ok(categories)
    }

    pub async fn update_category(&self, id: String, updates: UpdateCategoryRequest) -> Result<TemplateCategory, String> {
        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        // Check if category exists
        let exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM template_categories WHERE id = ?1",
            params![id],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to check category existence: {}", e))?;

        if exists == 0 {
            return Err(format!("Category not found: {}", id));
        }

        // Build dynamic update query
        let mut update_fields = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(name) = &updates.name {
            // Check for duplicate name
            let duplicate_count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM template_categories WHERE name = ?1 AND id != ?2",
                params![name, id],
                |row| row.get(0),
            ).map_err(|e| format!("Failed to check duplicate category name: {}", e))?;

            if duplicate_count > 0 {
                return Err(format!("Category name '{}' already exists", name));
            }

            update_fields.push(format!("name = ?{}", params.len() + 1));
            params.push(Box::new(name.clone()));
        }

        if let Some(parent_id) = &updates.parent_id {
            // Validate parent category exists and prevent circular references
            self.validate_category_exists(&conn, parent_id)?;

            // Check for circular reference
            if self.would_create_circular_reference(&conn, &id, parent_id)? {
                return Err("Cannot set parent: would create circular reference".to_string());
            }

            update_fields.push(format!("parent_id = ?{}", params.len() + 1));
            params.push(Box::new(parent_id.clone()));
        }

        if !update_fields.is_empty() {
            let query = format!(
                "UPDATE template_categories SET {} WHERE id = ?{}",
                update_fields.join(", "),
                params.len() + 1
            );
            params.push(Box::new(id.clone()));

            let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
            conn.execute(&query, &param_refs[..])
                .map_err(|e| format!("Failed to update category: {}", e))?;
        }

        info!("Updated category: {}", id);

        // Return updated category
        let categories = self.get_categories().await?;
        categories.into_iter()
            .find(|c| c.id == id)
            .ok_or_else(|| "Failed to retrieve updated category".to_string())
    }

    pub async fn delete_category(&self, id: String) -> Result<(), String> {
        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        // Check if category has templates
        let template_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM templates WHERE category_id = ?1",
            params![id],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to check category templates: {}", e))?;

        if template_count > 0 {
            return Err(format!("Cannot delete category: contains {} templates", template_count));
        }

        // Check if category has child categories
        let child_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM template_categories WHERE parent_id = ?1",
            params![id],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to check child categories: {}", e))?;

        if child_count > 0 {
            return Err(format!("Cannot delete category: contains {} child categories", child_count));
        }

        let deleted_rows = conn.execute(
            "DELETE FROM template_categories WHERE id = ?1",
            params![id],
        ).map_err(|e| format!("Failed to delete category: {}", e))?;

        if deleted_rows == 0 {
            return Err(format!("Category not found: {}", id));
        }

        info!("Deleted category: {}", id);
        Ok(())
    }

    fn would_create_circular_reference(&self, conn: &Connection, category_id: &str, proposed_parent_id: &str) -> Result<bool, String> {
        // Check if the proposed parent is actually a descendant of the current category
        let mut current_parent = Some(proposed_parent_id.to_string());

        while let Some(parent_id) = current_parent {
            if parent_id == category_id {
                return Ok(true); // Circular reference detected
            }

            current_parent = conn.query_row(
                "SELECT parent_id FROM template_categories WHERE id = ?1",
                params![parent_id],
                |row| row.get::<_, Option<String>>("parent_id"),
            ).map_err(|e| format!("Failed to check parent hierarchy: {}", e))?;
        }

        Ok(false)
    }

    // Search and Statistics Operations
    pub async fn search_templates(&self, query: String) -> Result<Vec<Template>, String> {
        let filter = TemplateFilter {
            search_query: Some(query),
            ..Default::default()
        };
        self.get_templates(filter).await
    }

    pub async fn get_template_statistics(&self) -> Result<TemplateStatistics, String> {
        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        // Get total counts
        let total_templates: u32 = conn.query_row(
            "SELECT COUNT(*) FROM templates",
            [],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to get template count: {}", e))?;

        let total_categories: u32 = conn.query_row(
            "SELECT COUNT(*) FROM template_categories",
            [],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to get category count: {}", e))?;

        // Get most used templates (top 10)
        let most_used_filter = TemplateFilter {
            sort_by: Some(TemplateSortBy::UsageCount),
            sort_order: Some(SortOrder::Desc),
            limit: Some(10),
            ..Default::default()
        };
        let most_used_templates = self.get_templates(most_used_filter).await?;

        // Get recent templates (top 10)
        let recent_filter = TemplateFilter {
            sort_by: Some(TemplateSortBy::UpdatedAt),
            sort_order: Some(SortOrder::Desc),
            limit: Some(10),
            ..Default::default()
        };
        let recent_templates = self.get_templates(recent_filter).await?;

        // Get favorite templates
        let favorite_filter = TemplateFilter {
            is_favorite: Some(true),
            sort_by: Some(TemplateSortBy::Name),
            sort_order: Some(SortOrder::Asc),
            ..Default::default()
        };
        let favorite_templates = self.get_templates(favorite_filter).await?;

        // Get category usage statistics
        let mut stmt = conn.prepare(
            "SELECT c.id, c.name, c.parent_id, c.created_at,
                    COUNT(t.id) as template_count,
                    COALESCE(SUM(t.usage_count), 0) as total_usage
             FROM template_categories c
             LEFT JOIN templates t ON c.id = t.category_id
             GROUP BY c.id, c.name, c.parent_id, c.created_at
             ORDER BY total_usage DESC"
        ).map_err(|e| format!("Failed to prepare category usage query: {}", e))?;

        let category_usage_rows = stmt.query_map([], |row| {
            let created_at_str: String = row.get("created_at")?;
            Ok(CategoryUsage {
                category: TemplateCategory {
                    id: row.get("id")?,
                    name: row.get("name")?,
                    parent_id: row.get("parent_id")?,
                    created_at: DateTime::parse_from_rfc3339(&created_at_str)
                        .map_err(|_| rusqlite::Error::InvalidColumnType(0, "created_at".to_string(), rusqlite::types::Type::Text))?
                        .with_timezone(&Utc),
                    template_count: row.get::<_, u32>("template_count")?,
                },
                template_count: row.get::<_, u32>("template_count")?,
                total_usage: row.get::<_, u32>("total_usage")?,
            })
        }).map_err(|e| format!("Failed to query category usage: {}", e))?;

        let mut category_usage = Vec::new();
        for usage_result in category_usage_rows {
            category_usage.push(usage_result.map_err(|e| format!("Failed to parse category usage: {}", e))?);
        }

        Ok(TemplateStatistics {
            total_templates,
            total_categories,
            most_used_templates,
            recent_templates,
            favorite_templates,
            category_usage,
        })
    }

    // Import/Export Operations
    pub async fn export_templates(&self, template_ids: Vec<String>) -> Result<String, String> {
        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let mut templates = Vec::new();
        let mut category_ids = std::collections::HashSet::new();

        // Get templates and collect category IDs
        for template_id in template_ids {
            match self.get_template_by_id(&template_id).await {
                Ok(template) => {
                    category_ids.insert(template.category_id.clone());
                    templates.push(template);
                }
                Err(e) => warn!("Failed to export template {}: {}", template_id, e),
            }
        }

        // Get categories
        let all_categories = self.get_categories().await?;
        let categories: Vec<TemplateCategory> = all_categories
            .into_iter()
            .filter(|c| category_ids.contains(&c.id))
            .collect();

        let export = TemplateExport {
            templates,
            categories,
            export_version: "1.0".to_string(),
            exported_at: Utc::now(),
        };

        serde_json::to_string_pretty(&export)
            .map_err(|e| format!("Failed to serialize export data: {}", e))
    }

    pub async fn import_templates(&self, template_data: String) -> Result<TemplateImportResult, String> {
        // SECURITY: Validate import data size to prevent DoS attacks
        if template_data.len() > 10_000_000 { // 10MB limit
            return Err("Import data exceeds maximum size limit of 10MB".to_string());
        }

        // SECURITY: Validate JSON structure before parsing
        let export: TemplateExport = serde_json::from_str(&template_data)
            .map_err(|e| format!("Failed to parse import data: {}", e))?;

        // SECURITY: Validate import data structure and content
        self.validate_import_data(&export)?;

        let conn = self.db_connection.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

        let mut imported_templates = 0;
        let mut imported_categories = 0;
        let mut skipped_duplicates = 0;
        let mut errors = Vec::new();

        // Begin transaction
        let tx = conn.unchecked_transaction()
            .map_err(|e| format!("Failed to begin import transaction: {}", e))?;

        // Import categories first
        for category in &export.categories {
            // Check if category already exists
            let exists: i64 = tx.query_row(
                "SELECT COUNT(*) FROM template_categories WHERE name = ?1",
                params![category.name],
                |row| row.get(0),
            ).map_err(|e| format!("Failed to check category existence: {}", e))?;

            if exists > 0 {
                skipped_duplicates += 1;
                continue;
            }

            // Import category
            match tx.execute(
                "INSERT INTO template_categories (id, name, parent_id, created_at)
                 VALUES (?1, ?2, ?3, ?4)",
                params![
                    category.id,
                    category.name,
                    category.parent_id,
                    category.created_at.to_rfc3339()
                ],
            ) {
                Ok(_) => imported_categories += 1,
                Err(e) => errors.push(format!("Failed to import category '{}': {}", category.name, e)),
            }
        }

        // Import templates
        for template in &export.templates {
            // Check if template already exists in the same category
            let exists: i64 = tx.query_row(
                "SELECT COUNT(*) FROM templates WHERE name = ?1 AND category_id = ?2",
                params![template.name, template.category_id],
                |row| row.get(0),
            ).map_err(|e| format!("Failed to check template existence: {}", e))?;

            if exists > 0 {
                skipped_duplicates += 1;
                continue;
            }

            // Import template
            match tx.execute(
                "INSERT INTO templates (id, name, description, category_id, content, created_at, updated_at, usage_count, is_favorite)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    template.id,
                    template.name,
                    template.description,
                    template.category_id,
                    template.content,
                    template.created_at.to_rfc3339(),
                    template.updated_at.to_rfc3339(),
                    template.usage_count,
                    if template.is_favorite { 1 } else { 0 }
                ],
            ) {
                Ok(_) => {
                    // Import parameters
                    for param in &template.parameters {
                        if let Err(e) = tx.execute(
                            "INSERT INTO template_parameters (id, template_id, name, default_value, description)
                             VALUES (?1, ?2, ?3, ?4, ?5)",
                            params![
                                param.id,
                                param.template_id,
                                param.name,
                                param.default_value,
                                param.description
                            ],
                        ) {
                            errors.push(format!("Failed to import parameter '{}' for template '{}': {}", param.name, template.name, e));
                        }
                    }
                    imported_templates += 1;
                }
                Err(e) => errors.push(format!("Failed to import template '{}': {}", template.name, e)),
            }
        }

        tx.commit().map_err(|e| format!("Failed to commit import transaction: {}", e))?;

        info!("Import completed: {} templates, {} categories, {} skipped, {} errors",
              imported_templates, imported_categories, skipped_duplicates, errors.len());

        Ok(TemplateImportResult {
            imported_templates,
            imported_categories,
            skipped_duplicates,
            errors,
        })
    }

    // Parameter Processing Operations
    pub async fn process_template_parameters(&self, template_id: String, substitutions: Vec<ParameterSubstitution>) -> Result<ProcessedTemplate, String> {
        let template = self.get_template_by_id(&template_id).await?;
        let mut processed_content = template.content.clone();
        let mut applied_substitutions = Vec::new();
        let mut missing_parameters = Vec::new();

        // Create substitution map with sanitized values
        let mut substitution_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        for substitution in substitutions {
            let sanitized_value = self.sanitize_parameter_value(&substitution.value)?;
            substitution_map.insert(substitution.parameter_name, sanitized_value);
        }

        // Process each parameter
        for param in &template.parameters {
            let placeholder = format!("{{{{{}}}}}", param.name);

            if let Some(value) = substitution_map.get(&param.name) {
                processed_content = processed_content.replace(&placeholder, value);
                applied_substitutions.push(ParameterSubstitution {
                    parameter_name: param.name.clone(),
                    value: value.clone(),
                });
            } else if let Some(default_value) = &param.default_value {
                let sanitized_default = self.sanitize_parameter_value(default_value)?;
                processed_content = processed_content.replace(&placeholder, &sanitized_default);
                applied_substitutions.push(ParameterSubstitution {
                    parameter_name: param.name.clone(),
                    value: sanitized_default,
                });
            } else {
                missing_parameters.push(param.name.clone());
            }
        }

        Ok(ProcessedTemplate {
            original_content: template.content,
            processed_content,
            substitutions: applied_substitutions,
            missing_parameters,
        })
    }

    /// SECURITY CRITICAL: Sanitizes parameter values to prevent SQL injection attacks
    /// This function must be maintained and updated as new attack vectors are discovered
    fn sanitize_parameter_value(&self, value: &str) -> Result<String, String> {
        // Input validation: check length
        if value.len() > 1000 {
            return Err("Parameter value exceeds maximum length of 1000 characters".to_string());
        }

        // Check for dangerous SQL injection patterns
        let dangerous_patterns = [
            // SQL DML/DDL commands
            r"(?i)\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b",
            // Union-based injection
            r"(?i)\bUNION\s+(ALL\s+)?SELECT\b",
            // Comment-based injection
            r"--[^\r\n]*",
            r"/\*.*?\*/",
            // String termination attempts
            r"['\"];?\s*(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|UNION|SELECT)",
            // Hex encoding attempts
            r"0x[0-9a-fA-F]+",
            // Script injection
            r"(?i)<script|javascript:|vbscript:",
        ];

        for pattern in &dangerous_patterns {
            let regex = regex::Regex::new(pattern).map_err(|e| format!("Regex compilation error: {}", e))?;
            if regex.is_match(value) {
                return Err(format!(
                    "Parameter value contains potentially dangerous content and has been rejected for security reasons"
                ));
            }
        }

        // Additional character-level validation
        let suspicious_chars = ['\'', '"', ';', '\\', '\0'];
        if value.chars().any(|c| suspicious_chars.contains(&c)) {
            return Err("Parameter value contains characters that are not allowed for security reasons".to_string());
        }

        // Validate that the value doesn't contain excessive whitespace or control characters
        if value.chars().any(|c| c.is_control() && c != '\t' && c != '\n' && c != '\r') {
            return Err("Parameter value contains invalid control characters".to_string());
        }

        Ok(value.to_string())
    }

    /// SECURITY CRITICAL: Validates import data to prevent malicious imports
    fn validate_import_data(&self, export: &TemplateExport) -> Result<(), String> {
        // Validate reasonable limits
        if export.templates.len() > 10000 {
            return Err("Import contains too many templates (maximum: 10,000)".to_string());
        }

        if export.categories.len() > 1000 {
            return Err("Import contains too many categories (maximum: 1,000)".to_string());
        }

        // Validate each template
        for template in &export.templates {
            // Validate template name
            if template.name.is_empty() || template.name.len() > 255 {
                return Err(format!("Invalid template name: '{}'", template.name));
            }

            // Validate template content
            if template.content.len() > 100_000 { // 100KB per template
                return Err(format!("Template '{}' content exceeds maximum size", template.name));
            }

            // Validate template content for dangerous patterns
            self.sanitize_parameter_value(&template.content)
                .map_err(|e| format!("Template '{}' contains dangerous content: {}", template.name, e))?;

            // Validate parameters
            if template.parameters.len() > 50 {
                return Err(format!("Template '{}' has too many parameters (maximum: 50)", template.name));
            }

            for param in &template.parameters {
                if param.name.is_empty() || param.name.len() > 100 {
                    return Err(format!("Invalid parameter name in template '{}'", template.name));
                }

                if let Some(default_value) = &param.default_value {
                    self.sanitize_parameter_value(default_value)
                        .map_err(|e| format!("Parameter '{}' in template '{}' has dangerous default value: {}", param.name, template.name, e))?;
                }
            }
        }

        // Validate each category
        for category in &export.categories {
            if category.name.is_empty() || category.name.len() > 255 {
                return Err(format!("Invalid category name: '{}'", category.name));
            }
        }

        Ok(())
    }
}
