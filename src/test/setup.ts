import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers for accessibility
expect.extend(toHaveNoViolations);

// TypeScript declarations for custom matchers
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toMatchSelector(selector: string): any;
    }
  }
}

// Mock Tauri API for testing
const mockInvoke = vi.fn();
const mockTauri = {
  core: {
    invoke: mockInvoke,
  },
};

// @ts-expect-error - Global Tauri mock for testing
global.__TAURI__ = mockTauri;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock getComputedStyle for accessibility testing (JSDOM doesn't implement this)
window.getComputedStyle = vi.fn().mockImplementation((element: Element, pseudoElement?: string | null) => {
  // Create a comprehensive mock of CSSStyleDeclaration
  const mockStyles: Partial<CSSStyleDeclaration> = {
    // Focus indicators
    outline: '2px solid #0078d4',
    outlineOffset: '2px',
    outlineColor: '#0078d4',
    outlineStyle: 'solid',
    outlineWidth: '2px',

    // Colors for contrast testing
    color: '#000000',
    backgroundColor: '#ffffff',
    borderColor: '#cccccc',

    // Box shadow for focus indicators
    boxShadow: '0 0 0 2px #0078d4',

    // Animation properties for reduced motion testing
    animationDuration: '0.3s',
    animationPlayState: 'running',
    transitionDuration: '0.3s',

    // Layout properties
    display: 'block',
    position: 'static',
    width: '100px',
    height: '100px',

    // Text properties
    fontSize: '16px',
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'normal',
    lineHeight: '1.5',

    // Accessibility properties
    visibility: 'visible',
    opacity: '1',

    // Method to get property value
    getPropertyValue: vi.fn().mockImplementation((property: string) => {
      return (mockStyles as any)[property] || '';
    }),
  };

  // Handle pseudo-element specific styles
  if (pseudoElement === ':focus') {
    mockStyles.outline = '2px solid #0078d4';
    mockStyles.outlineOffset = '2px';
    mockStyles.boxShadow = '0 0 0 2px #0078d4';
  }

  // Handle focused elements (check if element is currently focused)
  if (element === document.activeElement) {
    mockStyles.outline = '2px solid #0078d4';
    mockStyles.outlineOffset = '2px';
    mockStyles.boxShadow = '0 0 0 2px #0078d4';
  }

  // Handle reduced motion (check if element has reduce-motion class)
  if (element.classList && element.classList.contains('reduce-motion')) {
    mockStyles.animationDuration = '0s';
    mockStyles.transitionDuration = '0s';
    mockStyles.animationPlayState = 'paused';
  }

  return mockStyles as CSSStyleDeclaration;
});

// Add custom accessibility matchers
expect.extend({
  toMatchSelector(element: HTMLElement, selector: string) {
    const pass = element.matches(selector);

    return {
      message: () =>
        pass
          ? `expected element not to match selector "${selector}"`
          : `expected element to match selector "${selector}"`,
      pass,
    };
  },
});

// Reset mocks before each test
beforeEach(() => {
  mockInvoke.mockClear();
});

export { mockInvoke };
