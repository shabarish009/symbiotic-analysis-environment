import React, { useEffect, useRef, useCallback, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { linter, Diagnostic } from '@codemirror/lint';
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';

import { useSQLEditor } from './hooks/useSQLEditor';
import { useAutoCompletion } from './hooks/useAutoCompletion';
import { useSyntaxValidation } from './hooks/useSyntaxValidation';
import type { SQLEditorProps, SyntaxError } from './types';
import './SQLEditor.css';

export const SQLEditor: React.FC<SQLEditorProps> = (props) => {
  const {
    value = '',
    onChange,
    onExecute,
    dialect = 'postgresql',
    theme = 'xp',
    readOnly = false,
    placeholder = 'Enter your SQL query...',
    height = '400px',
    width = '100%',
    className = '',
    autoFocus = false,
    lineNumbers = true,
    foldGutter = true,
    highlightActiveLine = true,
    highlightSelectionMatches = true,
    searchEnabled = true,
    autoCompletion: enableAutoCompletion = true,
    syntaxValidation = true,
    connectionId,
    onCursorChange,
    onSelectionChange,
    onError,
    settings,
  } = props;

  // Container ref for the editor
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Custom hooks for editor functionality
  const {
    editorState,
    metrics,
    viewRef,
    initializeEditor,
    executeCommand,
    getValue,
    setValue,
    focus,
    getSelection,
    setSelection,
    currentSettings,
  } = useSQLEditor({
    ...props,
    settings,
  });

  // Auto-completion hook
  const {
    isLoading: isLoadingCompletions,
    error: completionError,
    schema,
    generateCompletions,
  } = useAutoCompletion({
    dialect,
    connectionId,
    enabled: enableAutoCompletion,
  });

  // Syntax validation hook
  const {
    isValidating,
    errors,
    warnings,
    suggestions,
    validateSQL,
    clearValidation,
  } = useSyntaxValidation({
    dialect,
    connectionId,
    enabled: syntaxValidation,
    debounceMs: 500,
  });

  // Create auto-completion extension with performance optimization
  const createAutoCompletionExtension = useCallback((): Extension => {
    if (!enableAutoCompletion) return [];

    return autocompletion({
      override: [
        async (context: CompletionContext): Promise<CompletionResult | null> => {
          const startTime = performance.now();

          try {
            const word = context.matchBefore(/\w*/);
            if (!word || (word.from === word.to && !context.explicit)) {
              return null;
            }

            // Performance optimization: Use requestIdleCallback for non-urgent completions
            const completions = await new Promise<any[]>((resolve, reject) => {
              const doCompletion = async () => {
                try {
                  const result = await generateCompletions(
                    context.state.doc.toString(),
                    context.pos
                  );
                  resolve(result);
                } catch (error) {
                  reject(error);
                }
              };

              // Use requestIdleCallback if available, otherwise setTimeout
              if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(doCompletion, { timeout: 50 });
              } else {
                setTimeout(doCompletion, 0);
              }
            });

            const completionTime = performance.now() - startTime;

            // Enhanced performance monitoring with metrics collection
            if (completionTime > 100) {
              console.warn(`Slow auto-completion: ${completionTime.toFixed(2)}ms`);
              // Report to performance monitoring if available
              if (typeof performance.mark !== 'undefined') {
                performance.mark('sql-editor-slow-completion');
              }
            }

            return {
              from: word.from,
              options: completions.map(item => ({
                label: item.label,
                type: item.type,
                detail: item.detail,
                info: item.info,
                boost: item.boost,
                section: item.section,
                apply: item.apply,
              })),
            };
          } catch (error) {
            console.error('Auto-completion error:', error);
            // Enhanced error reporting
            if (onError) {
              onError({
                from: 0,
                to: 0,
                message: `Auto-completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                severity: 'warning' as const,
                source: 'auto-completion',
              });
            }
            return null;
          }
        },
      ],
      closeOnBlur: false,
      maxRenderedOptions: 50,
      defaultKeymap: true,
      // Performance optimization: Increase debounce for better performance
      activateOnTyping: true,
      interactionDelay: 75, // Slightly increased from default for better performance
    });
  }, [enableAutoCompletion, generateCompletions, onError]);

  // Create linting extension for syntax validation
  const createLintingExtension = useCallback((): Extension => {
    if (!syntaxValidation) return [];

    return linter((view: EditorView): Diagnostic[] => {
      const diagnostics: Diagnostic[] = [];

      // Convert syntax errors to CodeMirror diagnostics
      [...errors, ...warnings].forEach((error: SyntaxError) => {
        diagnostics.push({
          from: Math.max(0, error.from),
          to: Math.min(view.state.doc.length, error.to),
          severity: error.severity,
          message: error.message,
          source: error.source,
        });
      });

      return diagnostics;
    }, {
      delay: 300,
    });
  }, [syntaxValidation, errors, warnings]);

  // Handle value changes for validation
  const handleValueChange = useCallback((newValue: string) => {
    if (onChange) {
      onChange(newValue);
    }

    // Trigger syntax validation
    if (syntaxValidation) {
      validateSQL(newValue);
    }

    // Report errors to parent component
    if (onError && errors.length > 0) {
      onError(errors[0]); // Report first error
    }
  }, [onChange, syntaxValidation, validateSQL, onError, errors]);

  // Handle drag and drop functionality
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    try {
      // Try to get structured data first
      const jsonData = event.dataTransfer.getData('application/json');
      let insertText = '';

      if (jsonData) {
        const dragData = JSON.parse(jsonData);
        insertText = dragData.insertText || dragData.name || '';
      } else {
        // Fallback to plain text
        insertText = event.dataTransfer.getData('text/plain');
      }

      if (insertText && viewRef.current) {
        const view = viewRef.current;
        const { state } = view;
        const { selection } = state;

        // Insert text at cursor position
        const transaction = state.update({
          changes: {
            from: selection.main.from,
            to: selection.main.to,
            insert: insertText,
          },
          selection: {
            anchor: selection.main.from + insertText.length,
          },
        });

        view.dispatch(transaction);
        view.focus();

        // Trigger onChange if provided
        if (onChange) {
          onChange(transaction.state.doc.toString());
        }
      }
    } catch (error) {
      console.error('Error handling drop:', error);
      // Fallback to plain text
      const plainText = event.dataTransfer.getData('text/plain');
      if (plainText && onChange) {
        const currentValue = value || '';
        onChange(currentValue + plainText);
      }
    }
  }, [onChange, value, viewRef]);

  // Initialize editor when container is ready
  useEffect(() => {
    if (containerRef.current && !isInitialized) {
      try {
        const view = initializeEditor(containerRef.current);
        
        // Add custom extensions
        const customExtensions: Extension[] = [
          createAutoCompletionExtension(),
          createLintingExtension(),
        ];

        if (customExtensions.length > 0) {
          view.dispatch({
            effects: view.state.reconfigure.of([
              ...view.state.extensions,
              ...customExtensions,
            ]),
          });
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize SQL editor:', error);
      }
    }
  }, [isInitialized, initializeEditor, createAutoCompletionExtension, createLintingExtension]);

  // Update extensions when dependencies change
  useEffect(() => {
    if (viewRef.current && isInitialized) {
      const customExtensions: Extension[] = [
        createAutoCompletionExtension(),
        createLintingExtension(),
      ];

      viewRef.current.dispatch({
        effects: viewRef.current.state.reconfigure.of([
          ...viewRef.current.state.extensions.filter(ext => 
            // Keep only non-custom extensions
            !ext.toString().includes('autocompletion') && 
            !ext.toString().includes('linter')
          ),
          ...customExtensions,
        ]),
      });
    }
  }, [createAutoCompletionExtension, createLintingExtension, isInitialized]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Ctrl+Enter or Cmd+Enter to execute query
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      executeCommand('execute');
    }

    // Ctrl+/ or Cmd+/ to toggle comments
    if ((event.ctrlKey || event.metaKey) && event.key === '/') {
      event.preventDefault();
      executeCommand('comment');
    }

    // Ctrl+Shift+F or Cmd+Shift+F to format
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'F') {
      event.preventDefault();
      executeCommand('format');
    }

    // F5 to execute query
    if (event.key === 'F5') {
      event.preventDefault();
      executeCommand('execute');
    }
  }, [executeCommand]);

  // Enhanced accessibility: Announce errors and completions to screen readers
  useEffect(() => {
    if (errors.length > 0) {
      const errorMessage = `SQL Error on line ${errors[0].from || 1}: ${errors[0].message}`;

      // Create a temporary element for screen reader announcement
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'assertive'); // Changed to assertive for errors
      announcement.setAttribute('aria-atomic', 'true');
      announcement.setAttribute('role', 'alert'); // Added alert role for better screen reader support
      announcement.style.position = 'absolute';
      announcement.style.left = '-10000px';
      announcement.style.width = '1px';
      announcement.style.height = '1px';
      announcement.style.overflow = 'hidden';
      announcement.textContent = errorMessage;

      document.body.appendChild(announcement);

      // Remove after announcement with better cleanup
      const cleanup = () => {
        if (document.body.contains(announcement)) {
          document.body.removeChild(announcement);
        }
      };
      setTimeout(cleanup, 1500); // Increased timeout for better screen reader compatibility
    }
  }, [errors]);

  // Announce completion loading state to screen readers
  useEffect(() => {
    if (isLoadingCompletions) {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.style.position = 'absolute';
      announcement.style.left = '-10000px';
      announcement.style.width = '1px';
      announcement.style.height = '1px';
      announcement.style.overflow = 'hidden';
      announcement.textContent = 'Loading auto-completion suggestions';

      document.body.appendChild(announcement);

      const cleanup = () => {
        if (document.body.contains(announcement)) {
          document.body.removeChild(announcement);
        }
      };
      setTimeout(cleanup, 1000);
    }
  }, [isLoadingCompletions]);

  // Cleanup validation on unmount
  useEffect(() => {
    return () => {
      clearValidation();
    };
  }, [clearValidation]);

  return (
    <div 
      className={`sql-editor ${className} ${theme === 'high-contrast' ? 'high-contrast' : ''}`}
      style={{ 
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
      }}
      onKeyDown={handleKeyDown}
      role="application"
      aria-label="SQL Editor"
      aria-describedby="sql-editor-help"
    >
      {/* Hidden help text for screen readers */}
      <div 
        id="sql-editor-help" 
        className="sr-only"
        aria-hidden="true"
      >
        SQL code editor with syntax highlighting and auto-completion. 
        Press Ctrl+Enter to execute query, Ctrl+/ to toggle comments, 
        Ctrl+Shift+F to format code.
      </div>

      {/* Editor container */}
      <div
        ref={containerRef}
        className="sql-editor-container"
        style={{
          fontFamily: currentSettings.fontFamily,
          fontSize: `${currentSettings.fontSize}px`,
        }}
        aria-label="SQL code input"
        role="textbox"
        aria-multiline="true"
        aria-describedby={errors.length > 0 ? 'sql-editor-errors' : undefined}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-drop-target="true"
      />

      {/* Status indicators */}
      <div className="sql-editor-status">
        {isValidating && (
          <div className="status-indicator validating" aria-live="polite">
            <span className="status-icon">⏳</span>
            <span className="status-text">Validating...</span>
          </div>
        )}
        
        {isLoadingCompletions && (
          <div className="status-indicator loading" aria-live="polite">
            <span className="status-icon">🔄</span>
            <span className="status-text">Loading completions...</span>
          </div>
        )}

        {errors.length > 0 && (
          <div 
            id="sql-editor-errors"
            className="status-indicator error" 
            aria-live="polite"
            role="alert"
          >
            <span className="status-icon">❌</span>
            <span className="status-text">
              {errors.length} error{errors.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="status-indicator warning" aria-live="polite">
            <span className="status-icon">⚠️</span>
            <span className="status-text">
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {connectionId && schema && (
          <div className="status-indicator connected" aria-live="polite">
            <span className="status-icon">🔗</span>
            <span className="status-text">
              Connected ({schema.tables.length} tables)
            </span>
          </div>
        )}
      </div>

      {/* Performance metrics (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="sql-editor-metrics">
          <small>
            Render: {metrics.renderTime.toFixed(1)}ms | 
            Size: {metrics.documentSize} chars |
            Memory: {(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB
          </small>
        </div>
      )}
    </div>
  );
};
