/**
 * Schema Explorer Component
 * Displays database schemas with XP styling
 */

import React, { useState } from 'react';
import { SchemaExplorerProps, SchemaInfo } from '../../types/memory';
import './SchemaExplorer.css';

const SchemaExplorer: React.FC<SchemaExplorerProps> = ({
  projectId,
  schemas,
  onSchemaSelect,
  searchQuery = ''
}) => {
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [selectedSchema, setSelectedSchema] = useState<SchemaInfo | null>(null);

  const toggleSchemaExpansion = (schemaKey: string) => {
    const newExpanded = new Set(expandedSchemas);
    if (newExpanded.has(schemaKey)) {
      newExpanded.delete(schemaKey);
    } else {
      newExpanded.add(schemaKey);
    }
    setExpandedSchemas(newExpanded);
  };

  const handleSchemaClick = (schema: SchemaInfo) => {
    setSelectedSchema(schema);
    onSchemaSelect?.(schema);
  };

  const filteredSchemas = schemas.filter(schema => 
    searchQuery === '' || 
    schema.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    schema.schema_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (schemas.length === 0) {
    return (
      <div className="schema-explorer">
        <div className="empty-state">
          <div className="empty-icon">🗃️</div>
          <div className="empty-message">
            <strong>No Database Schemas Found</strong>
            <p>Connect to a database or import schema information to see tables and columns here.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="schema-explorer">
      <div className="schema-header">
        <h4>Database Schemas ({filteredSchemas.length})</h4>
        <div className="schema-info">
          Project: <strong>{projectId}</strong>
        </div>
      </div>

      <div className="schema-list">
        {filteredSchemas.map((schema) => {
          const schemaKey = `${schema.schema_name}.${schema.table_name}`;
          const isExpanded = expandedSchemas.has(schemaKey);
          const isSelected = selectedSchema?.table_name === schema.table_name && 
                           selectedSchema?.schema_name === schema.schema_name;

          return (
            <div key={schemaKey} className="schema-item">
              <div 
                className={`schema-header-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSchemaClick(schema)}
              >
                <button
                  className="expand-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSchemaExpansion(schemaKey);
                  }}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
                <span className="schema-icon">📋</span>
                <span className="schema-name">
                  {schema.schema_name}.{schema.table_name}
                </span>
                <span className="column-count">
                  ({Object.keys(schema.columns).length} columns)
                </span>
              </div>

              {isExpanded && (
                <div className="schema-details">
                  <div className="columns-section">
                    <h5>Columns</h5>
                    <div className="columns-list">
                      {Object.entries(schema.columns).map(([columnName, columnInfo]) => (
                        <div key={columnName} className="column-item">
                          <span className="column-name">{columnName}</span>
                          <span className="column-type">{columnInfo.type}</span>
                          <div className="column-flags">
                            {columnInfo.primary_key && <span className="flag pk">PK</span>}
                            {columnInfo.unique && <span className="flag unique">UNIQUE</span>}
                            {!columnInfo.nullable && <span className="flag not-null">NOT NULL</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {schema.relationships.length > 0 && (
                    <div className="relationships-section">
                      <h5>Relationships</h5>
                      <div className="relationships-list">
                        {schema.relationships.map((rel, index) => (
                          <div key={index} className="relationship-item">
                            <span className="rel-icon">🔗</span>
                            <span className="rel-text">
                              {rel.column} → {rel.references}
                            </span>
                            <span className="rel-type">{rel.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {schema.indexes.length > 0 && (
                    <div className="indexes-section">
                      <h5>Indexes</h5>
                      <div className="indexes-list">
                        {schema.indexes.map((index, i) => (
                          <div key={i} className="index-item">
                            <span className="index-icon">📇</span>
                            <span className="index-name">{index.name}</span>
                            <span className="index-columns">
                              ({index.columns.join(', ')})
                            </span>
                            {index.unique && <span className="flag unique">UNIQUE</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="schema-metadata">
                    <small>
                      Last updated: {new Date(schema.last_updated * 1000).toLocaleString()}
                    </small>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SchemaExplorer;
