/**
 * Windows XP Theme Provider
 * Provides XP theme context and CSS custom properties
 */

import React, {
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useEffect,
} from 'react';
import { xpTheme, type XPTheme } from '../tokens';
import { XP_ANIMATION_CSS_VARS } from '../utils/animations';

interface XPThemeContextType {
  theme: XPTheme;
}

const XPThemeContext = createContext<XPThemeContextType | undefined>(undefined);

interface XPThemeProviderProps {
  children: ReactNode;
}

export const XPThemeProvider: React.FC<XPThemeProviderProps> = ({
  children,
}) => {
  // Memoize CSS custom properties injection for performance
  const cssProperties = useMemo(() => {
    const properties: Record<string, string> = {};

    // Colors
    Object.entries(xpTheme.colors.primary).forEach(([key, value]) => {
      properties[`--xp-color-primary-${key}`] = value as string;
    });

    Object.entries(xpTheme.colors.gray).forEach(([key, value]) => {
      properties[`--xp-color-gray-${key}`] = value as string;
    });

    Object.entries(xpTheme.colors.base).forEach(([key, value]) => {
      properties[`--xp-color-base-${key}`] = value as string;
    });

    Object.entries(xpTheme.colors.text).forEach(([key, value]) => {
      properties[`--xp-color-text-${key}`] = value as string;
    });

    // Typography
    Object.entries(xpTheme.typography.fontFamily).forEach(([key, value]) => {
      properties[`--xp-font-family-${key}`] = value as string;
    });

    Object.entries(xpTheme.typography.fontSize).forEach(([key, value]) => {
      properties[`--xp-font-size-${key}`] = value as string;
    });

    // Spacing
    Object.entries(xpTheme.spacing).forEach(([key, value]) => {
      if (typeof value === 'string') {
        properties[`--xp-spacing-${key}`] = value;
      }
    });

    // Animation variables
    Object.entries(XP_ANIMATION_CSS_VARS).forEach(([key, value]) => {
      properties[key] = value;
    });

    return properties;
  }, []);

  // Inject CSS custom properties
  useEffect(() => {
    const root = document.documentElement;

    // Apply all CSS custom properties
    Object.entries(cssProperties).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Set base font on body
    document.body.style.fontFamily = xpTheme.typography.fontFamily.ui;
    document.body.style.fontSize = xpTheme.typography.fontSize.normal;
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.backgroundColor = xpTheme.colors.desktop.background;
    document.body.style.color = xpTheme.colors.text.primary;

    // Prevent text selection on UI elements (XP behavior)
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    return () => {
      // Cleanup CSS properties on unmount
      Object.keys(cssProperties).forEach(property => {
        root.style.removeProperty(property);
      });
    };
  }, [cssProperties]);

  const contextValue: XPThemeContextType = {
    theme: xpTheme,
  };

  return (
    <XPThemeContext.Provider value={contextValue}>
      {children}
    </XPThemeContext.Provider>
  );
};

export const useXPTheme = (): XPThemeContextType => {
  const context = useContext(XPThemeContext);
  if (context === undefined) {
    throw new Error('useXPTheme must be used within an XPThemeProvider');
  }
  return context;
};
