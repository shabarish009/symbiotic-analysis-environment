// Template Tree View Component - Story 3.7
// Hierarchical tree view for browsing templates by category

import React, { useState, useCallback, useMemo } from 'react';
import { Template, TemplateCategory } from './hooks/useTemplateManager';
import './TemplateTreeView.css';

export interface TemplateTreeViewProps {
  templates: Template[];
  categories: TemplateCategory[];
  selectedTemplate: Template | null;
  selectedCategory: TemplateCategory | null;
  onTemplateSelect: (template: Template) => void;
  onCategorySelect: (category: TemplateCategory | null) => void;
  onTemplateLoad: (template: Template) => void;
  onTemplateEdit: (template: Template) => void;
  onTemplateDelete: (template: Template) => void;
  onTemplateDuplicate: (template: Template) => void;
  onCategoryEdit: (category: TemplateCategory) => void;
  onCategoryDelete: (category: TemplateCategory) => void;
  isLoading?: boolean;
}

interface TreeNode {
  type: 'category' | 'template';
  id: string;
  name: string;
  data: TemplateCategory | Template;
  children: TreeNode[];
  level: number;
}

const TemplateTreeView: React.FC<TemplateTreeViewProps> = ({
  templates,
  categories,
  selectedTemplate,
  selectedCategory,
  onTemplateSelect,
  onCategorySelect,
  onTemplateLoad,
  onTemplateEdit,
  onTemplateDelete,
  onTemplateDuplicate,
  onCategoryEdit,
  onCategoryDelete,
  isLoading = false
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'category' | 'template';
    data: TemplateCategory | Template;
  } | null>(null);

  // Build hierarchical tree structure
  const treeData = useMemo(() => {
    const categoryMap = new Map<string, TemplateCategory>();
    const templatesByCategory = new Map<string, Template[]>();

    // Index categories
    categories.forEach(category => {
      categoryMap.set(category.id, category);
    });

    // Group templates by category
    templates.forEach(template => {
      const categoryTemplates = templatesByCategory.get(template.category_id) || [];
      categoryTemplates.push(template);
      templatesByCategory.set(template.category_id, categoryTemplates);
    });

    // Build tree nodes
    const buildCategoryNode = (category: TemplateCategory, level: number): TreeNode => {
      const categoryTemplates = templatesByCategory.get(category.id) || [];
      const childCategories = categories.filter(c => c.parent_id === category.id);

      const children: TreeNode[] = [
        // Child categories
        ...childCategories.map(child => buildCategoryNode(child, level + 1)),
        // Templates in this category
        ...categoryTemplates.map(template => ({
          type: 'template' as const,
          id: template.id,
          name: template.name,
          data: template,
          children: [],
          level: level + 1
        }))
      ];

      return {
        type: 'category',
        id: category.id,
        name: category.name,
        data: category,
        children,
        level
      };
    };

    // Get root categories (no parent)
    const rootCategories = categories.filter(c => !c.parent_id);
    return rootCategories.map(category => buildCategoryNode(category, 0));
  }, [categories, templates]);

  // Toggle node expansion
  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // Handle node selection
  const handleNodeClick = useCallback((node: TreeNode, event: React.MouseEvent) => {
    event.preventDefault();

    if (node.type === 'category') {
      onCategorySelect(node.data as TemplateCategory);
      toggleExpanded(node.id);
    } else {
      onTemplateSelect(node.data as Template);
    }
  }, [onCategorySelect, onTemplateSelect, toggleExpanded]);

  // ACCESSIBILITY: Enhanced keyboard navigation
  const handleKeyDown = useCallback((node: TreeNode, event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (node.type === 'category') {
          toggleExpanded(node.id);
          onCategorySelect(node.data as TemplateCategory);
        } else {
          onTemplateSelect(node.data as Template);
        }
        break;
      case 'ArrowRight':
        if (node.type === 'category' && !expandedNodes.has(node.id)) {
          event.preventDefault();
          toggleExpanded(node.id);
        }
        break;
      case 'ArrowLeft':
        if (node.type === 'category' && expandedNodes.has(node.id)) {
          event.preventDefault();
          toggleExpanded(node.id);
        }
        break;
      default:
        break;
    }
  }, [expandedNodes, toggleExpanded, onCategorySelect, onTemplateSelect]);

  // Handle double-click for template loading
  const handleNodeDoubleClick = useCallback((node: TreeNode, event: React.MouseEvent) => {
    event.preventDefault();
    
    if (node.type === 'template') {
      onTemplateLoad(node.data as Template);
    }
  }, [onTemplateLoad]);

  // Handle context menu
  const handleContextMenu = useCallback((node: TreeNode, event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: node.type,
      data: node.data
    });
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Context menu actions
  const handleContextAction = useCallback((action: string) => {
    if (!contextMenu) return;

    const { type, data } = contextMenu;
    
    if (type === 'template') {
      const template = data as Template;
      switch (action) {
        case 'load':
          onTemplateLoad(template);
          break;
        case 'edit':
          onTemplateEdit(template);
          break;
        case 'duplicate':
          onTemplateDuplicate(template);
          break;
        case 'delete':
          onTemplateDelete(template);
          break;
      }
    } else if (type === 'category') {
      const category = data as TemplateCategory;
      switch (action) {
        case 'edit':
          onCategoryEdit(category);
          break;
        case 'delete':
          onCategoryDelete(category);
          break;
      }
    }

    closeContextMenu();
  }, [contextMenu, onTemplateLoad, onTemplateEdit, onTemplateDuplicate, onTemplateDelete, onCategoryEdit, onCategoryDelete, closeContextMenu]);

  // Render tree node
  const renderNode = useCallback((node: TreeNode): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = node.type === 'template' 
      ? selectedTemplate?.id === node.id
      : selectedCategory?.id === node.id;

    const hasChildren = node.children.length > 0;
    const indentLevel = node.level * 16;

    return (
      <div key={node.id} className="tree-node-container">
        <div
          className={`tree-node ${node.type} ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${indentLevel + 8}px` }}
          onClick={(e) => handleNodeClick(node, e)}
          onDoubleClick={(e) => handleNodeDoubleClick(node, e)}
          onContextMenu={(e) => handleContextMenu(node, e)}
          onKeyDown={(e) => handleKeyDown(node, e)}
          role="treeitem"
          aria-selected={isSelected}
          aria-expanded={node.type === 'category' ? isExpanded : undefined}
          aria-label={node.type === 'category'
            ? `Category: ${node.name}, ${(node.data as TemplateCategory).template_count} templates`
            : `Template: ${node.name}, used ${(node.data as Template).usage_count} times`
          }
          tabIndex={0}
        >
          {node.type === 'category' && (
            <span 
              className={`expand-icon ${hasChildren ? (isExpanded ? 'expanded' : 'collapsed') : 'empty'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) toggleExpanded(node.id);
              }}
            >
              {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
            </span>
          )}
          
          <span className={`node-icon ${node.type}`}>
            {node.type === 'category' ? '📁' : '📄'}
          </span>
          
          <span className="node-name">{node.name}</span>
          
          {node.type === 'template' && (
            <div className="template-info">
              <span className="usage-count" title="Usage count">
                {(node.data as Template).usage_count}
              </span>
              {(node.data as Template).is_favorite && (
                <span className="favorite-icon" title="Favorite">⭐</span>
              )}
            </div>
          )}
          
          {node.type === 'category' && (
            <span className="template-count" title="Template count">
              ({(node.data as TemplateCategory).template_count})
            </span>
          )}
        </div>

        {node.type === 'category' && isExpanded && hasChildren && (
          <div className="tree-children">
            {node.children.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
  }, [expandedNodes, selectedTemplate, selectedCategory, handleNodeClick, handleNodeDoubleClick, handleContextMenu, toggleExpanded]);

  // Click outside to close context menu
  React.useEffect(() => {
    const handleClickOutside = () => closeContextMenu();
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu, closeContextMenu]);

  if (isLoading) {
    return (
      <div className="template-tree-view loading">
        <div className="loading-indicator">
          <div className="loading-spinner"></div>
          Loading templates...
        </div>
      </div>
    );
  }

  return (
    <div className="template-tree-view">
      <div className="tree-header">
        <h4>Templates</h4>
        <div className="tree-stats">
          {templates.length} templates in {categories.length} categories
        </div>
      </div>

      <div className="tree-content" role="tree">
        {treeData.length > 0 ? (
          treeData.map(node => renderNode(node))
        ) : (
          <div className="empty-tree">
            <p>No templates found.</p>
            <p>Create your first template to get started.</p>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'template' ? (
            <>
              <button onClick={() => handleContextAction('load')}>
                Load Template
              </button>
              <button onClick={() => handleContextAction('edit')}>
                Edit Template
              </button>
              <button onClick={() => handleContextAction('duplicate')}>
                Duplicate Template
              </button>
              <hr />
              <button onClick={() => handleContextAction('delete')} className="danger">
                Delete Template
              </button>
            </>
          ) : (
            <>
              <button onClick={() => handleContextAction('edit')}>
                Edit Category
              </button>
              <hr />
              <button onClick={() => handleContextAction('delete')} className="danger">
                Delete Category
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TemplateTreeView;
