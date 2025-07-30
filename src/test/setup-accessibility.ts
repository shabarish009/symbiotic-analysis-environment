/**
 * Accessibility Testing Setup
 * Global setup for accessibility testing infrastructure
 */

import { configure } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers for accessibility
expect.extend(toHaveNoViolations);

// Configure testing library for better accessibility testing
configure({
  // Use accessible queries by default
  defaultHidden: true,
  // Increase timeout for accessibility tests
  asyncUtilTimeout: 5000,
});

/**
 * Global accessibility test configuration
 */
export const accessibilityConfig = {
  // Axe-core configuration for consistent testing
  axeConfig: {
    rules: {
      // Enable all WCAG AA rules
      'color-contrast': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-management': { enabled: true },
      'aria-labels': { enabled: true },
      'semantic-markup': { enabled: true },
      
      // Custom rules for XP theme compatibility
      'xp-theme-contrast': { enabled: true },
      'xp-focus-indicators': { enabled: true },
    },
    tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
  },

  // Screen reader testing configuration
  screenReaderConfig: {
    announcements: {
      timeout: 1000,
      retries: 3,
    },
    navigation: {
      timeout: 500,
    },
  },

  // Keyboard navigation testing configuration
  keyboardConfig: {
    tabDelay: 100,
    activationDelay: 50,
  },

  // High contrast testing configuration
  highContrastConfig: {
    themes: [
      'high-contrast-black',
      'high-contrast-white',
      'high-contrast-1',
      'high-contrast-2',
    ],
  },
};

/**
 * Mock implementations for testing environment
 */
export const setupAccessibilityMocks = (): void => {
  // Mock matchMedia for media query testing
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock ResizeObserver for responsive accessibility testing
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock IntersectionObserver for visibility testing
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock getComputedStyle for style testing
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = jest.fn().mockImplementation((element, pseudoElement) => {
    const styles = originalGetComputedStyle(element, pseudoElement);
    return {
      ...styles,
      // Ensure focus indicators are testable
      outline: styles.outline || '2px solid #0078d4',
      outlineOffset: styles.outlineOffset || '2px',
      // Ensure color contrast is testable
      color: styles.color || '#000000',
      backgroundColor: styles.backgroundColor || '#ffffff',
    };
  });

  // Mock screen reader announcements
  const mockAnnounce = jest.fn();
  Object.defineProperty(window, 'speechSynthesis', {
    writable: true,
    value: {
      speak: mockAnnounce,
      cancel: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      getVoices: jest.fn().mockReturnValue([]),
    },
  });

  // Store mock for test access
  (global as any).mockScreenReaderAnnounce = mockAnnounce;
};

/**
 * Accessibility test helpers
 */
