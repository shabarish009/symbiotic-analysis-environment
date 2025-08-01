import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Windows XP Luna color palette
const xpColors = {
  // Background colors
  background: '#ffffff',
  backgroundSecondary: '#f0f0f0',
  backgroundActive: '#316ac5',
  
  // Text colors
  foreground: '#000000',
  foregroundSecondary: '#666666',
  foregroundActive: '#ffffff',
  
  // Selection colors
  selection: '#316ac5',
  selectionBackground: '#c1d2ee',
  selectionMatch: '#b4d5ff',
  
  // Line colors
  lineNumber: '#999999',
  lineNumberActive: '#000000',
  activeLine: '#f5f5f5',
  
  // Cursor
  cursor: '#000000',
  
  // Syntax highlighting colors (XP-inspired)
  keyword: '#0000ff',        // Blue for SQL keywords
  string: '#008000',         // Green for strings
  comment: '#808080',        // Gray for comments
  number: '#ff0000',         // Red for numbers
  operator: '#000080',       // Dark blue for operators
  function: '#800080',       // Purple for functions
  variable: '#000000',       // Black for variables
  type: '#2b91af',          // Teal for types
  
  // Error and warning colors
  error: '#ff0000',
  errorBackground: '#ffebee',
  warning: '#ff8c00',
  warningBackground: '#fff3e0',
  info: '#0066cc',
  infoBackground: '#e3f2fd',
  
  // UI elements
  border: '#c0c0c0',
  borderActive: '#316ac5',
  scrollbar: '#d4d0c8',
  scrollbarThumb: '#aca899',
  scrollbarThumbHover: '#999999',
};

// XP-style syntax highlighting
const xpHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: xpColors.keyword, fontWeight: 'bold' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: xpColors.foreground },
  { tag: [t.function(t.variableName), t.labelName], color: xpColors.function, fontWeight: 'bold' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: xpColors.variable },
  { tag: [t.definition(t.name), t.separator], color: xpColors.foreground },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], 
    color: xpColors.type, fontWeight: 'bold' },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], 
    color: xpColors.operator },
  { tag: [t.meta, t.comment], color: xpColors.comment, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: xpColors.info, textDecoration: 'underline' },
  { tag: t.heading, fontWeight: 'bold', color: xpColors.keyword },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: xpColors.variable },
  { tag: [t.processingInstruction, t.string, t.inserted], color: xpColors.string },
  { tag: t.invalid, color: xpColors.error, fontWeight: 'bold' },
  { tag: t.number, color: xpColors.number },
]);

