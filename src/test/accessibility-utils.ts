/**
 * Accessibility Testing Utilities
 * Comprehensive utilities for WCAG AA compliance testing
 */

import { render, RenderResult } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

/**
 * Color contrast validation utilities
 */
export const colorContrastUtils = {
  /**
   * Calculate contrast ratio between two colors
   */
  calculateContrastRatio(color1: string, color2: string): number {
    const getLuminance = (color: string): number => {
      // Convert hex to RGB
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;

      // Calculate relative luminance
      const sRGB = [r, g, b].map(c => {
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });

      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    };

    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);

    return (brightest + 0.05) / (darkest + 0.05);
  },

  /**
   * Validate WCAG AA color contrast requirements
   */
  validateWCAGContrast(
    foreground: string,
    background: string,
    isLargeText: boolean = false
  ): { isValid: boolean; ratio: number; required: number } {
    const ratio = this.calculateContrastRatio(foreground, background);
    const required = isLargeText ? 3.0 : 4.5;
    
    return {
      isValid: ratio >= required,
      ratio,
      required,
    };
  },

  /**
   * Extract colors from computed styles
   */
  extractColorsFromElement(element: HTMLElement): {
    color: string;
    backgroundColor: string;
  } {
    const styles = window.getComputedStyle(element);
    return {
      color: styles.color,
      backgroundColor: styles.backgroundColor,
    };
  },
};

/**
 * Keyboard navigation testing utilities
 */
export const keyboardTestUtils = {
  /**
   * Test tab navigation through elements
   */
  async testTabNavigation(
    container: HTMLElement,
    expectedOrder: string[]
  ): Promise<void> {
    const user = userEvent.setup();
    
    // Focus first element
    const firstElement = container.querySelector('[tabindex="0"], button, input, select, textarea, a[href]') as HTMLElement;
    if (firstElement) {
      firstElement.focus();
    }

    // Test tab order
    for (let i = 0; i < expectedOrder.length; i++) {
      const currentElement = document.activeElement as HTMLElement;
      const expectedSelector = expectedOrder[i];
      
      expect(currentElement).toMatchSelector(expectedSelector);
      
      if (i < expectedOrder.length - 1) {
        await user.tab();
      }
    }
  },

  /**
   * Test keyboard activation (Enter/Space)
   */
  async testKeyboardActivation(
    element: HTMLElement,
    callback: jest.Mock
  ): Promise<void> {
    const user = userEvent.setup();
    
    element.focus();
    
    // Test Enter key
    await user.keyboard('{Enter}');
    expect(callback).toHaveBeenCalled();
    
    callback.mockClear();
    
    // Test Space key
    await user.keyboard(' ');
    expect(callback).toHaveBeenCalled();
  },

  /**
   * Test escape key handling
   */
  async testEscapeKey(
    element: HTMLElement,
    callback: jest.Mock
  ): Promise<void> {
    const user = userEvent.setup();
    
    element.focus();
    await user.keyboard('{Escape}');
    expect(callback).toHaveBeenCalled();
  },
};

/**
 * Screen reader testing utilities
 */
export const screenReaderTestUtils = {
  /**
   * Validate ARIA attributes
   */
  validateARIAAttributes(element: HTMLElement, expectedAttributes: Record<string, string>): void {
    Object.entries(expectedAttributes).forEach(([attr, value]) => {
      expect(element).toHaveAttribute(attr, value);
    });
  },

  /**
   * Test live region announcements
   */
  testLiveRegion(element: HTMLElement, expectedText: string): void {
    const liveRegion = element.querySelector('[aria-live]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent(expectedText);
  },

  /**
   * Validate semantic structure
   */
  validateSemanticStructure(container: HTMLElement): void {
    // Check for proper heading hierarchy
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      if (previousLevel > 0) {
        expect(level).toBeLessThanOrEqual(previousLevel + 1);
      }
      previousLevel = level;
    });

    // Check for landmarks (skip for menu components as they don't require landmarks)
    const landmarks = container.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]');
    const menuComponents = container.querySelectorAll('[role="menu"], [role="menubar"]');

    // Only require landmarks if this isn't a menu component
    if (menuComponents.length === 0) {
      expect(landmarks.length).toBeGreaterThan(0);
    }
  },
};

