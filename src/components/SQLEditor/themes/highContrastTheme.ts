import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// High contrast color palette for accessibility (WCAG AA compliant)
const highContrastColors = {
  // Background colors
  background: '#000000',
  backgroundSecondary: '#1a1a1a',
  backgroundActive: '#ffffff',
  
  // Text colors
  foreground: '#ffffff',
  foregroundSecondary: '#cccccc',
  foregroundActive: '#000000',
  
  // Selection colors
  selection: '#ffffff',
  selectionBackground: '#404040',
  selectionMatch: '#606060',
  
  // Line colors
  lineNumber: '#808080',
  lineNumberActive: '#ffffff',
  activeLine: '#1a1a1a',
  
  // Cursor
  cursor: '#ffffff',
  
  // Syntax highlighting colors (high contrast)
  keyword: '#00ffff',        // Cyan for SQL keywords
  string: '#00ff00',         // Bright green for strings
  comment: '#808080',        // Gray for comments
  number: '#ffff00',         // Yellow for numbers
  operator: '#ff00ff',       // Magenta for operators
  function: '#ff8000',       // Orange for functions
  variable: '#ffffff',       // White for variables
  type: '#80ff80',          // Light green for types
  
  // Error and warning colors (high contrast)
  error: '#ff0000',
  errorBackground: '#330000',
  warning: '#ffff00',
  warningBackground: '#333300',
  info: '#00ffff',
  infoBackground: '#003333',
  
  // UI elements
  border: '#ffffff',
  borderActive: '#ffff00',
  scrollbar: '#333333',
  scrollbarThumb: '#666666',
  scrollbarThumbHover: '#999999',
};

// High contrast syntax highlighting
const highContrastHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: highContrastColors.keyword, fontWeight: 'bold' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: highContrastColors.foreground },
  { tag: [t.function(t.variableName), t.labelName], color: highContrastColors.function, fontWeight: 'bold' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: highContrastColors.variable },
  { tag: [t.definition(t.name), t.separator], color: highContrastColors.foreground },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], 
    color: highContrastColors.type, fontWeight: 'bold' },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], 
    color: highContrastColors.operator, fontWeight: 'bold' },
  { tag: [t.meta, t.comment], color: highContrastColors.comment, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: highContrastColors.info, textDecoration: 'underline', fontWeight: 'bold' },
  { tag: t.heading, fontWeight: 'bold', color: highContrastColors.keyword },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: highContrastColors.variable },
  { tag: [t.processingInstruction, t.string, t.inserted], color: highContrastColors.string, fontWeight: 'bold' },
  { tag: t.invalid, color: highContrastColors.error, fontWeight: 'bold' },
  { tag: t.number, color: highContrastColors.number, fontWeight: 'bold' },
]);

