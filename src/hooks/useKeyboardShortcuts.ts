/**
 * useKeyboardShortcuts Hook
 * Handles keyboard shortcuts for window management
 */

import { useEffect, useCallback } from 'react';
import { WindowState } from '../components/Shell/types';
import { WindowManager } from '../services/WindowManager';

interface UseKeyboardShortcutsProps {
  windows: WindowState[];
  onFocusWindow: (windowId: string) => void;
  onCloseWindow: (windowId: string) => void;
  onMinimizeWindow: (windowId: string) => void;
  onMaximizeWindow: (windowId: string) => void;
  onCascadeWindows?: () => void;
  onTileHorizontally?: () => void;
  onTileVertically?: () => void;
  onMinimizeAll?: () => void;
  enabled?: boolean;
}

export const useKeyboardShortcuts = ({
  windows,
  onFocusWindow,
  onCloseWindow,
  onMinimizeWindow,
  onMaximizeWindow,
  onCascadeWindows,
  onTileHorizontally,
  onTileVertically,
  onMinimizeAll,
  enabled = true,
}: UseKeyboardShortcutsProps) => {
  const windowManager = WindowManager.getInstance();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Prevent shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      const activeWindow = windowManager.getActiveWindow(windows);

      // Alt + Tab - Switch to next window
      if (event.altKey && event.key === 'Tab') {
        event.preventDefault();
        if (activeWindow) {
          const nextWindow = event.shiftKey
            ? windowManager.getPreviousWindow(windows, activeWindow.id)
            : windowManager.getNextWindow(windows, activeWindow.id);
          
          if (nextWindow) {
            onFocusWindow(nextWindow.id);
          }
        } else if (windows.length > 0) {
          // Focus first window if no active window
          const firstWindow = windows.find(w => !w.isMinimized);
          if (firstWindow) {
            onFocusWindow(firstWindow.id);
          }
        }
      }

      // Alt + F4 - Close active window
      else if (event.altKey && event.key === 'F4') {
        event.preventDefault();
        if (activeWindow && windowManager.canCloseWindow(activeWindow)) {
          onCloseWindow(activeWindow.id);
        }
      }

      // Windows + M - Minimize all windows
      else if (event.metaKey && event.key === 'm') {
        event.preventDefault();
        onMinimizeAll?.();
      }

      // Windows + D - Show desktop (minimize all)
      else if (event.metaKey && event.key === 'd') {
        event.preventDefault();
        onMinimizeAll?.();
      }

      // Alt + Space - Window menu (for future implementation)
      else if (event.altKey && event.key === ' ') {
        event.preventDefault();
        // TODO: Show window context menu
        console.log('Window menu shortcut triggered');
      }

      // Ctrl + Alt + T - Tile horizontally
      else if (event.ctrlKey && event.altKey && event.key === 't') {
        event.preventDefault();
        onTileHorizontally?.();
      }

      // Ctrl + Alt + V - Tile vertically
      else if (event.ctrlKey && event.altKey && event.key === 'v') {
        event.preventDefault();
        onTileVertically?.();
      }

      // Ctrl + Alt + C - Cascade windows
      else if (event.ctrlKey && event.altKey && event.key === 'c') {
        event.preventDefault();
        onCascadeWindows?.();
      }

      // F11 - Toggle maximize active window
      else if (event.key === 'F11') {
        event.preventDefault();
        if (activeWindow && windowManager.canMaximizeWindow(activeWindow)) {
          onMaximizeWindow(activeWindow.id);
        }
      }

      // Escape - Minimize active window
      else if (event.key === 'Escape' && event.ctrlKey) {
        event.preventDefault();
        if (activeWindow && windowManager.canMinimizeWindow(activeWindow)) {
          onMinimizeWindow(activeWindow.id);
        }
      }

      // Arrow keys for window movement (Ctrl + Alt + Arrow)
      else if (event.ctrlKey && event.altKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        // TODO: Implement window movement with arrow keys
        console.log(`Window movement shortcut: ${event.key}`);
      }
    },
    [
      enabled,
      windows,
      windowManager,
      onFocusWindow,
      onCloseWindow,
      onMinimizeWindow,
      onMaximizeWindow,
      onCascadeWindows,
      onTileHorizontally,
      onTileVertically,
      onMinimizeAll,
    ]
  );

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [enabled, handleKeyDown]);

  return {
    // Return any utility functions if needed
    getActiveWindow: () => windowManager.getActiveWindow(windows),
    getNextWindow: (windowId: string) => windowManager.getNextWindow(windows, windowId),
    getPreviousWindow: (windowId: string) => windowManager.getPreviousWindow(windows, windowId),
  };
};
