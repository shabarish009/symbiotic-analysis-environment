/**
 * Windows XP Spacing and Layout Tokens
 * Based on authentic XP measurements and proportions
 */

export const spacing = {
  // Base spacing units
  px: '1px',
  0: '0',
  1: '2px',
  2: '4px',
  3: '6px',
  4: '8px',
  5: '12px',
  6: '16px',
  7: '20px',
  8: '24px',
  9: '28px',
  10: '32px',

  // Component-specific spacing
  button: {
    paddingX: '12px',
    paddingY: '6px',
    gap: '8px',
  },

  window: {
    titleBarHeight: '30px',
    borderWidth: '2px',
    padding: '8px',
  },

  taskbar: {
    height: '30px',
    padding: '4px',
  },

  menu: {
    height: '24px',
    itemPadding: '8px 12px',
    separatorHeight: '1px',
  },

  form: {
    controlHeight: '24px',
    controlPadding: '4px',
    labelGap: '4px',
    groupGap: '12px',
  },

  desktop: {
    iconSize: '32px',
    iconSpacing: '32px',
  },

  startMenu: {
    width: '300px',
    itemHeight: '32px',
    padding: '8px',
  },
} as const;

export type SpacingToken = typeof spacing;
