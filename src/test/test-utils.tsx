/**
 * Test Utilities for XP Components
 * Custom render function with XP theme provider and common test helpers
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { XPThemeProvider } from '../styles/themes/XPThemeProvider';

// Custom render function that includes XP theme provider
const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <XPThemeProvider>{children}</XPThemeProvider>;
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything from React Testing Library
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Common test helpers
export const testHelpers = {
  // Check if element has XP 3D border styling
  hasRaised3DBorder: (element: HTMLElement): boolean => {
    const styles = window.getComputedStyle(element);
    return styles.boxShadow.includes('inset');
  },

  // Check if element has proper focus styling
  hasFocusStyles: (element: HTMLElement): boolean => {
    const styles = window.getComputedStyle(element);
    return styles.outline !== 'none' || styles.boxShadow.includes('0 0 0');
  },

  // Check if text has sufficient contrast
  hasGoodContrast: (element: HTMLElement): boolean => {
    const styles = window.getComputedStyle(element);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;

    // This is a simplified check - in real implementation,
    // you'd use a proper contrast ratio calculation
    return color !== backgroundColor;
  },

  // Simulate keyboard navigation
  simulateKeyboardNavigation: async (element: HTMLElement, key: string) => {
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.keyDown(element, { key, code: key });
  },

  // Check if element is accessible
  isAccessible: (element: HTMLElement): boolean => {
    // Check for basic accessibility attributes
    const hasAriaLabel = element.hasAttribute('aria-label');
    const hasAriaLabelledBy = element.hasAttribute('aria-labelledby');
    const hasTitle = element.hasAttribute('title');
    const hasAltText = element.hasAttribute('alt');
    const isButton = element.tagName === 'BUTTON';
    const isLink = element.tagName === 'A';
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);

    // Interactive elements should have accessible names
    if (isButton || isLink || isInput) {
      return (
        hasAriaLabel ||
        hasAriaLabelledBy ||
        hasTitle ||
        hasAltText ||
        element.textContent !== ''
      );
    }

    return true;
  },
};

// Mock Tauri API for tests
export const mockTauriApi = {
  invoke: vi.fn(),
  listen: vi.fn(),
  emit: vi.fn(),
};

// Setup function for component tests
export const setupComponentTest = () => {
  // Reset all mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    mockTauriApi.invoke.mockClear();
    mockTauriApi.listen.mockClear();
    mockTauriApi.emit.mockClear();
  });

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};