// High contrast theme extension
export const highContrastTheme = EditorView.theme({
  '&': {
    color: highContrastColors.foreground,
    backgroundColor: highContrastColors.background,
    fontFamily: '"Lucida Console", "Courier New", monospace',
    fontSize: '14px', // Larger font for accessibility
    lineHeight: '1.6', // Increased line height for readability
  },

  '.cm-content': {
    padding: '12px', // Increased padding
    caretColor: highContrastColors.cursor,
    minHeight: '200px',
  },

  '.cm-focused .cm-content': {
    outline: `3px solid ${highContrastColors.borderActive}`, // Thicker outline
    outlineOffset: '-3px',
  },

  '.cm-editor': {
    border: `2px solid ${highContrastColors.border}`, // Thicker border
    borderRadius: '0', // No border radius for high contrast
  },

  '.cm-focused': {
    outline: 'none',
  },

  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: 'inherit',
  },

  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: highContrastColors.cursor,
    borderLeftWidth: '2px', // Thicker cursor
  },

  '.cm-selectionBackground, .cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: highContrastColors.selectionBackground,
    border: `1px solid ${highContrastColors.selection}`,
  },

  '.cm-panels': {
    backgroundColor: highContrastColors.backgroundSecondary,
    color: highContrastColors.foreground,
    border: `2px solid ${highContrastColors.border}`,
  },

  '.cm-panels.cm-panels-top': {
    borderBottom: `2px solid ${highContrastColors.border}`,
  },

  '.cm-panels.cm-panels-bottom': {
    borderTop: `2px solid ${highContrastColors.border}`,
  },

  '.cm-searchMatch': {
    backgroundColor: highContrastColors.selectionMatch,
    outline: `2px solid ${highContrastColors.selection}`,
  },

  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: highContrastColors.selection,
    color: highContrastColors.foregroundActive,
  },

  '.cm-activeLine': {
    backgroundColor: highContrastColors.activeLine,
    outline: `1px solid ${highContrastColors.border}`,
  },

  '.cm-selectionMatch': {
    backgroundColor: highContrastColors.selectionMatch,
    outline: `1px solid ${highContrastColors.selection}`,
  },

  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: highContrastColors.selectionMatch,
    outline: `2px solid ${highContrastColors.selection}`,
    fontWeight: 'bold',
  },

  '.cm-gutters': {
    backgroundColor: highContrastColors.backgroundSecondary,
    color: highContrastColors.lineNumber,
    border: 'none',
    borderRight: `2px solid ${highContrastColors.border}`,
  },

  '.cm-activeLineGutter': {
    backgroundColor: highContrastColors.activeLine,
    color: highContrastColors.lineNumberActive,
    fontWeight: 'bold',
    outline: `1px solid ${highContrastColors.border}`,
  },

  '.cm-foldPlaceholder': {
    backgroundColor: highContrastColors.backgroundSecondary,
    border: `2px solid ${highContrastColors.border}`,
    color: highContrastColors.foreground,
    borderRadius: '0',
    padding: '2px 6px',
    margin: '0 4px',
    fontWeight: 'bold',
  },

  '.cm-tooltip': {
    border: `2px solid ${highContrastColors.border}`,
    backgroundColor: highContrastColors.background,
    color: highContrastColors.foreground,
    borderRadius: '0',
    boxShadow: 'none',
    fontFamily: '"Tahoma", sans-serif',
    fontSize: '12px',
    fontWeight: 'bold',
  },

  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: highContrastColors.selection,
      color: highContrastColors.foregroundActive,
      outline: `2px solid ${highContrastColors.borderActive}`,
    },
    '& > ul > li': {
      padding: '4px 12px',
      minHeight: '24px',
      display: 'flex',
      alignItems: 'center',
      border: `1px solid ${highContrastColors.border}`,
    },
  },

  '.cm-completionLabel': {
    fontFamily: '"Lucida Console", monospace',
    fontWeight: 'bold',
  },

  '.cm-completionDetail': {
    color: highContrastColors.foregroundSecondary,
    fontStyle: 'italic',
    marginLeft: '12px',
    fontWeight: 'bold',
  },

  '.cm-completionInfo': {
    backgroundColor: highContrastColors.backgroundSecondary,
    border: `2px solid ${highContrastColors.border}`,
    borderRadius: '0',
    padding: '8px 12px',
    maxWidth: '400px',
    fontWeight: 'bold',
  },

  '.cm-diagnostic': {
    padding: '4px 8px',
    borderRadius: '0',
    fontSize: '12px',
    fontFamily: '"Tahoma", sans-serif',
    fontWeight: 'bold',
    border: `2px solid`,
  },

  '.cm-diagnostic-error': {
    borderColor: highContrastColors.error,
    backgroundColor: highContrastColors.errorBackground,
    color: highContrastColors.error,
  },

  '.cm-diagnostic-warning': {
    borderColor: highContrastColors.warning,
    backgroundColor: highContrastColors.warningBackground,
    color: highContrastColors.warning,
  },

  '.cm-diagnostic-info': {
    borderColor: highContrastColors.info,
    backgroundColor: highContrastColors.infoBackground,
    color: highContrastColors.info,
  },

  '.cm-lintRange-error': {
    backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='4'><path d='m0 4 l4 -4 l4 4' stroke='${highContrastColors.error.replace('#', '%23')}' fill='none' stroke-width='2'/></svg>")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'bottom',
  },

  '.cm-lintRange-warning': {
    backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='4'><path d='m0 4 l4 -4 l4 4' stroke='${highContrastColors.warning.replace('#', '%23')}' fill='none' stroke-width='2'/></svg>")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'bottom',
  },

  // High contrast scrollbar styling
  '.cm-scroller::-webkit-scrollbar': {
    width: '20px', // Wider scrollbar
    height: '20px',
  },

  '.cm-scroller::-webkit-scrollbar-track': {
    backgroundColor: highContrastColors.scrollbar,
    border: `2px solid ${highContrastColors.border}`,
  },

  '.cm-scroller::-webkit-scrollbar-thumb': {
    backgroundColor: highContrastColors.scrollbarThumb,
    border: `2px solid ${highContrastColors.border}`,
    borderRadius: '0',
  },

  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    backgroundColor: highContrastColors.scrollbarThumbHover,
  },

  '.cm-scroller::-webkit-scrollbar-corner': {
    backgroundColor: highContrastColors.scrollbar,
    border: `2px solid ${highContrastColors.border}`,
  },

  // High contrast search panel styling
  '.cm-search': {
    backgroundColor: highContrastColors.backgroundSecondary,
    border: `2px solid ${highContrastColors.border}`,
    borderRadius: '0',
    padding: '8px',
  },

  '.cm-search input, .cm-search button, .cm-search label': {
    fontFamily: '"Tahoma", sans-serif',
    fontSize: '12px',
    fontWeight: 'bold',
  },

  '.cm-search input': {
    border: `2px solid ${highContrastColors.border}`,
    padding: '4px 8px',
    backgroundColor: highContrastColors.background,
    color: highContrastColors.foreground,
  },

  '.cm-search input:focus': {
    outline: `3px solid ${highContrastColors.borderActive}`,
    outlineOffset: '2px',
  },

  '.cm-search button': {
    border: `2px solid ${highContrastColors.border}`,
    backgroundColor: highContrastColors.backgroundSecondary,
    color: highContrastColors.foreground,
    padding: '4px 12px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },

  '.cm-search button:hover': {
    backgroundColor: highContrastColors.selectionBackground,
    outline: `2px solid ${highContrastColors.borderActive}`,
  },

  '.cm-search button:focus': {
    outline: `3px solid ${highContrastColors.borderActive}`,
    outlineOffset: '2px',
  },

  '.cm-search button:active': {
    backgroundColor: highContrastColors.selection,
    color: highContrastColors.foregroundActive,
  },
}, { dark: true });

// Combined high contrast theme extension
export const highContrastThemeExtension: Extension = [
  highContrastTheme,
  syntaxHighlighting(highContrastHighlightStyle),
];
