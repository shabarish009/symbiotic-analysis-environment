import { useState, useCallback, useRef, useEffect } from 'react';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';
import { sql } from '@codemirror/lang-sql';
import { 
  autocompletion, 
  completionKeymap, 
  closeBrackets, 
  closeBracketsKeymap 
} from '@codemirror/autocomplete';
import { 
  searchKeymap, 
  highlightSelectionMatches, 
  search 
} from '@codemirror/search';
import { 
  history, 
  defaultKeymap, 
  historyKeymap, 
  indentWithTab 
} from '@codemirror/commands';
import { 
  foldGutter, 
  indentOnInput, 
  bracketMatching, 
  foldKeymap, 
  syntaxHighlighting, 
  defaultHighlightStyle 
} from '@codemirror/language';
import { 
  lineNumbers, 
  highlightActiveLineGutter, 
  highlightSpecialChars, 
  drawSelection, 
  dropCursor, 
  rectangularSelection, 
  crosshairCursor, 
  highlightActiveLine, 
  keymap 
} from '@codemirror/view';
import { linter, lintKeymap } from '@codemirror/lint';

import type { 
  SQLEditorProps, 
  SQLEditorState, 
  SQLDialect, 
  EditorTheme, 
  SyntaxError,
  EditorSettings,
  PerformanceMetrics 
} from '../types';
import { xpThemeExtension } from '../themes/xpTheme';
import { highContrastThemeExtension } from '../themes/highContrastTheme';

