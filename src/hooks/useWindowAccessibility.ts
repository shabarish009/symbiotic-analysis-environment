/**
 * useWindowAccessibility Hook
 * Handles accessibility features for window management
 */

import { useEffect, useCallback, useRef } from 'react';
import { WindowState } from '../components/Shell/types';
import {
  createWindowAnnouncements,
  WindowFocusManager,
  WindowAccessibilityManager,
  highContrastSupport,
  keyboardNavigation,
  screenReaderUtils,
} from '../utils/windowAccessibility';

interface UseWindowAccessibilityProps {
  windows: WindowState[];
  enabled?: boolean;
}

export const useWindowAccessibility = ({
  windows,
  enabled = true,
}: UseWindowAccessibilityProps) => {
  const focusManager = useRef(WindowFocusManager.getInstance());
  const accessibilityManager = useRef(WindowAccessibilityManager.getInstance());
  const previousWindows = useRef<WindowState[]>([]);

  /**
   * Announce window operations
   */
  const announceWindowOperation = useCallback(
    (type: string, window: WindowState, debounceKey?: string) => {
      if (!enabled) return;

      let announcement;
      switch (type) {
        case 'opened':
          announcement = createWindowAnnouncements.windowOpened(window.title);
          break;
        case 'closed':
          announcement = createWindowAnnouncements.windowClosed(window.title);
          break;
        case 'minimized':
          announcement = createWindowAnnouncements.windowMinimized(window.title);
          break;
        case 'maximized':
          announcement = createWindowAnnouncements.windowMaximized(window.title);
          break;
        case 'restored':
          announcement = createWindowAnnouncements.windowRestored(window.title);
          break;
        case 'focused':
          announcement = createWindowAnnouncements.windowFocused(window.title);
          break;
        case 'moved':
          announcement = createWindowAnnouncements.windowMoved(window.title);
          break;
        case 'resized':
          announcement = createWindowAnnouncements.windowResized(window.title);
          break;
        default:
          return;
      }

      accessibilityManager.current.announceOperation(announcement, debounceKey);
    },
    [enabled]
  );

  /**
   * Handle window focus changes
   */
  const handleWindowFocus = useCallback(
    (windowId: string) => {
      if (!enabled) return;

      focusManager.current.recordFocus(windowId);
      const window = windows.find(w => w.id === windowId);
      if (window) {
        announceWindowOperation('focused', window, 'focus');
      }
    },
    [enabled, windows, announceWindowOperation]
  );

  /**
   * Handle keyboard navigation within window
   */
  const handleWindowKeyDown = useCallback(
    (event: React.KeyboardEvent, windowElement: HTMLElement) => {
      if (!enabled) return false;

      // Handle Tab navigation within window
      if (event.key === 'Tab') {
        return keyboardNavigation.handleTabNavigation(
          event.nativeEvent,
          windowElement
        );
      }

      return false;
    },
    [enabled]
  );

  /**
   * Focus first element in window
   */
  const focusFirstElementInWindow = useCallback(
    (windowElement: HTMLElement) => {
      if (!enabled) return false;
      return keyboardNavigation.focusFirstElement(windowElement);
    },
    [enabled]
  );

  /**
   * Update window accessibility attributes
   */
  const updateWindowAccessibility = useCallback(
    (windowElement: HTMLElement, window: WindowState) => {
      if (!enabled) return;

      screenReaderUtils.updateWindowState(windowElement, window);
      
      // Apply high contrast styles if needed
      if (highContrastSupport.isHighContrastMode()) {
        highContrastSupport.applyHighContrastStyles(windowElement);
      }
    },
    [enabled]
  );

  /**
   * Announce bulk window operations
   */
  const announceBulkOperation = useCallback(
    (type: 'cascade' | 'tile-horizontal' | 'tile-vertical' | 'minimize-all', count: number) => {
      if (!enabled) return;

      let announcement;
      switch (type) {
        case 'cascade':
          announcement = createWindowAnnouncements.windowsCascaded(count);
          break;
        case 'tile-horizontal':
          announcement = createWindowAnnouncements.windowsTiledHorizontally(count);
          break;
        case 'tile-vertical':
          announcement = createWindowAnnouncements.windowsTiledVertically(count);
          break;
        case 'minimize-all':
          announcement = createWindowAnnouncements.allWindowsMinimized();
          break;
        default:
          return;
      }

      accessibilityManager.current.announceOperation(announcement);
    },
    [enabled]
  );

  // Monitor window changes and announce operations
  useEffect(() => {
    if (!enabled) return;

    const previous = previousWindows.current;
    const current = windows;

    // Check for new windows
    current.forEach(window => {
      const wasPresent = previous.find(w => w.id === window.id);
      if (!wasPresent) {
        announceWindowOperation('opened', window);
      }
    });

    // Check for closed windows
    previous.forEach(window => {
      const stillPresent = current.find(w => w.id === window.id);
      if (!stillPresent) {
        announceWindowOperation('closed', window);
        focusManager.current.removeFromHistory(window.id);
      }
    });

    // Check for state changes
    current.forEach(window => {
      const previousWindow = previous.find(w => w.id === window.id);
      if (previousWindow) {
        // Check for minimize/restore
        if (window.isMinimized !== previousWindow.isMinimized) {
          if (window.isMinimized) {
            announceWindowOperation('minimized', window);
          } else {
            announceWindowOperation('restored', window);
          }
        }

        // Check for maximize/restore
        if (window.isMaximized !== previousWindow.isMaximized) {
          if (window.isMaximized) {
            announceWindowOperation('maximized', window);
          } else {
            announceWindowOperation('restored', window);
          }
        }

        // Check for position changes (debounced)
        if (
          window.position.x !== previousWindow.position.x ||
          window.position.y !== previousWindow.position.y
        ) {
          announceWindowOperation('moved', window, `move-${window.id}`);
        }

        // Check for size changes (debounced)
        if (
          window.size.width !== previousWindow.size.width ||
          window.size.height !== previousWindow.size.height
        ) {
          announceWindowOperation('resized', window, `resize-${window.id}`);
        }
      }
    });

    previousWindows.current = [...current];
  }, [windows, enabled, announceWindowOperation]);

  // Listen for high contrast mode changes
  useEffect(() => {
    if (!enabled) return;

    const cleanup = highContrastSupport.onHighContrastChange((isHighContrast) => {
      // Update all window elements
      const windowElements = document.querySelectorAll('[role="dialog"]');
      windowElements.forEach(element => {
        if (isHighContrast) {
          highContrastSupport.applyHighContrastStyles(element as HTMLElement);
        } else {
          highContrastSupport.removeHighContrastStyles(element as HTMLElement);
        }
      });
    });

    return cleanup;
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      accessibilityManager.current.clearPendingAnnouncements();
    };
  }, []);

  return {
    announceWindowOperation,
    handleWindowFocus,
    handleWindowKeyDown,
    focusFirstElementInWindow,
    updateWindowAccessibility,
    announceBulkOperation,
    isHighContrastMode: highContrastSupport.isHighContrastMode(),
  };
};
