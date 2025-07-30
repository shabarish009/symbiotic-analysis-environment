/**
 * Window Accessibility Utilities
 * Handles accessibility features for window management
 */

import { WindowState } from '../components/Shell/types';

export interface AccessibilityAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
  delay?: number;
}

/**
 * Screen reader announcements for window operations
 */
export const createWindowAnnouncements = {
  windowOpened: (title: string): AccessibilityAnnouncement => ({
    message: `Window opened: ${title}`,
    priority: 'polite',
  }),

  windowClosed: (title: string): AccessibilityAnnouncement => ({
    message: `Window closed: ${title}`,
    priority: 'polite',
  }),

  windowMinimized: (title: string): AccessibilityAnnouncement => ({
    message: `Window minimized: ${title}`,
    priority: 'polite',
  }),

  windowMaximized: (title: string): AccessibilityAnnouncement => ({
    message: `Window maximized: ${title}`,
    priority: 'polite',
  }),

  windowRestored: (title: string): AccessibilityAnnouncement => ({
    message: `Window restored: ${title}`,
    priority: 'polite',
  }),

  windowFocused: (title: string): AccessibilityAnnouncement => ({
    message: `Focused window: ${title}`,
    priority: 'polite',
    delay: 500, // Delay to avoid too many announcements during Alt+Tab
  }),

  windowMoved: (title: string): AccessibilityAnnouncement => ({
    message: `Window moved: ${title}`,
    priority: 'polite',
  }),

  windowResized: (title: string): AccessibilityAnnouncement => ({
    message: `Window resized: ${title}`,
    priority: 'polite',
  }),

  windowsCascaded: (count: number): AccessibilityAnnouncement => ({
    message: `${count} windows arranged in cascade`,
    priority: 'polite',
  }),

  windowsTiledHorizontally: (count: number): AccessibilityAnnouncement => ({
    message: `${count} windows tiled horizontally`,
    priority: 'polite',
  }),

  windowsTiledVertically: (count: number): AccessibilityAnnouncement => ({
    message: `${count} windows tiled vertically`,
    priority: 'polite',
  }),

  allWindowsMinimized: (): AccessibilityAnnouncement => ({
    message: 'All windows minimized',
    priority: 'polite',
  }),
};

/**
 * Focus management utilities
 */
export class WindowFocusManager {
  private static instance: WindowFocusManager;
  private focusHistory: string[] = [];
  private maxHistorySize = 10;

  private constructor() {}

  static getInstance(): WindowFocusManager {
    if (!WindowFocusManager.instance) {
      WindowFocusManager.instance = new WindowFocusManager();
    }
    return WindowFocusManager.instance;
  }

  /**
   * Record window focus for history tracking
   */
  recordFocus(windowId: string): void {
    // Remove existing entry if present
    this.focusHistory = this.focusHistory.filter(id => id !== windowId);
    
    // Add to front of history
    this.focusHistory.unshift(windowId);
    
    // Limit history size
    if (this.focusHistory.length > this.maxHistorySize) {
      this.focusHistory = this.focusHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get previously focused window
   */
  getPreviousFocus(currentWindowId: string): string | null {
    const currentIndex = this.focusHistory.indexOf(currentWindowId);
    if (currentIndex > 0) {
      return this.focusHistory[currentIndex + 1];
    }
    return this.focusHistory.length > 1 ? this.focusHistory[1] : null;
  }

  /**
   * Remove window from focus history
   */
  removeFromHistory(windowId: string): void {
    this.focusHistory = this.focusHistory.filter(id => id !== windowId);
  }

  /**
   * Clear focus history
   */
  clearHistory(): void {
    this.focusHistory = [];
  }

  /**
   * Get focus history
   */
  getFocusHistory(): string[] {
    return [...this.focusHistory];
  }
}

/**
 * Keyboard navigation utilities
 */
export const keyboardNavigation = {
  /**
   * Get focusable elements within a window
   */
  getFocusableElements(windowElement: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ');

    return Array.from(windowElement.querySelectorAll(focusableSelectors));
  },

  /**
   * Focus first focusable element in window
   */
  focusFirstElement(windowElement: HTMLElement): boolean {
    const focusableElements = this.getFocusableElements(windowElement);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
      return true;
    }
    return false;
  },

  /**
   * Focus last focusable element in window
   */
  focusLastElement(windowElement: HTMLElement): boolean {
    const focusableElements = this.getFocusableElements(windowElement);
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus();
      return true;
    }
    return false;
  },

