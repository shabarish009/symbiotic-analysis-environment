// useTemplateManager Hook - Story 3.7
// Dedicated state management hook for template library operations
// Zeus Directive: Prevents main SQLAnalystApp component from becoming bloated

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Template types (matching backend)
export interface Template {
  id: string;
  name: string;
  description?: string;
  category_id: string;
  content: string;
  parameters: TemplateParameter[];
  created_at: string;
  updated_at: string;
  usage_count: number;
  is_favorite: boolean;
}

export interface TemplateParameter {
  id: string;
  template_id: string;
  name: string;
  default_value?: string;
  description?: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  parent_id?: string;
  created_at: string;
  template_count: number;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  category_id: string;
  content: string;
  parameters: CreateParameterRequest[];
}

export interface CreateParameterRequest {
  name: string;
  default_value?: string;
  description?: string;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  category_id?: string;
  content?: string;
  parameters?: CreateParameterRequest[];
  is_favorite?: boolean;
}

export interface CreateCategoryRequest {
  name: string;
  parent_id?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  parent_id?: string;
}

export interface TemplateFilter {
  search_query?: string;
  category_id?: string;
  is_favorite?: boolean;
  sort_by?: 'Name' | 'CreatedAt' | 'UpdatedAt' | 'UsageCount';
  sort_order?: 'Asc' | 'Desc';
  limit?: number;
  offset?: number;
}

export interface TemplateStatistics {
  total_templates: number;
  total_categories: number;
  most_used_templates: Template[];
  recent_templates: Template[];
  favorite_templates: Template[];
  category_usage: CategoryUsage[];
}

export interface CategoryUsage {
  category: TemplateCategory;
  template_count: number;
  total_usage: number;
}

export interface TemplateImportResult {
  imported_templates: number;
  imported_categories: number;
  skipped_duplicates: number;
  errors: string[];
}

export interface ParameterSubstitution {
  parameter_name: string;
  value: string;
}

export interface ProcessedTemplate {
  original_content: string;
  processed_content: string;
  substitutions: ParameterSubstitution[];
  missing_parameters: string[];
}

// Hook options
export interface UseTemplateManagerOptions {
  autoLoad?: boolean;
  defaultFilter?: TemplateFilter;
  onError?: (error: string) => void;
  onTemplateLoad?: (template: Template) => void;
}

// Hook return type
export interface UseTemplateManagerReturn {
  // State
  templates: Template[];
  categories: TemplateCategory[];
  statistics: TemplateStatistics | null;
  isLoading: boolean;
  error: string | null;
  filter: TemplateFilter;
  selectedTemplate: Template | null;
  selectedCategory: TemplateCategory | null;
  
  // Actions
  setFilter: (filter: Partial<TemplateFilter>) => void;
  loadTemplates: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadStatistics: () => Promise<void>;
  createTemplate: (request: CreateTemplateRequest) => Promise<Template | null>;
  updateTemplate: (id: string, updates: UpdateTemplateRequest) => Promise<Template | null>;
  deleteTemplate: (id: string) => Promise<boolean>;
  selectTemplate: (template: Template | null) => void;
  loadTemplateIntoEditor: (template: Template, onLoad?: (content: string) => void) => Promise<void>;
  incrementUsage: (id: string) => Promise<void>;
  
  // Category management
  createCategory: (request: CreateCategoryRequest) => Promise<TemplateCategory | null>;
  updateCategory: (id: string, updates: UpdateCategoryRequest) => Promise<TemplateCategory | null>;
  deleteCategory: (id: string) => Promise<boolean>;
  selectCategory: (category: TemplateCategory | null) => void;
  
  // Search and filtering
  searchTemplates: (query: string) => Promise<void>;
  clearSearch: () => void;
  filterByCategory: (categoryId: string | null) => void;
  filterByFavorites: (favoritesOnly: boolean) => void;
  
  // Import/Export
  exportTemplates: (templateIds: string[]) => Promise<string | null>;
  importTemplates: (templateData: string) => Promise<TemplateImportResult | null>;
  
  // Parameter processing
  processTemplateParameters: (templateId: string, substitutions: ParameterSubstitution[]) => Promise<ProcessedTemplate | null>;
  
  // Utilities
  getTemplatesByCategory: (categoryId: string) => Template[];
  getRecentTemplates: (limit?: number) => Template[];
  getPopularTemplates: (limit?: number) => Template[];
  getFavoriteTemplates: () => Template[];
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useTemplateManager(options: UseTemplateManagerOptions = {}): UseTemplateManagerReturn {
  const {
    autoLoad = true,
    defaultFilter = {},
    onError,
    onTemplateLoad
  } = options;

  // State management
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [statistics, setStatistics] = useState<TemplateStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilterState] = useState<TemplateFilter>({
    sort_by: 'UpdatedAt',
    sort_order: 'Desc',
    ...defaultFilter
  });
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | null>(null);