// XP theme extension
export const xpTheme = EditorView.theme({
  '&': {
    color: xpColors.foreground,
    backgroundColor: xpColors.background,
    fontFamily: '"Lucida Console", "Courier New", monospace',
    fontSize: '12px',
    lineHeight: '1.4',
  },

  '.cm-content': {
    padding: '8px',
    caretColor: xpColors.cursor,
    minHeight: '200px',
  },

  '.cm-focused .cm-content': {
    outline: `2px solid ${xpColors.borderActive}`,
    outlineOffset: '-2px',
  },

  '.cm-editor': {
    border: `1px inset ${xpColors.border}`,
    borderRadius: '2px',
  },

  '.cm-focused': {
    outline: 'none',
  },

  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: 'inherit',
  },

  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: xpColors.cursor,
    borderLeftWidth: '1px',
  },

  '.cm-selectionBackground, .cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: xpColors.selectionBackground,
  },

  '.cm-panels': {
    backgroundColor: xpColors.backgroundSecondary,
    color: xpColors.foreground,
    border: `1px solid ${xpColors.border}`,
  },

  '.cm-panels.cm-panels-top': {
    borderBottom: `1px solid ${xpColors.border}`,
  },

  '.cm-panels.cm-panels-bottom': {
    borderTop: `1px solid ${xpColors.border}`,
  },

  '.cm-searchMatch': {
    backgroundColor: xpColors.selectionMatch,
    outline: `1px solid ${xpColors.selection}`,
  },

  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: xpColors.selection,
    color: xpColors.foregroundActive,
  },

  '.cm-activeLine': {
    backgroundColor: xpColors.activeLine,
  },

  '.cm-selectionMatch': {
    backgroundColor: xpColors.selectionMatch,
  },

  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: xpColors.selectionMatch,
    outline: `1px solid ${xpColors.selection}`,
  },

  '.cm-gutters': {
    backgroundColor: xpColors.backgroundSecondary,
    color: xpColors.lineNumber,
    border: 'none',
    borderRight: `1px solid ${xpColors.border}`,
  },

  '.cm-activeLineGutter': {
    backgroundColor: xpColors.activeLine,
    color: xpColors.lineNumberActive,
    fontWeight: 'bold',
  },

  '.cm-foldPlaceholder': {
    backgroundColor: xpColors.backgroundSecondary,
    border: `1px solid ${xpColors.border}`,
    color: xpColors.foregroundSecondary,
    borderRadius: '2px',
    padding: '0 4px',
    margin: '0 2px',
  },

  '.cm-tooltip': {
    border: `1px solid ${xpColors.border}`,
    backgroundColor: xpColors.background,
    color: xpColors.foreground,
    borderRadius: '2px',
    boxShadow: '2px 2px 4px rgba(0,0,0,0.2)',
    fontFamily: '"Tahoma", sans-serif',
    fontSize: '11px',
  },

  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: xpColors.selection,
      color: xpColors.foregroundActive,
    },
    '& > ul > li': {
      padding: '2px 8px',
      minHeight: '18px',
      display: 'flex',
      alignItems: 'center',
    },
  },

  '.cm-completionLabel': {
    fontFamily: '"Lucida Console", monospace',
  },

  '.cm-completionDetail': {
    color: xpColors.foregroundSecondary,
    fontStyle: 'italic',
    marginLeft: '8px',
  },

  '.cm-completionInfo': {
    backgroundColor: xpColors.backgroundSecondary,
    border: `1px solid ${xpColors.border}`,
    borderRadius: '2px',
    padding: '4px 8px',
    maxWidth: '300px',
  },

  '.cm-diagnostic': {
    padding: '2px 4px',
    borderRadius: '2px',
    fontSize: '11px',
    fontFamily: '"Tahoma", sans-serif',
  },

  '.cm-diagnostic-error': {
    borderLeft: `3px solid ${xpColors.error}`,
    backgroundColor: xpColors.errorBackground,
  },

  '.cm-diagnostic-warning': {
    borderLeft: `3px solid ${xpColors.warning}`,
    backgroundColor: xpColors.warningBackground,
  },

  '.cm-diagnostic-info': {
    borderLeft: `3px solid ${xpColors.info}`,
    backgroundColor: xpColors.infoBackground,
  },

  '.cm-lintRange-error': {
    backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'><path d='m0 3 l3 -3 l3 3' stroke='${xpColors.error.replace('#', '%23')}' fill='none' stroke-width='1'/></svg>")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'bottom',
  },

  '.cm-lintRange-warning': {
    backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'><path d='m0 3 l3 -3 l3 3' stroke='${xpColors.warning.replace('#', '%23')}' fill='none' stroke-width='1'/></svg>")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'bottom',
  },

  // Enhanced XP-authentic scrollbar styling
  '.cm-scroller::-webkit-scrollbar': {
    width: '17px', // Slightly wider for more authentic XP feel
    height: '17px',
  },

  '.cm-scroller::-webkit-scrollbar-track': {
    backgroundColor: xpColors.scrollbar,
    border: `1px inset ${xpColors.border}`,
    // Add XP-style track pattern
    backgroundImage: 'linear-gradient(45deg, transparent 25%, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.05) 50%, transparent 50%, transparent 75%, rgba(0,0,0,0.05) 75%)',
    backgroundSize: '4px 4px',
  },

  '.cm-scroller::-webkit-scrollbar-thumb': {
    backgroundColor: xpColors.scrollbarThumb,
    border: `1px outset ${xpColors.border}`,
    borderRadius: '0',
    // Add XP-style gradient for more authentic look
    backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 50%, rgba(0,0,0,0.1) 100%)',
    minHeight: '20px', // Ensure minimum thumb size
  },

  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    backgroundColor: xpColors.scrollbarThumbHover,
    backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.2) 50%, rgba(0,0,0,0.05) 100%)',
  },

  '.cm-scroller::-webkit-scrollbar-thumb:active': {
    backgroundColor: xpColors.selection,
    backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.3) 100%)',
  },

  '.cm-scroller::-webkit-scrollbar-corner': {
    backgroundColor: xpColors.scrollbar,
    border: `1px inset ${xpColors.border}`,
  },

  // XP-style scrollbar buttons (arrows)
  '.cm-scroller::-webkit-scrollbar-button': {
    backgroundColor: xpColors.scrollbarThumb,
    border: `1px outset ${xpColors.border}`,
    height: '17px',
    width: '17px',
  },

  '.cm-scroller::-webkit-scrollbar-button:hover': {
    backgroundColor: xpColors.scrollbarThumbHover,
  },

  // Search panel styling
  '.cm-search': {
    backgroundColor: xpColors.backgroundSecondary,
    border: `1px solid ${xpColors.border}`,
    borderRadius: '2px',
    padding: '4px',
  },

  '.cm-search input, .cm-search button, .cm-search label': {
    fontFamily: '"Tahoma", sans-serif',
    fontSize: '11px',
  },

  '.cm-search input': {
    border: `1px inset ${xpColors.border}`,
    padding: '2px 4px',
    backgroundColor: xpColors.background,
  },

  '.cm-search button': {
    border: `1px outset ${xpColors.border}`,
    backgroundColor: xpColors.backgroundSecondary,
    padding: '2px 8px',
    cursor: 'pointer',
  },

  '.cm-search button:hover': {
    backgroundColor: xpColors.selectionBackground,
  },

  '.cm-search button:active': {
    border: `1px inset ${xpColors.border}`,
  },
}, { dark: false });

// Combined XP theme extension
export const xpThemeExtension: Extension = [
  xpTheme,
  syntaxHighlighting(xpHighlightStyle),
];
