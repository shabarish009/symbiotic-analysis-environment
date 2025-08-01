// Templates Module Exports - Story 3.7
// Central export point for all template-related components and hooks

// Main components
export { default as TemplateLibrary } from './TemplateLibrary';
export { default as TemplateTreeView } from './TemplateTreeView';
export { default as TemplatePreview } from './TemplatePreview';
export { default as TemplateEditor } from './TemplateEditor';
export { default as TemplateSearch } from './TemplateSearch';
export { default as CategoryManager } from './CategoryManager';
export { default as TemplateImportExport } from './TemplateImportExport';

// Hooks and types
export { useTemplateManager } from './hooks/useTemplateManager';
export type {
  Template,
  TemplateCategory,
  TemplateParameter,
  CreateTemplateRequest,
  CreateParameterRequest,
  UpdateTemplateRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  TemplateFilter,
  TemplateStatistics,
  CategoryUsage,
  TemplateImportResult,
  ParameterSubstitution,
  ProcessedTemplate,
  UseTemplateManagerOptions,
  UseTemplateManagerReturn
} from './hooks/useTemplateManager';

// Component prop types
export type { TemplateLibraryProps } from './TemplateLibrary';
export type { TemplateTreeViewProps } from './TemplateTreeView';
export type { TemplatePreviewProps } from './TemplatePreview';
export type { TemplateEditorProps } from './TemplateEditor';
export type { TemplateSearchProps } from './TemplateSearch';
export type { CategoryManagerProps } from './CategoryManager';
export type { TemplateImportExportProps } from './TemplateImportExport';
