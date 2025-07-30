/**
 * Windows XP 3D Effects Utilities
 * CSS-in-JS utilities for creating authentic XP 3D borders and effects
 */

import { colors } from '../tokens/colors';

export const xpEffects = {
  // 3D Border Effects
  raised3D: {
    boxShadow: `
      1px 1px 0 ${colors.base.white} inset,
      -1px -1px 0 ${colors.gray.dark} inset,
      2px 2px 0 ${colors.gray.medium} inset,
      -2px -2px 0 ${colors.button.borderLight} inset
    `,
  },

  sunken3D: {
    boxShadow: `
      -1px -1px 0 ${colors.base.white} inset,
      1px 1px 0 ${colors.gray.dark} inset,
      -2px -2px 0 ${colors.button.borderLight} inset,
      2px 2px 0 ${colors.gray.medium} inset
    `,
  },

  // Button States
  buttonRaised: {
    background: `linear-gradient(to bottom, ${colors.button.face}, ${colors.button.faceDark})`,
    border: `1px solid ${colors.button.border}`,
    boxShadow: `
      1px 1px 0 ${colors.base.white} inset,
      -1px -1px 0 ${colors.gray.dark} inset
    `,
  },

  buttonPressed: {
    background: `linear-gradient(to bottom, ${colors.button.faceDark}, ${colors.button.face})`,
    border: `1px solid ${colors.button.border}`,
    boxShadow: `
      -1px -1px 0 ${colors.base.white} inset,
      1px 1px 0 ${colors.gray.dark} inset
    `,
  },

  buttonHover: {
    background: `linear-gradient(to bottom, ${colors.interactive.hover}, #D6E8FF)`,
    border: `1px solid ${colors.primary.blueAccent}`,
    boxShadow: `
      1px 1px 0 ${colors.base.white} inset,
      -1px -1px 0 ${colors.primary.blueDark} inset
    `,
  },

  // Window Chrome Effects
  windowBorder: {
    border: `2px solid ${colors.window.activeBorder}`,
    boxShadow: `
      0 0 0 1px ${colors.base.white} inset,
      0 0 0 2px ${colors.gray.medium} inset
    `,
  },

  windowBorderInactive: {
    border: `2px solid ${colors.window.inactiveBorder}`,
    boxShadow: `
      0 0 0 1px ${colors.base.white} inset,
      0 0 0 2px ${colors.gray.medium} inset
    `,
  },

  titleBarGradient: {
    background: `linear-gradient(to bottom, ${colors.window.titleBarStart}, ${colors.window.titleBarEnd})`,
  },

  // Form Control Effects
  textInputSunken: {
    background: colors.form.background,
    border: `2px solid ${colors.form.border}`,
    boxShadow: `
      -1px -1px 0 ${colors.base.white} inset,
      1px 1px 0 ${colors.form.borderDark} inset
    `,
  },

  // Menu Effects
  menuRaised: {
    background: colors.menu.background,
    border: `1px solid ${colors.gray.medium}`,
    boxShadow: `
      1px 1px 0 ${colors.base.white} inset,
      -1px -1px 0 ${colors.gray.dark} inset,
      2px 2px 4px ${colors.effects.shadow}
    `,
  },

  // Desktop Effects
  desktopIcon: {
    filter: 'drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.3))',
  },

  // Focus Indicators (Accessibility)
  focusOutline: {
    outline: `1px dotted ${colors.text.primary}`,
    outlineOffset: '-2px',
  },

  focusRing: {
    boxShadow: `0 0 0 2px ${colors.interactive.focus}`,
    outline: 'none',
  },

  // Taskbar Effects
  taskbarGradient: {
    background: `linear-gradient(to bottom, ${colors.desktop.taskbar}, ${colors.desktop.taskbarDark})`,
  },

  // Start Menu Effects
  startMenuGradient: {
    background: `linear-gradient(to right, ${colors.start.leftColumn} 50%, ${colors.start.rightColumnStart} 50%, ${colors.start.rightColumnEnd})`,
  },

  // Interactive State Effects
  hoverState: {
    background: colors.interactive.hover,
    borderColor: colors.primary.blueAccent,
    transition: 'background-color 0ms, border-color 0ms, color 0ms',
  },

  activeState: {
    transform: 'translateY(1px)',
    transition: 'transform 0ms',
  },

  disabledState: {
    opacity: 0.6,
    cursor: 'not-allowed',
    filter: 'grayscale(0.3)',
  },

  // Animation Effects
  slideDownAnimation: {
    animation: 'xp-slide-down 150ms ease-out',
  },

  fadeInAnimation: {
    animation: 'xp-fade-in 150ms ease-out',
  },

  scaleInAnimation: {
    animation: 'xp-scale-in 200ms ease-out',
  },

  // Loading States
  loadingSpinner: {
    animation: 'xp-spin 1s linear infinite',
  },

  loadingPulse: {
    animation: 'xp-pulse 2s ease-in-out infinite',
  },
} as const;

export type XPEffects = typeof xpEffects;