/**
 * Focus management testing utilities
 */
export const focusTestUtils = {
  /**
   * Test focus trapping in modals
   */
  async testFocusTrapping(
    modal: HTMLElement,
    expectedFocusableElements: string[]
  ): Promise<void> {
    const user = userEvent.setup();
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    expect(focusableElements.length).toBe(expectedFocusableElements.length);

    // Test forward tab cycling
    for (let i = 0; i < focusableElements.length; i++) {
      const currentElement = document.activeElement;
      expect(currentElement).toBe(focusableElements[i]);
      await user.tab();
    }

    // Should cycle back to first element
    expect(document.activeElement).toBe(focusableElements[0]);

    // Test backward tab cycling
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(focusableElements[focusableElements.length - 1]);
  },

  /**
   * Test focus restoration
   */
  testFocusRestoration(
    triggerElement: HTMLElement,
    modalElement: HTMLElement
  ): void {
    // Store initial focus
    triggerElement.focus();
    const initialFocus = document.activeElement;

    // Simulate modal opening and closing
    modalElement.style.display = 'block';
    const firstFocusable = modalElement.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') as HTMLElement;
    firstFocusable?.focus();

    // Simulate modal closing
    modalElement.style.display = 'none';
    triggerElement.focus();

    expect(document.activeElement).toBe(initialFocus);
  },

  /**
   * Validate focus indicators
   */
  validateFocusIndicators(element: HTMLElement): void {
    element.focus();
    const styles = window.getComputedStyle(element, ':focus');
    
    // Check for visible focus indicator
    const hasOutline = styles.outline !== 'none' && styles.outline !== '';
    const hasBoxShadow = styles.boxShadow !== 'none' && styles.boxShadow !== '';
    const hasBorder = styles.borderColor !== styles.borderColor; // Changed on focus
    
    expect(hasOutline || hasBoxShadow || hasBorder).toBe(true);
  },
};

/**
 * High contrast testing utilities
 */
export const highContrastTestUtils = {
  /**
   * Simulate high contrast mode
   */
  simulateHighContrastMode(): void {
    // Add high contrast media query simulation
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  },

  /**
   * Test high contrast compatibility
   */
  testHighContrastCompatibility(element: HTMLElement): void {
    this.simulateHighContrastMode();
    
    // Trigger high contrast styles
    element.classList.add('high-contrast-mode');
    
    const styles = window.getComputedStyle(element);
    
    // Verify high contrast styles are applied
    expect(styles.backgroundColor).not.toBe('transparent');
    expect(styles.color).not.toBe('transparent');
    
    // Clean up
    element.classList.remove('high-contrast-mode');
  },
};

/**
 * Comprehensive accessibility test suite
 */
export const a11yTestSuite = {
  /**
   * Run complete accessibility audit
   */
  async runCompleteAudit(
    renderResult: RenderResult,
    options: {
      skipColorContrast?: boolean;
      skipKeyboardNav?: boolean;
      skipScreenReader?: boolean;
      skipFocusManagement?: boolean;
    } = {}
  ): Promise<void> {
    const { container } = renderResult;

    // 1. Run axe-core automated tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // 2. Test color contrast (if not skipped)
    if (!options.skipColorContrast) {
      const textElements = container.querySelectorAll('p, span, div, button, input, label');
      textElements.forEach(element => {
        const colors = colorContrastUtils.extractColorsFromElement(element as HTMLElement);
        if (colors.color && colors.backgroundColor) {
          const validation = colorContrastUtils.validateWCAGContrast(
            colors.color,
            colors.backgroundColor
          );
          expect(validation.isValid).toBe(true);
        }
      });
    }

    // 3. Validate semantic structure (if not skipped)
    if (!options.skipScreenReader) {
      screenReaderTestUtils.validateSemanticStructure(container);
    }

    // 4. Test focus indicators (if not skipped)
    if (!options.skipFocusManagement) {
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusableElements.forEach(element => {
        focusTestUtils.validateFocusIndicators(element as HTMLElement);
      });
    }

    // 5. Test high contrast compatibility
    highContrastTestUtils.testHighContrastCompatibility(container);
  },
};
