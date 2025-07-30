/**
 * Windows XP Typography Tokens
 * Authentic XP font specifications
 */

export const typography = {
  // Font Families
  fontFamily: {
    ui: "'Tahoma', 'Segoe UI', 'Arial', sans-serif",
    mono: "'Lucida Console', 'Courier New', monospace",
  },

  // Font Sizes (XP used 8pt as standard)
  fontSize: {
    small: '10.67px', // 8pt
    normal: '10.67px', // 8pt
    large: '12px', // 9pt
    title: '14.67px', // 11pt
  },

  // Font Weights
  fontWeight: {
    normal: 400,
    bold: 700,
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },

  // Letter Spacing
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
  },
} as const;

export type TypographyToken = typeof typography;
