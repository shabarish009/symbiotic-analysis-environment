/**
 * Windows XP Design Tokens
 * Centralized export of all design tokens
 */

import { colors, type ColorToken } from './colors';
import { typography, type TypographyToken } from './typography';
import { spacing, type SpacingToken } from './spacing';

export { colors, type ColorToken };
export { typography, type TypographyToken };
export { spacing, type SpacingToken };

// Combined theme object
export const xpTheme = {
  colors,
  typography,
  spacing,
} as const;

export type XPTheme = typeof xpTheme;
