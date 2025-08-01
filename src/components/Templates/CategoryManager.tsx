// Category Manager Component - Story 3.7
// Interface for managing template categories

import React, { useState, useCallback } from 'react';
import { TemplateCategory, CreateCategoryRequest } from './hooks/useTemplateManager';
import { useTemplateManager } from './hooks/useTemplateManager';

export interface CategoryManagerProps {
  categories: TemplateCategory[];
  editingCategory?: TemplateCategory | null;
  onSave: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({
  categories,
  editingCategory,
  onSave,
  onCancel,
  isLoading = false
}) => {
  const { createCategory, updateCategory } = useTemplateManager({ autoLoad: false });
  
  const [formData, setFormData] = useState({
    name: editingCategory?.name || '',
    parent_id: editingCategory?.parent_id || ''
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.name.trim()) {
      alert('Please provide a name for the category.');
      return;
    }

    setIsSaving(true);
    try {
      const request: CreateCategoryRequest = {
        name: formData.name.trim(),
        parent_id: formData.parent_id || undefined
      };

      if (editingCategory) {
        await updateCategory(editingCategory.id, request);
      } else {
        await createCategory(request);
      }

      onSave();
    } catch (error) {
      alert(`Failed to save category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  }, [formData, editingCategory, createCategory, updateCategory, onSave]);

  return (
    <div className="category-manager">
      <div className="manager-header">
        <h3>{editingCategory ? 'Edit Category' : 'Create New Category'}</h3>
      </div>

      <div className="manager-form">
        <div className="form-group">
          <label htmlFor="category-name">Name:</label>
          <input
            id="category-name"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            disabled={isSaving}
            placeholder="Enter category name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="category-parent">Parent Category:</label>
          <select
            id="category-parent"
            value={formData.parent_id}
            onChange={(e) => handleInputChange('parent_id', e.target.value)}
            disabled={isSaving}
          >
            <option value="">None (Root Category)</option>
            {categories
              .filter(cat => cat.id !== editingCategory?.id) // Prevent circular reference
              .map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="manager-actions">
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

export default CategoryManager;