  /**
   * Handle Tab key navigation within window
   */
  handleTabNavigation(
    event: KeyboardEvent,
    windowElement: HTMLElement
  ): boolean {
    const focusableElements = this.getFocusableElements(windowElement);
    if (focusableElements.length === 0) return false;

    const currentIndex = focusableElements.indexOf(event.target as HTMLElement);
    
    if (event.shiftKey) {
      // Shift+Tab - move to previous element
      if (currentIndex <= 0) {
        // Wrap to last element
        focusableElements[focusableElements.length - 1].focus();
        event.preventDefault();
        return true;
      }
    } else {
      // Tab - move to next element
      if (currentIndex >= focusableElements.length - 1) {
        // Wrap to first element
        focusableElements[0].focus();
        event.preventDefault();
        return true;
      }
    }

    return false;
  },
};

/**
 * High contrast mode detection and support
 */
export const highContrastSupport = {
  /**
   * Check if high contrast mode is enabled
   */
  isHighContrastMode(): boolean {
    // Check for Windows high contrast mode
    if (window.matchMedia) {
      return window.matchMedia('(prefers-contrast: high)').matches ||
             window.matchMedia('(-ms-high-contrast: active)').matches;
    }
    return false;
  },

  /**
   * Apply high contrast styles to window
   */
  applyHighContrastStyles(windowElement: HTMLElement): void {
    if (this.isHighContrastMode()) {
      windowElement.classList.add('high-contrast-mode');
    }
  },

  /**
   * Remove high contrast styles from window
   */
  removeHighContrastStyles(windowElement: HTMLElement): void {
    windowElement.classList.remove('high-contrast-mode');
  },

  /**
   * Listen for high contrast mode changes
   */
  onHighContrastChange(callback: (isHighContrast: boolean) => void): () => void {
    if (!window.matchMedia) return () => {};

    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    const msMediaQuery = window.matchMedia('(-ms-high-contrast: active)');

    const handler = () => {
      callback(mediaQuery.matches || msMediaQuery.matches);
    };

    mediaQuery.addEventListener('change', handler);
    msMediaQuery.addEventListener('change', handler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
      msMediaQuery.removeEventListener('change', handler);
    };
  },
};

/**
 * Screen reader utilities
 */
export const screenReaderUtils = {
  /**
   * Create live region for announcements
   */
  createLiveRegion(priority: 'polite' | 'assertive' = 'polite'): HTMLElement {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    
    document.body.appendChild(liveRegion);
    return liveRegion;
  },

  /**
   * Announce message to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite', delay = 0): void {
    setTimeout(() => {
      const liveRegion = this.createLiveRegion(priority);
      liveRegion.textContent = message;
      
      // Remove after announcement
      setTimeout(() => {
        if (liveRegion.parentNode) {
          liveRegion.parentNode.removeChild(liveRegion);
        }
      }, 1000);
    }, delay);
  },

  /**
   * Set window title for screen readers
   */
  setWindowTitle(windowElement: HTMLElement, title: string): void {
    windowElement.setAttribute('aria-label', title);
    
    const titleElement = windowElement.querySelector('[role="banner"]');
    if (titleElement) {
      titleElement.setAttribute('aria-label', `Window title: ${title}`);
    }
  },

  /**
   * Update window state for screen readers
   */
  updateWindowState(windowElement: HTMLElement, window: WindowState): void {
    const states = [];
    
    if (window.isMinimized) states.push('minimized');
    if (window.isMaximized) states.push('maximized');
    if (window.isActive) states.push('active');
    
    const stateDescription = states.length > 0 ? ` (${states.join(', ')})` : '';
    windowElement.setAttribute('aria-label', `${window.title}${stateDescription}`);
  },
};

/**
 * Window accessibility manager
 */
export class WindowAccessibilityManager {
  private static instance: WindowAccessibilityManager;
  private announceTimeouts: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  static getInstance(): WindowAccessibilityManager {
    if (!WindowAccessibilityManager.instance) {
      WindowAccessibilityManager.instance = new WindowAccessibilityManager();
    }
    return WindowAccessibilityManager.instance;
  }

  /**
   * Announce window operation with debouncing
   */
  announceOperation(announcement: AccessibilityAnnouncement, debounceKey?: string): void {
    const key = debounceKey || announcement.message;

    // Clear existing timeout for this key
    if (this.announceTimeouts.has(key)) {
      clearTimeout(this.announceTimeouts.get(key)!);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      screenReaderUtils.announce(announcement.message, announcement.priority, announcement.delay);
      this.announceTimeouts.delete(key);
    }, 100); // Small debounce delay

    this.announceTimeouts.set(key, timeout);
  }

  /**
   * Clear all pending announcements
   */
  clearPendingAnnouncements(): void {
    this.announceTimeouts.forEach(timeout => clearTimeout(timeout));
    this.announceTimeouts.clear();
  }
}
