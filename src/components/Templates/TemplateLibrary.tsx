// Template Library Component - Story 3.7
// Main interface for browsing and managing SQL query templates

import React, { useState, useCallback } from 'react';
import { useTemplateManager, Template, TemplateCategory } from './hooks/useTemplateManager';
import TemplateTreeView from './TemplateTreeView';
import TemplatePreview from './TemplatePreview';
import TemplateEditor from './TemplateEditor';
import CategoryManager from './CategoryManager';
import TemplateSearch from './TemplateSearch';
import TemplateImportExport from './TemplateImportExport';
import './TemplateLibrary.css';

export interface TemplateLibraryProps {
  isVisible: boolean;
  onClose: () => void;
  onTemplateSelect?: (template: Template) => void;
  onTemplateLoad?: (template: Template, content: string) => void;
  className?: string;
}

const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  isVisible,
  onClose,
  onTemplateSelect,
  onTemplateLoad,
  className = ''
}) => {
  const {
    templates,
    categories,
    statistics,
    isLoading,
    error,
    selectedTemplate,
    selectedCategory,
    selectTemplate,
    selectCategory,
    loadTemplateIntoEditor,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createCategory,
    updateCategory,
    deleteCategory,
    searchTemplates,
    clearSearch,
    filterByCategory,
    filterByFavorites,
    exportTemplates,
    importTemplates,
    refresh,
    clearError
  } = useTemplateManager({
    autoLoad: true,
    onTemplateLoad: (template) => {
      onTemplateLoad?.(template, template.content);
    }
  });

  // Local state for UI management
  const [activeView, setActiveView] = useState<'browse' | 'create' | 'edit' | 'categories' | 'import-export'>('browse');
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingCategory, setEditingCategory] = useState<TemplateCategory | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  // Template operations
  const handleTemplateSelect = useCallback((template: Template) => {
    selectTemplate(template);
    onTemplateSelect?.(template);
  }, [selectTemplate, onTemplateSelect]);

  const handleTemplateLoad = useCallback(async (template: Template) => {
    await loadTemplateIntoEditor(template, (content) => {
      onTemplateLoad?.(template, content);
    });
  }, [loadTemplateIntoEditor, onTemplateLoad]);

  const handleTemplateEdit = useCallback((template: Template) => {
    setEditingTemplate(template);
    setActiveView('edit');
  }, []);

  const handleTemplateDelete = useCallback(async (template: Template) => {
    if (window.confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      const success = await deleteTemplate(template.id);
      if (success && selectedTemplate?.id === template.id) {
        selectTemplate(null);
      }
    }
  }, [deleteTemplate, selectedTemplate, selectTemplate]);

  const handleTemplateDuplicate = useCallback(async (template: Template) => {
    const duplicateRequest = {
      name: `${template.name} (Copy)`,
      description: template.description,
      category_id: template.category_id,
      content: template.content,
      parameters: template.parameters.map(p => ({
        name: p.name,
        default_value: p.default_value,
        description: p.description
      }))
    };

    const newTemplate = await createTemplate(duplicateRequest);
    if (newTemplate) {
      selectTemplate(newTemplate);
    }
  }, [createTemplate, selectTemplate]);

  // Category operations
  const handleCategorySelect = useCallback((category: TemplateCategory | null) => {
    selectCategory(category);
    filterByCategory(category?.id || null);
  }, [selectCategory, filterByCategory]);

  const handleCategoryEdit = useCallback((category: TemplateCategory) => {
    setEditingCategory(category);
    setActiveView('categories');
  }, []);

  const handleCategoryDelete = useCallback(async (category: TemplateCategory) => {
    if (category.template_count > 0) {
      alert(`Cannot delete category "${category.name}" because it contains ${category.template_count} templates.`);
      return;
    }

    if (window.confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
      const success = await deleteCategory(category.id);
      if (success && selectedCategory?.id === category.id) {
        selectCategory(null);
      }
    }
  }, [deleteCategory, selectedCategory, selectCategory]);

  // View management
  const handleCreateTemplate = useCallback(() => {
    setEditingTemplate(null);
    setActiveView('create');
  }, []);

  const handleCreateCategory = useCallback(() => {
    setEditingCategory(null);
    setActiveView('categories');
  }, []);

  const handleViewChange = useCallback((view: typeof activeView) => {
    setActiveView(view);
    setEditingTemplate(null);
    setEditingCategory(null);
  }, []);

  const handleSaveComplete = useCallback(() => {
    setActiveView('browse');
    setEditingTemplate(null);
    setEditingCategory(null);
    refresh();
  }, [refresh]);

  const handleCancel = useCallback(() => {
    setActiveView('browse');
    setEditingTemplate(null);
    setEditingCategory(null);
  }, []);

  // Search and filtering
  const handleSearch = useCallback((query: string) => {
    if (query.trim()) {
      searchTemplates(query);
    } else {
      clearSearch();
    }
  }, [searchTemplates, clearSearch]);

  const handleFavoritesFilter = useCallback((favoritesOnly: boolean) => {
    filterByFavorites(favoritesOnly);
  }, [filterByFavorites]);

  // Import/Export operations
  const handleExportSelected = useCallback(async () => {
    if (!selectedTemplate) {
      alert('Please select a template to export.');
      return;
    }

    const exportData = await exportTemplates([selectedTemplate.id]);
    if (exportData) {
      // Create download link
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template-${selectedTemplate.name.replace(/[^a-zA-Z0-9]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [selectedTemplate, exportTemplates]);

  const handleExportAll = useCallback(async () => {
    if (templates.length === 0) {
      alert('No templates to export.');
      return;
    }

    const templateIds = templates.map(t => t.id);
    const exportData = await exportTemplates(templateIds);
    if (exportData) {
      // Create download link
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all-templates-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [templates, exportTemplates]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const content = await file.text();
      const result = await importTemplates(content);
      if (result) {
        const message = `Import completed:\n` +
          `- ${result.imported_templates} templates imported\n` +
          `- ${result.imported_categories} categories imported\n` +
          `- ${result.skipped_duplicates} duplicates skipped`;
        
        if (result.errors.length > 0) {
          alert(message + `\n\nErrors:\n${result.errors.join('\n')}`);
        } else {
          alert(message);
        }
      }
    } catch (err) {
      alert(`Failed to import templates: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [importTemplates]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`template-library ${className}`}>
      <div className="template-library-header">
        <h2>Template Library</h2>
        <div className="header-actions">
          <button
            className="action-button"
            onClick={() => handleViewChange('browse')}
            disabled={activeView === 'browse'}
            title="Browse Templates"
          >
            Browse
          </button>
          <button
            className="action-button"
            onClick={handleCreateTemplate}
            title="Create New Template"
          >
            New Template
          </button>
          <button
            className="action-button"
            onClick={handleCreateCategory}
            title="Manage Categories"
          >
            Categories
          </button>
          <button
            className="action-button"
            onClick={() => handleViewChange('import-export')}
            title="Import/Export Templates"
          >
            Import/Export
          </button>
          <button
            className="close-button"
            onClick={onClose}
            title="Close Template Library"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-message">{error}</span>
          <button className="error-close" onClick={clearError}>✕</button>
        </div>
      )}

      <div className="template-library-content">
        {activeView === 'browse' && (
          <div className="browse-view">
            <div className="browse-sidebar">
              <TemplateSearch
                onSearch={handleSearch}
                onFavoritesFilter={handleFavoritesFilter}
                onRefresh={refresh}
                isLoading={isLoading}
              />
              
              <TemplateTreeView
                templates={templates}
                categories={categories}
                selectedTemplate={selectedTemplate}
                selectedCategory={selectedCategory}
                onTemplateSelect={handleTemplateSelect}
                onCategorySelect={handleCategorySelect}
                onTemplateLoad={handleTemplateLoad}
                onTemplateEdit={handleTemplateEdit}
                onTemplateDelete={handleTemplateDelete}
                onTemplateDuplicate={handleTemplateDuplicate}
                onCategoryEdit={handleCategoryEdit}
                onCategoryDelete={handleCategoryDelete}
                isLoading={isLoading}
              />
            </div>

            <div className="browse-main">
              {showPreview && selectedTemplate && (
                <TemplatePreview
                  template={selectedTemplate}
                  onLoad={() => handleTemplateLoad(selectedTemplate)}
                  onEdit={() => handleTemplateEdit(selectedTemplate)}
                  onDelete={() => handleTemplateDelete(selectedTemplate)}
                  onDuplicate={() => handleTemplateDuplicate(selectedTemplate)}
                  onClose={() => setShowPreview(false)}
                />
              )}

              {!selectedTemplate && (
                <div className="no-selection">
                  <h3>Template Library</h3>
                  <p>Select a template from the tree to preview it here.</p>
                  {statistics && (
                    <div className="library-stats">
                      <div className="stat-item">
                        <span className="stat-value">{statistics.total_templates}</span>
                        <span className="stat-label">Templates</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{statistics.total_categories}</span>
                        <span className="stat-label">Categories</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {(activeView === 'create' || activeView === 'edit') && (
          <TemplateEditor
            template={editingTemplate}
            categories={categories}
            onSave={handleSaveComplete}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        )}

        {activeView === 'categories' && (
          <CategoryManager
            categories={categories}
            editingCategory={editingCategory}
            onSave={handleSaveComplete}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        )}

        {activeView === 'import-export' && (
          <TemplateImportExport
            templates={templates}
            selectedTemplate={selectedTemplate}
            onExportSelected={handleExportSelected}
            onExportAll={handleExportAll}
            onImport={handleImport}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
};

export default TemplateLibrary;
