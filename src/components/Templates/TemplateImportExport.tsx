// Template Import/Export Component - Story 3.7
// Interface for importing and exporting templates

import React, { useCallback, useRef } from 'react';
import { Template } from './hooks/useTemplateManager';

export interface TemplateImportExportProps {
  templates: Template[];
  selectedTemplate: Template | null;
  onExportSelected: () => void;
  onExportAll: () => void;
  onImport: (file: File) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const TemplateImportExport: React.FC<TemplateImportExportProps> = ({
  templates,
  selectedTemplate,
  onExportSelected,
  onExportAll,
  onImport,
  onCancel,
  isLoading = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImport(file);
      // Reset the input so the same file can be selected again
      event.target.value = '';
    }
  }, [onImport]);

  return (
    <div className="template-import-export">
      <div className="import-export-header">
        <h3>Import/Export Templates</h3>
      </div>

      <div className="import-export-content">
        <div className="export-section">
          <h4>Export Templates</h4>
          <p>Export templates to share with others or backup your work.</p>
          
          <div className="export-actions">
            <button
              className="export-button"
              onClick={onExportSelected}
              disabled={!selectedTemplate || isLoading}
            >
              Export Selected Template
            </button>
            <button
              className="export-button"
              onClick={onExportAll}
              disabled={templates.length === 0 || isLoading}
            >
              Export All Templates ({templates.length})
            </button>
          </div>
        </div>

        <div className="import-section">
          <h4>Import Templates</h4>
          <p>Import templates from a JSON file exported from another instance.</p>
          
          <div className="import-actions">
            <button
              className="import-button"
              onClick={handleImportClick}
              disabled={isLoading}
            >
              Choose File to Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>

      <div className="import-export-actions">
        <button
          className="cancel-button"
          onClick={onCancel}
          disabled={isLoading}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default TemplateImportExport;