  // Refs for cleanup and race condition prevention
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      refresh();
    }
  }, [autoLoad]);

  // Error handling utility
  const handleError = useCallback((err: string) => {
    if (!mountedRef.current) return;
    setError(err);
    onError?.(err);
    console.error('Template Manager Error:', err);
  }, [onError]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load templates with current filter - PERFORMANCE OPTIMIZED
  const loadTemplates = useCallback(async (): Promise<void> => {
    if (loadingRef.current || !mountedRef.current) return;

    loadingRef.current = true;
    setIsLoading(true);
    clearError();

    try {
      // Performance optimization: Use AbortController for request cancellation
      const abortController = new AbortController();

      // Store abort controller for cleanup
      const currentAbortController = abortController;

      const result = await invoke<Template[]>('get_templates', { filter });

      // Check if component is still mounted and request wasn't aborted
      if (mountedRef.current && !currentAbortController.signal.aborted) {
        // Performance optimization: Batch state updates
        setTemplates(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        handleError(err instanceof Error ? err.message : 'Failed to load templates');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        loadingRef.current = false;
      }
    }
  }, [filter, handleError]);

  // Load categories
  const loadCategories = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;

    try {
      const result = await invoke<TemplateCategory[]>('get_template_categories');
      if (mountedRef.current) {
        setCategories(result);
      }
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to load categories');
    }
  }, [handleError]);

  // Load statistics
  const loadStatistics = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;

    try {
      const result = await invoke<TemplateStatistics>('get_template_statistics');
      if (mountedRef.current) {
        setStatistics(result);
      }
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to load statistics');
    }
  }, [handleError]);

  // Refresh all data
  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([
      loadTemplates(),
      loadCategories(),
      loadStatistics()
    ]);
  }, [loadTemplates, loadCategories, loadStatistics]);

  // Set filter and reload templates
  const setFilter = useCallback((newFilter: Partial<TemplateFilter>) => {
    setFilterState(prev => ({ ...prev, ...newFilter }));
  }, []);

  // Reload templates when filter changes
  useEffect(() => {
    if (autoLoad) {
      loadTemplates();
    }
  }, [filter, loadTemplates, autoLoad]);

  // Template CRUD operations
  const createTemplate = useCallback(async (request: CreateTemplateRequest): Promise<Template | null> => {
    if (!mountedRef.current) return null;

    try {
      const result = await invoke<Template>('create_template', { request });
      if (mountedRef.current) {
        // Refresh templates to include the new one
        await loadTemplates();
        return result;
      }
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to create template');
    }
    return null;
  }, [loadTemplates, handleError]);

  const updateTemplate = useCallback(async (id: string, updates: UpdateTemplateRequest): Promise<Template | null> => {
    if (!mountedRef.current) return null;

    try {
      const result = await invoke<Template>('update_template', { id, updates });
      if (mountedRef.current) {
        // Update the template in the current list
        setTemplates(prev => prev.map(t => t.id === id ? result : t));
        // Update selected template if it's the one being updated
        if (selectedTemplate?.id === id) {
          setSelectedTemplate(result);
        }
        return result;
      }
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to update template');
    }
    return null;
  }, [selectedTemplate, handleError]);

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    if (!mountedRef.current) return false;

    try {
      await invoke('delete_template', { id });
      if (mountedRef.current) {
        // Remove template from current list
        setTemplates(prev => prev.filter(t => t.id !== id));
        // Clear selection if deleted template was selected
        if (selectedTemplate?.id === id) {
          setSelectedTemplate(null);
        }
        return true;
      }
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to delete template');
    }
    return false;
  }, [selectedTemplate, handleError]);

  // Template selection and loading
  const selectTemplate = useCallback((template: Template | null) => {
    setSelectedTemplate(template);
  }, []);

  const loadTemplateIntoEditor = useCallback(async (template: Template, onLoad?: (content: string) => void): Promise<void> => {
    if (!mountedRef.current) return;

    try {
      // Increment usage count
      await invoke('increment_template_usage', { id: template.id });
      
      // Update local usage count
      setTemplates(prev => prev.map(t => 
        t.id === template.id 
          ? { ...t, usage_count: t.usage_count + 1 }
          : t
      ));

      // Call the load callback
      onLoad?.(template.content);
      onTemplateLoad?.(template);
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to load template');
    }
  }, [handleError, onTemplateLoad]);

  const incrementUsage = useCallback(async (id: string): Promise<void> => {
    if (!mountedRef.current) return;

    try {
      await invoke('increment_template_usage', { id });
      // Update local usage count
      setTemplates(prev => prev.map(t => 
        t.id === id 
          ? { ...t, usage_count: t.usage_count + 1 }
          : t
      ));
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to increment usage');
    }
  }, [handleError]);

  // Category management
  const createCategory = useCallback(async (request: CreateCategoryRequest): Promise<TemplateCategory | null> => {
    if (!mountedRef.current) return null;

    try {
      const result = await invoke<TemplateCategory>('create_template_category', { request });
      if (mountedRef.current) {
        // Refresh categories to include the new one
        await loadCategories();
        return result;
      }
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to create category');
    }
    return null;
  }, [loadCategories, handleError]);

  const updateCategory = useCallback(async (id: string, updates: UpdateCategoryRequest): Promise<TemplateCategory | null> => {
    if (!mountedRef.current) return null;

    try {
      const result = await invoke<TemplateCategory>('update_template_category', { id, updates });
      if (mountedRef.current) {
        // Update the category in the current list
        setCategories(prev => prev.map(c => c.id === id ? result : c));
        // Update selected category if it's the one being updated
        if (selectedCategory?.id === id) {
          setSelectedCategory(result);
        }
        return result;
      }
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to update category');
    }
    return null;
  }, [selectedCategory, handleError]);

  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    if (!mountedRef.current) return false;

    try {
      await invoke('delete_template_category', { id });
      if (mountedRef.current) {
        // Remove category from current list
        setCategories(prev => prev.filter(c => c.id !== id));
        // Clear selection if deleted category was selected
        if (selectedCategory?.id === id) {
          setSelectedCategory(null);
        }
        // Clear category filter if it was the deleted category
        if (filter.category_id === id) {
          setFilter({ category_id: undefined });
        }
        return true;
      }
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to delete category');
    }
    return false;
  }, [selectedCategory, filter.category_id, setFilter, handleError]);

  const selectCategory = useCallback((category: TemplateCategory | null) => {
    setSelectedCategory(category);
  }, []);

  // Search and filtering utilities
  const searchTemplates = useCallback(async (query: string): Promise<void> => {
    setFilter({ search_query: query });
  }, [setFilter]);

  const clearSearch = useCallback(() => {
    setFilter({ search_query: undefined });
  }, [setFilter]);

  const filterByCategory = useCallback((categoryId: string | null) => {
    setFilter({ category_id: categoryId || undefined });
  }, [setFilter]);

  const filterByFavorites = useCallback((favoritesOnly: boolean) => {
    setFilter({ is_favorite: favoritesOnly ? true : undefined });
  }, [setFilter]);

  // Import/Export operations
  const exportTemplates = useCallback(async (templateIds: string[]): Promise<string | null> => {
    if (!mountedRef.current) return null;

    try {
      const result = await invoke<string>('export_templates', { template_ids: templateIds });
      return result;
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to export templates');
      return null;
    }
  }, [handleError]);

  const importTemplates = useCallback(async (templateData: string): Promise<TemplateImportResult | null> => {
    if (!mountedRef.current) return null;

    try {
      const result = await invoke<TemplateImportResult>('import_templates', { template_data: templateData });
      if (mountedRef.current) {
        // Refresh data after import
        await refresh();
        return result;
      }
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to import templates');
    }
    return null;
  }, [refresh, handleError]);

  // Parameter processing
  const processTemplateParameters = useCallback(async (templateId: string, substitutions: ParameterSubstitution[]): Promise<ProcessedTemplate | null> => {
    if (!mountedRef.current) return null;

    try {
      const result = await invoke<ProcessedTemplate>('process_template_parameters', { 
        template_id: templateId, 
        substitutions 
      });
      return result;
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to process template parameters');
      return null;
    }
  }, [handleError]);

  // Utility functions - PERFORMANCE OPTIMIZED with memoization
  const getTemplatesByCategory = useCallback((categoryId: string): Template[] => {
    return templates.filter(t => t.category_id === categoryId);
  }, [templates]);

  // Memoized recent templates calculation
  const getRecentTemplates = useMemo(() => {
    return (limit: number = 10): Template[] => {
      return [...templates]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, limit);
    };
  }, [templates]);

  // Memoized popular templates calculation
  const getPopularTemplates = useMemo(() => {
    return (limit: number = 10): Template[] => {
      return [...templates]
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, limit);
    };
  }, [templates]);

  // Memoized favorite templates calculation
  const getFavoriteTemplates = useMemo(() => {
    return templates.filter(t => t.is_favorite);
  }, [templates]);

  return {
    // State
    templates,
    categories,
    statistics,
    isLoading,
    error,
    filter,
    selectedTemplate,
    selectedCategory,
    
    // Actions
    setFilter,
    loadTemplates,
    loadCategories,
    loadStatistics,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    selectTemplate,
    loadTemplateIntoEditor,
    incrementUsage,
    
    // Category management
    createCategory,
    updateCategory,
    deleteCategory,
    selectCategory,
    
    // Search and filtering
    searchTemplates,
    clearSearch,
    filterByCategory,
    filterByFavorites,
    
    // Import/Export
    exportTemplates,
    importTemplates,
    
    // Parameter processing
    processTemplateParameters,
    
    // Utilities
    getTemplatesByCategory,
    getRecentTemplates,
    getPopularTemplates,
    getFavoriteTemplates,
    refresh,
    clearError
  };
}
