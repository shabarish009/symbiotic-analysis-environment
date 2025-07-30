/**
 * Accessibility Utilities for Windows XP Components
 * WCAG AA compliance helpers and utilities
 */

import { colors } from '../tokens/colors';

export const accessibility = {
  // Screen Reader Only Content
  srOnly: {
    position: 'absolute' as const,
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap' as const,
    border: '0',
  },

  // Focus Management
  focusVisible: {
    '&:focus-visible': {
      outline: `2px solid ${colors.interactive.focus}`,
      outlineOffset: '2px',
    },
  },

  // High Contrast Support
  highContrast: {
    '@media (prefers-contrast: high)': {
      borderColor: 'ButtonText',
      color: 'ButtonText',
      backgroundColor: 'ButtonFace',
    },
  },

  // Reduced Motion Support
  reducedMotion: {
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      animation: 'none',
    },
  },

  // Color Contrast Utilities
  contrastText: {
    onLight: colors.text.primary,
    onDark: colors.text.onBlue,
    onBlue: colors.text.onBlue,
    onSilver: colors.text.onSilver,
  },

  // Keyboard Navigation
  keyboardFocusable: {
    '&:focus': {
      outline: `1px dotted ${colors.text.primary}`,
      outlineOffset: '-2px',
    },
    '&:focus:not(:focus-visible)': {
      outline: 'none',
    },
  },

  // Skip Links
  skipLink: {
    position: 'absolute' as const,
    top: '-40px',
    left: '6px',
    background: colors.base.white,
    color: colors.text.primary,
    padding: '8px',
    textDecoration: 'none',
    zIndex: 1000,
    border: `1px solid ${colors.gray.medium}`,
    '&:focus': {
      top: '6px',
    },
  },

  // ARIA Live Regions
  liveRegion: {
    position: 'absolute' as const,
    left: '-10000px',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
  },
} as const;

// Utility functions for accessibility
export const a11yUtils = {
  // Check if element should be focusable
  isFocusable: (element: HTMLElement): boolean => {
    return (
      element.tabIndex >= 0 &&
      !element.hasAttribute('disabled') &&
      !element.hasAttribute('aria-disabled')
    );
  },

  // Generate unique IDs for ARIA relationships
  generateId: (prefix: string = 'xp'): string => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Announce to screen readers
  announce: (
    message: string,
    priority: 'polite' | 'assertive' = 'polite'
  ): void => {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.textContent = message;

    document.body.appendChild(announcer);

    setTimeout(() => {
      document.body.removeChild(announcer);
    }, 1000);
  },

  // Trap focus within an element
  trapFocus: (element: HTMLElement): (() => void) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            lastFocusable.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            firstFocusable.focus();
            e.preventDefault();
          }
        }
      }
    };

    element.addEventListener('keydown', handleTabKey);
    firstFocusable?.focus();

    return () => {
      element.removeEventListener('keydown', handleTabKey);
    };
  },
};

export type AccessibilityUtils = typeof accessibility;
