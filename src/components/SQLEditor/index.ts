// SQL Editor components exports
export { SQLEditor } from './SQLEditor';

// Types
export type {
  SQLEditorProps,
  SQLEditorState,
  SQLDialect,
  EditorTheme,
  AutoCompletionItem,
  SyntaxError,
  EditorSettings,
} from './types';

// Hooks
export { useSQLEditor } from './hooks/useSQLEditor';
export { useAutoCompletion } from './hooks/useAutoCompletion';
export { useSyntaxValidation } from './hooks/useSyntaxValidation';

// Themes
export { xpTheme } from './themes/xpTheme';
export { highContrastTheme } from './themes/highContrastTheme';
