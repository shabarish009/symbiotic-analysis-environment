// Template Editor Component - Story 3.7
// Form for creating and editing templates

import React, { useState, useCallback, useEffect } from 'react';
import { Template, TemplateCategory, CreateTemplateRequest, CreateParameterRequest } from './hooks/useTemplateManager';
import { useTemplateManager } from './hooks/useTemplateManager';

export interface TemplateEditorProps {
  template?: Template | null;
  categories: TemplateCategory[];
  onSave: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  categories,
  onSave,
  onCancel,
  isLoading = false
}) => {
  const { createTemplate, updateTemplate } = useTemplateManager({ autoLoad: false });
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    content: '',
    parameters: [] as CreateParameterRequest[]
  });

  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || '',
        category_id: template.category_id,
        content: template.content,
        parameters: template.parameters.map(p => ({
          name: p.name,
          default_value: p.default_value,
          description: p.description
        }))
      });
    } else {
      setFormData({
        name: '',
        description: '',
        category_id: categories[0]?.id || '',
        content: '',
        parameters: []
      });
    }
  }, [template, categories]);

  const handleInputChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      alert('Please provide a name and SQL content for the template.');
      return;
    }

    setIsSaving(true);
    try {
      const request: CreateTemplateRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        category_id: formData.category_id,
        content: formData.content.trim(),
        parameters: formData.parameters
      };

      if (template) {
        await updateTemplate(template.id, request);
      } else {
        await createTemplate(request);
      }

      onSave();
    } catch (error) {
      alert(`Failed to save template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  }, [formData, template, createTemplate, updateTemplate, onSave]);

  return (
    <div className="template-editor">
      <div className="editor-header">
        <h3>{template ? 'Edit Template' : 'Create New Template'}</h3>
      </div>

      <div className="editor-form">
        <div className="form-group">
          <label htmlFor="template-name">Name:</label>
          <input
            id="template-name"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            disabled={isSaving}
            placeholder="Enter template name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="template-description">Description:</label>
          <textarea
            id="template-description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            disabled={isSaving}
            placeholder="Optional description"
            rows={2}
          />
        </div>

        <div className="form-group">
          <label htmlFor="template-category">Category:</label>
          <select
            id="template-category"
            value={formData.category_id}
            onChange={(e) => handleInputChange('category_id', e.target.value)}
            disabled={isSaving}
          >
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="template-content">SQL Content:</label>
          <textarea
            id="template-content"
            value={formData.content}
            onChange={(e) => handleInputChange('content', e.target.value)}
            disabled={isSaving}
            placeholder="Enter your SQL query here"
            rows={10}
            style={{ fontFamily: 'Lucida Console, Courier New, monospace' }}
          />
        </div>
      </div>

      <div className="editor-actions">
        <button
          className="save-button"
          onClick={handleSave}
          disabled={isSaving || isLoading}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          className="cancel-button"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default TemplateEditor;
