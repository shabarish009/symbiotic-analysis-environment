import { EditorState, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

// SQL Dialect types
export type SQLDialect = 
  | 'postgresql'
  | 'mysql'
  | 'sqlite'
  | 'mssql'
  | 'oracle'
  | 'generic';

// Editor theme types
export type EditorTheme = 'xp' | 'high-contrast';

// SQL Editor component props
export interface SQLEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  onExecute?: (query: string) => void;
  dialect?: SQLDialect;
  theme?: EditorTheme;
  readOnly?: boolean;
  placeholder?: string;
  height?: string | number;
  width?: string | number;
  className?: string;
  autoFocus?: boolean;
  lineNumbers?: boolean;
  foldGutter?: boolean;
  highlightActiveLine?: boolean;
  highlightSelectionMatches?: boolean;
  searchEnabled?: boolean;
  autoCompletion?: boolean;
  syntaxValidation?: boolean;
  connectionId?: string;
  onCursorChange?: (line: number, column: number) => void;
  onSelectionChange?: (selection: { from: number; to: number }) => void;
  onError?: (error: SyntaxError) => void;
  settings?: EditorSettings;
}

// Editor state interface
export interface SQLEditorState {
  value: string;
  selection: { from: number; to: number };
  cursor: { line: number; column: number };
  hasChanges: boolean;
  isExecuting: boolean;
  errors: SyntaxError[];
  completions: AutoCompletionItem[];
  dialect: SQLDialect;
  theme: EditorTheme;
}

// Auto-completion item
export interface AutoCompletionItem {
  label: string;
  type: 'keyword' | 'table' | 'column' | 'function' | 'snippet';
  detail?: string;
  info?: string;
  boost?: number;
  apply?: string;
  section?: string;
}

// Syntax error interface
export interface SyntaxError {
  from: number;
  to: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  source: string;
}

// Editor settings
export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  indentWithTabs: boolean;
  lineWrapping: boolean;
  showWhitespace: boolean;
  highlightTrailingWhitespace: boolean;
  autoCloseBrackets: boolean;
  autoCloseQuotes: boolean;
  matchBrackets: boolean;
  foldCode: boolean;
  searchCaseSensitive: boolean;
  searchRegex: boolean;
  searchWholeWord: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  maxHistorySize: number;
}

// Database schema types for auto-completion
export interface DatabaseSchema {
  tables: TableInfo[];
  views: ViewInfo[];
  functions: FunctionInfo[];
  keywords: string[];
}

export interface TableInfo {
  name: string;
  schema?: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  comment?: string;
}

export interface ViewInfo {
  name: string;
  schema?: string;
  columns: ColumnInfo[];
}

export interface FunctionInfo {
  name: string;
  schema?: string;
  returnType: string;
  parameters: ParameterInfo[];
  description?: string;
}

export interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

export interface ForeignKeyInfo {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  referencedSchema?: string;
}

// Query execution types
export interface QueryExecution {
  query: string;
  dialect: SQLDialect;
  connectionId?: string;
  executionId: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled';
  results?: QueryResults;
  error?: string;
}

export interface QueryResults {
  columns: ResultColumn[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
  affectedRows?: number;
}

export interface ResultColumn {
  name: string;
  type: string;
  nullable: boolean;
}

// Editor events
export interface EditorEvents {
  onValueChange: (value: string) => void;
  onCursorChange: (line: number, column: number) => void;
  onSelectionChange: (selection: { from: number; to: number }) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent) => boolean | void;
  onKeyUp: (event: KeyboardEvent) => boolean | void;
  onPaste: (event: ClipboardEvent) => boolean | void;
  onDrop: (event: DragEvent) => boolean | void;
}

// Theme configuration
export interface ThemeConfig {
  name: string;
  colors: {
    background: string;
    foreground: string;
    selection: string;
    selectionMatch: string;
    lineNumber: string;
    lineNumberActive: string;
    activeLine: string;
    cursor: string;
    keyword: string;
    string: string;
    comment: string;
    number: string;
    operator: string;
    function: string;
    variable: string;
    error: string;
    warning: string;
    info: string;
  };
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

// Accessibility features
export interface AccessibilityFeatures {
  screenReaderSupport: boolean;
  keyboardNavigation: boolean;
  highContrast: boolean;
  announceErrors: boolean;
  announceCompletions: boolean;
  customFontSize: boolean;
  focusIndicators: boolean;
}

// Performance metrics
export interface PerformanceMetrics {
  renderTime: number;
  syntaxHighlightTime: number;
  autoCompletionTime: number;
  validationTime: number;
  memoryUsage: number;
  documentSize: number;
}

// Editor command types
export type EditorCommand = 
  | 'undo'
  | 'redo'
  | 'selectAll'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'find'
  | 'replace'
  | 'findNext'
  | 'findPrevious'
  | 'toggleComment'
  | 'formatDocument'
  | 'foldAll'
  | 'unfoldAll'
  | 'gotoLine'
  | 'execute'
  | 'executeSelection';

// Editor extension configuration
export interface ExtensionConfig {
  basicSetup: boolean;
  lineNumbers: boolean;
  foldGutter: boolean;
  dropCursor: boolean;
  allowMultipleSelections: boolean;
  indentOnInput: boolean;
  bracketMatching: boolean;
  closeBrackets: boolean;
  autocompletion: boolean;
  highlightSelectionMatches: boolean;
  searchKeymap: boolean;
  history: boolean;
  drawSelection: boolean;
  rectangularSelection: boolean;
  crosshairCursor: boolean;
  highlightActiveLine: boolean;
  keymap: Extension[];
}
