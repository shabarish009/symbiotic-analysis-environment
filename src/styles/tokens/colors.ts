/**
 * Windows XP Luna Theme Color Tokens
 * Based on authentic XP specifications with WCAG AA accessibility adjustments
 */

export const colors = {
  // Primary Luna Blue Colors
  primary: {
    blue: '#3B77BC',
    blueLight: '#4A90E2',
    blueDark: '#0054E3',
    blueAccent: '#316AC5',
  },

  // System Grays
  gray: {
    silver: '#ECE9D8',
    light: '#F0F0F0',
    medium: '#C0C0C0',
    dark: '#808080',
  },

  // Base Colors
  base: {
    white: '#FFFFFF',
    black: '#000000',
  },

  // Desktop & Taskbar
  desktop: {
    background: '#5A7FCA',
    taskbar: '#245EDC',
    taskbarDark: '#1E4FBF',
  },

  // Interactive States
  interactive: {
    selection: '#316AC5',
    hover: '#E6F2FF',
    focus: '#316AC5',
    disabled: '#808080',
  },

  // Accessibility Compliant Text Colors
  text: {
    primary: '#000000',
    onBlue: '#FFFFFF',
    onSilver: '#000000',
    disabled: '#808080',
    link: '#0066CC',
  },

  // Button Colors
  button: {
    face: '#F0F0F0',
    faceDark: '#D8D8D8',
    border: '#C0C0C0',
    borderDark: '#808080',
    borderLight: '#FFFFFF',
  },

  // Window Chrome
  window: {
    activeBorder: '#316AC5',
    inactiveBorder: '#C0C0C0',
    titleBarStart: '#4A90E2',
    titleBarEnd: '#0054E3',
  },

  // Menu Colors
  menu: {
    background: '#F0F0F0',
    bar: '#ECE9D8',
    hover: '#316AC5',
    hoverText: '#FFFFFF',
    separator: '#C0C0C0',
  },

  // Form Controls
  form: {
    background: '#FFFFFF',
    border: '#808080',
    borderLight: '#FFFFFF',
    borderDark: '#404040',
  },

  // Start Menu
  start: {
    leftColumn: '#FFFFFF',
    rightColumnStart: '#4A90E2',
    rightColumnEnd: '#316AC5',
    highlight: '#73B441',
  },

  // Shadow and Effects
  effects: {
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowLight: 'rgba(0, 0, 0, 0.1)',
    highlight: 'rgba(255, 255, 255, 0.8)',
  },
} as const;

export type ColorToken = typeof colors;