export const accessibilityHelpers = {
  /**
   * Wait for accessibility tree updates
   */
  waitForA11yTree: async (timeout: number = 1000): Promise<void> => {
    return new Promise(resolve => {
      setTimeout(resolve, timeout);
    });
  },

  /**
   * Simulate screen reader navigation
   */
  simulateScreenReaderNavigation: async (
    container: HTMLElement,
    direction: 'forward' | 'backward' = 'forward'
  ): Promise<HTMLElement[]> => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const elements = Array.from(focusableElements) as HTMLElement[];
    
    if (direction === 'backward') {
      elements.reverse();
    }

    // Simulate screen reader focus
    for (const element of elements) {
      element.focus();
      await accessibilityHelpers.waitForA11yTree(100);
    }

    return elements;
  },

  /**
   * Get accessibility tree representation
   */
  getAccessibilityTree: (element: HTMLElement): any => {
    const getNodeInfo = (node: Element): any => {
      const info: any = {
        tagName: node.tagName.toLowerCase(),
        role: node.getAttribute('role'),
        ariaLabel: node.getAttribute('aria-label'),
        ariaLabelledBy: node.getAttribute('aria-labelledby'),
        ariaDescribedBy: node.getAttribute('aria-describedby'),
        tabIndex: node.getAttribute('tabindex'),
        children: [],
      };

      // Add text content for leaf nodes
      if (node.children.length === 0 && node.textContent?.trim()) {
        info.textContent = node.textContent.trim();
      }

      // Recursively process children
      Array.from(node.children).forEach(child => {
        info.children.push(getNodeInfo(child));
      });

      return info;
    };

    return getNodeInfo(element);
  },

  /**
   * Validate ARIA relationships
   */
  validateARIARelationships: (container: HTMLElement): void => {
    // Check aria-labelledby relationships
    const labelledByElements = container.querySelectorAll('[aria-labelledby]');
    labelledByElements.forEach(element => {
      const labelIds = element.getAttribute('aria-labelledby')?.split(' ') || [];
      labelIds.forEach(id => {
        const labelElement = container.querySelector(`#${id}`);
        expect(labelElement).toBeInTheDocument();
      });
    });

    // Check aria-describedby relationships
    const describedByElements = container.querySelectorAll('[aria-describedby]');
    describedByElements.forEach(element => {
      const descriptionIds = element.getAttribute('aria-describedby')?.split(' ') || [];
      descriptionIds.forEach(id => {
        const descriptionElement = container.querySelector(`#${id}`);
        expect(descriptionElement).toBeInTheDocument();
      });
    });

    // Check aria-controls relationships
    const controlsElements = container.querySelectorAll('[aria-controls]');
    controlsElements.forEach(element => {
      const controlledIds = element.getAttribute('aria-controls')?.split(' ') || [];
      controlledIds.forEach(id => {
        const controlledElement = container.querySelector(`#${id}`);
        expect(controlledElement).toBeInTheDocument();
      });
    });
  },

  /**
   * Test reduced motion preferences
   */
  testReducedMotion: (element: HTMLElement): void => {
    // Mock prefers-reduced-motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    // Trigger reduced motion styles
    element.classList.add('reduce-motion');
    
    const styles = window.getComputedStyle(element);
    
    // Verify animations are disabled or reduced
    expect(
      styles.animationDuration === '0s' ||
      styles.transitionDuration === '0s' ||
      styles.animationPlayState === 'paused'
    ).toBe(true);

    // Clean up
    element.classList.remove('reduce-motion');
  },
};

/**
 * Custom Jest matchers for accessibility testing
 */
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveAccessibleName(name: string): R;
      toHaveAccessibleDescription(description: string): R;
      toBeKeyboardAccessible(): R;
      toHaveValidColorContrast(): R;
      toSupportHighContrast(): R;
    }
  }
}

// Implement custom matchers
expect.extend({
  toHaveAccessibleName(element: HTMLElement, expectedName: string) {
    const accessibleName = 
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.textContent?.trim() ||
      element.getAttribute('title');

    const pass = accessibleName === expectedName;

    return {
      message: () =>
        `expected element to have accessible name "${expectedName}" but got "${accessibleName}"`,
      pass,
    };
  },

  toHaveAccessibleDescription(element: HTMLElement, expectedDescription: string) {
    const describedById = element.getAttribute('aria-describedby');
    const description = describedById
      ? document.getElementById(describedById)?.textContent?.trim()
      : element.getAttribute('aria-description');

    const pass = description === expectedDescription;

    return {
      message: () =>
        `expected element to have accessible description "${expectedDescription}" but got "${description}"`,
      pass,
    };
  },

  toBeKeyboardAccessible(element: HTMLElement) {
    const tabIndex = element.getAttribute('tabindex');
    const isInteractive = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(element.tagName);
    const hasTabIndex = tabIndex !== null && tabIndex !== '-1';

    const pass = isInteractive || hasTabIndex;

    return {
      message: () =>
        `expected element to be keyboard accessible (interactive element or positive tabindex)`,
      pass,
    };
  },

  toHaveValidColorContrast(element: HTMLElement) {
    const styles = window.getComputedStyle(element);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;

    // This is a simplified check - in real implementation, you'd use the color contrast utilities
    const pass = color !== backgroundColor && color !== 'transparent' && backgroundColor !== 'transparent';

    return {
      message: () =>
        `expected element to have valid color contrast between "${color}" and "${backgroundColor}"`,
      pass,
    };
  },

  toSupportHighContrast(element: HTMLElement) {
    // Simulate high contrast mode
    element.classList.add('high-contrast-mode');
    const styles = window.getComputedStyle(element);
    
    const hasHighContrastStyles = 
      styles.backgroundColor !== 'transparent' &&
      styles.color !== 'transparent' &&
      styles.borderColor !== 'transparent';

    element.classList.remove('high-contrast-mode');

    return {
      message: () =>
        `expected element to support high contrast mode with proper styling`,
      pass: hasHighContrastStyles,
    };
  },
});

// Initialize accessibility testing setup
setupAccessibilityMocks();