export function useSQLEditor(props: SQLEditorProps) {
  const {
    value = '',
    onChange,
    onExecute,
    dialect = 'postgresql',
    theme = 'xp',
    readOnly = false,
    placeholder = 'Enter your SQL query...',
    autoFocus = false,
    lineNumbers: showLineNumbers = true,
    foldGutter: showFoldGutter = true,
    highlightActiveLine: highlightActive = true,
    highlightSelectionMatches: highlightMatches = true,
    searchEnabled = true,
    autoCompletion: enableAutoCompletion = true,
    syntaxValidation = true,
    connectionId,
    onCursorChange,
    onSelectionChange,
    onError,
    settings,
  } = props;

  // Editor state
  const [editorState, setEditorState] = useState<SQLEditorState>({
    value,
    selection: { from: 0, to: 0 },
    cursor: { line: 1, column: 1 },
    hasChanges: false,
    isExecuting: false,
    errors: [],
    completions: [],
    dialect,
    theme,
  });

  // Performance metrics
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    syntaxHighlightTime: 0,
    autoCompletionTime: 0,
    validationTime: 0,
    memoryUsage: 0,
    documentSize: 0,
  });

  // Editor view reference
  const viewRef = useRef<EditorView | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Default editor settings
  const defaultSettings: EditorSettings = {
    fontSize: 12,
    fontFamily: '"Lucida Console", "Courier New", monospace',
    tabSize: 2,
    indentWithTabs: false,
    lineWrapping: false,
    showWhitespace: false,
    highlightTrailingWhitespace: true,
    autoCloseBrackets: true,
    autoCloseQuotes: true,
    matchBrackets: true,
    foldCode: true,
    searchCaseSensitive: false,
    searchRegex: false,
    searchWholeWord: false,
    autoSave: true,
    autoSaveInterval: 30000, // 30 seconds
    maxHistorySize: 100,
  };

  const currentSettings = { ...defaultSettings, ...settings };

  // SQL dialect configuration
  const getSQLDialectConfig = useCallback((dialect: SQLDialect) => {
    const dialectConfigs = {
      postgresql: { 
        keywords: 'postgresql',
        functions: ['array_agg', 'string_agg', 'generate_series', 'unnest'],
        types: ['uuid', 'jsonb', 'inet', 'cidr', 'macaddr', 'tsquery', 'tsvector']
      },
      mysql: { 
        keywords: 'mysql',
        functions: ['group_concat', 'find_in_set', 'inet_aton', 'inet_ntoa'],
        types: ['tinyint', 'mediumint', 'bigint', 'decimal', 'float', 'double']
      },
      sqlite: { 
        keywords: 'sqlite',
        functions: ['sqlite_version', 'random', 'abs', 'round'],
        types: ['integer', 'real', 'text', 'blob']
      },
      mssql: { 
        keywords: 'mssql',
        functions: ['newid', 'getdate', 'datediff', 'charindex'],
        types: ['nvarchar', 'uniqueidentifier', 'datetime2', 'varbinary']
      },
      oracle: { 
        keywords: 'oracle',
        functions: ['sysdate', 'nvl', 'decode', 'rownum'],
        types: ['varchar2', 'number', 'date', 'clob', 'blob']
      },
      generic: { 
        keywords: 'sql',
        functions: ['count', 'sum', 'avg', 'min', 'max'],
        types: ['varchar', 'integer', 'decimal', 'date', 'timestamp']
      }
    };
    return dialectConfigs[dialect] || dialectConfigs.generic;
  }, []);

  // Theme configuration
  const getThemeExtension = useCallback((theme: EditorTheme): Extension => {
    switch (theme) {
      case 'high-contrast':
        return highContrastThemeExtension;
      case 'xp':
      default:
        return xpThemeExtension;
    }
  }, []);

  // Create editor extensions
  const createExtensions = useCallback((): Extension[] => {
    const extensions: Extension[] = [];

    // Basic setup
    extensions.push(
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      rectangularSelection(),
      crosshairCursor(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab,
      ])
    );

    // Line numbers
    if (showLineNumbers) {
      extensions.push(lineNumbers(), highlightActiveLineGutter());
    }

    // Fold gutter
    if (showFoldGutter) {
      extensions.push(foldGutter());
    }

    // Active line highlighting
    if (highlightActive) {
      extensions.push(highlightActiveLine());
    }

    // Selection match highlighting
    if (highlightMatches) {
      extensions.push(highlightSelectionMatches());
    }

    // Search functionality
    if (searchEnabled) {
      extensions.push(search());
    }

    // Auto-completion
    if (enableAutoCompletion) {
      extensions.push(autocompletion());
    }

    // Bracket closing
    if (currentSettings.autoCloseBrackets) {
      extensions.push(closeBrackets());
    }

    // SQL language support
    const dialectConfig = getSQLDialectConfig(dialect);
    extensions.push(sql({
      dialect: dialectConfig.keywords as any,
      upperCaseKeywords: true,
    }));

    // Theme
    extensions.push(getThemeExtension(theme));

    // Syntax highlighting
    extensions.push(syntaxHighlighting(defaultHighlightStyle, { fallback: true }));

    // Read-only mode
    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    // Tab size and indentation
    extensions.push(EditorState.tabSize.of(currentSettings.tabSize));

    // Line wrapping
    if (currentSettings.lineWrapping) {
      extensions.push(EditorView.lineWrapping);
    }

    // Placeholder
    if (placeholder && !value) {
      extensions.push(EditorView.theme({
        '.cm-placeholder': {
          color: theme === 'high-contrast' ? '#808080' : '#999999',
          fontStyle: 'italic',
        }
      }));
    }

    // Update listener
    extensions.push(EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) {
        const newValue = update.state.doc.toString();
        setEditorState(prev => ({
          ...prev,
          value: newValue,
          hasChanges: newValue !== value,
          documentSize: newValue.length,
        }));
        
        // Performance tracking
        const renderStart = performance.now();
        if (onChange) {
          onChange(newValue);
        }
        const renderTime = performance.now() - renderStart;
        
        setMetrics(prev => ({
          ...prev,
          renderTime,
          documentSize: newValue.length,
        }));
      }

      // Selection and cursor changes
      if (update.selectionSet) {
        const selection = update.state.selection.main;
        const cursor = update.state.doc.lineAt(selection.head);
        
        setEditorState(prev => ({
          ...prev,
          selection: { from: selection.from, to: selection.to },
          cursor: { line: cursor.number, column: selection.head - cursor.from + 1 },
        }));

        if (onCursorChange) {
          onCursorChange(cursor.number, selection.head - cursor.from + 1);
        }

        if (onSelectionChange) {
          onSelectionChange({ from: selection.from, to: selection.to });
        }
      }
    }));

    return extensions;
  }, [
    dialect, theme, showLineNumbers, showFoldGutter, highlightActive, 
    highlightMatches, searchEnabled, enableAutoCompletion, readOnly, 
    placeholder, value, currentSettings, onChange, onCursorChange, onSelectionChange
  ]);

  // Initialize editor
  const initializeEditor = useCallback((container: HTMLElement) => {
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const startState = EditorState.create({
      doc: value,
      extensions: createExtensions(),
    });

    const view = new EditorView({
      state: startState,
      parent: container,
    });

    viewRef.current = view;

    if (autoFocus) {
      view.focus();
    }

    return view;
  }, [value, createExtensions, autoFocus]);

  // Update editor when props change
  useEffect(() => {
    if (viewRef.current && viewRef.current.state.doc.toString() !== value) {
      const transaction = viewRef.current.state.update({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value,
        },
      });
      viewRef.current.dispatch(transaction);
    }
  }, [value]);

  // Update extensions when relevant props change
  useEffect(() => {
    if (viewRef.current) {
      const newExtensions = createExtensions();
      viewRef.current.dispatch({
        effects: EditorState.reconfigure.of(newExtensions),
      });
    }
  }, [createExtensions]);

  // Editor commands
  const executeCommand = useCallback((command: string) => {
    if (!viewRef.current) return;

    const view = viewRef.current;
    const state = view.state;

    switch (command) {
      case 'execute':
        if (onExecute) {
          const selectedText = state.sliceDoc(state.selection.main.from, state.selection.main.to);
          const queryToExecute = selectedText || state.doc.toString();
          onExecute(queryToExecute);
        }
        break;
      case 'format':
        // TODO: Implement SQL formatting
        break;
      case 'comment':
        // TODO: Implement comment toggling
        break;
      default:
        console.warn(`Unknown command: ${command}`);
    }
  }, [onExecute]);

  // Get current editor value
  const getValue = useCallback(() => {
    return viewRef.current?.state.doc.toString() || '';
  }, []);

  // Set editor value
  const setValue = useCallback((newValue: string) => {
    if (viewRef.current) {
      const transaction = viewRef.current.state.update({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: newValue,
        },
      });
      viewRef.current.dispatch(transaction);
    }
  }, []);

  // Focus editor
  const focus = useCallback(() => {
    viewRef.current?.focus();
  }, []);

  // Get selection
  const getSelection = useCallback(() => {
    if (!viewRef.current) return { from: 0, to: 0 };
    const selection = viewRef.current.state.selection.main;
    return { from: selection.from, to: selection.to };
  }, []);

  // Set selection
  const setSelection = useCallback((from: number, to: number) => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        selection: { anchor: from, head: to },
      });
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, []);

  return {
    // State
    editorState,
    metrics,
    
    // Refs
    viewRef,
    containerRef,
    
    // Methods
    initializeEditor,
    executeCommand,
    getValue,
    setValue,
    focus,
    getSelection,
    setSelection,
    
    // Settings
    currentSettings,
  };
}
