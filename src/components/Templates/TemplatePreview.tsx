// Template Preview Component - Story 3.7
// Preview panel for displaying template details and actions

import React, { useState, useCallback } from 'react';
import { Template } from './hooks/useTemplateManager';
import './TemplatePreview.css';

export interface TemplatePreviewProps {
  template: Template;
  onLoad: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  onLoad,
  onEdit,
  onDelete,
  onDuplicate,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'content' | 'parameters' | 'metadata'>('content');

  const formatDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return dateString;
    }
  }, []);

  const handleTabChange = useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could show a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, []);

  return (
    <div className="template-preview">
      <div className="preview-header">
        <div className="template-title">
          <h3>{template.name}</h3>
          {template.is_favorite && <span className="favorite-star">⭐</span>}
        </div>
        <div className="header-actions">
          <button
            className="action-button primary"
            onClick={onLoad}
            title="Load template into editor"
          >
            Load
          </button>
          <button
            className="action-button"
            onClick={onEdit}
            title="Edit template"
          >
            Edit
          </button>
          <button
            className="action-button"
            onClick={onDuplicate}
            title="Duplicate template"
          >
            Duplicate
          </button>
          <button
            className="action-button danger"
            onClick={onDelete}
            title="Delete template"
          >
            Delete
          </button>
          <button
            className="close-button"
            onClick={onClose}
            title="Close preview"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {template.description && (
        <div className="template-description">
          <p>{template.description}</p>
        </div>
      )}

      <div className="preview-tabs">
        <button
          className={`tab-button ${activeTab === 'content' ? 'active' : ''}`}
          onClick={() => handleTabChange('content')}
        >
          SQL Content
        </button>
        <button
          className={`tab-button ${activeTab === 'parameters' ? 'active' : ''}`}
          onClick={() => handleTabChange('parameters')}
        >
          Parameters ({template.parameters.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'metadata' ? 'active' : ''}`}
          onClick={() => handleTabChange('metadata')}
        >
          Metadata
        </button>
      </div>

      <div className="preview-content">
        {activeTab === 'content' && (
          <div className="content-tab">
            <div className="content-header">
              <h4>SQL Query</h4>
              <button
                className="copy-button"
                onClick={() => copyToClipboard(template.content)}
                title="Copy SQL to clipboard"
              >
                Copy
              </button>
            </div>
            <div className="sql-content">
              <pre><code>{template.content}</code></pre>
            </div>
          </div>
        )}

        {activeTab === 'parameters' && (
          <div className="parameters-tab">
            <div className="parameters-header">
              <h4>Template Parameters</h4>
              {template.parameters.length > 0 && (
                <p className="parameters-info">
                  This template uses parameters that will be substituted when loaded.
                </p>
              )}
            </div>
            
            {template.parameters.length > 0 ? (
              <div className="parameters-list">
                {template.parameters.map((param, index) => (
                  <div key={param.id || index} className="parameter-item">
                    <div className="parameter-header">
                      <span className="parameter-name">
                        {`{{${param.name}}}`}
                      </span>
                      {param.default_value && (
                        <span className="parameter-default">
                          Default: {param.default_value}
                        </span>
                      )}
                    </div>
                    {param.description && (
                      <div className="parameter-description">
                        {param.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-parameters">
                <p>This template has no parameters.</p>
                <p>Parameters allow you to create dynamic templates with placeholders like <code>{`{{table_name}}`}</code>.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className="metadata-tab">
            <h4>Template Information</h4>
            <div className="metadata-grid">
              <div className="metadata-item">
                <label>Created:</label>
                <span>{formatDate(template.created_at)}</span>
              </div>
              <div className="metadata-item">
                <label>Last Modified:</label>
                <span>{formatDate(template.updated_at)}</span>
              </div>
              <div className="metadata-item">
                <label>Usage Count:</label>
                <span>{template.usage_count} times</span>
              </div>
              <div className="metadata-item">
                <label>Template ID:</label>
                <span className="template-id">{template.id}</span>
              </div>
              <div className="metadata-item">
                <label>Category ID:</label>
                <span className="category-id">{template.category_id}</span>
              </div>
              <div className="metadata-item">
                <label>Favorite:</label>
                <span>{template.is_favorite ? 'Yes' : 'No'}</span>
              </div>
            </div>

            <div className="metadata-actions">
              <button
                className="copy-button"
                onClick={() => copyToClipboard(JSON.stringify(template, null, 2))}
                title="Copy template metadata as JSON"
              >
                Copy as JSON
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatePreview;
