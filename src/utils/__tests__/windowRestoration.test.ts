/**
 * Window Restoration Utilities Tests
 * Tests for accurate window state restoration with validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { restoreWindowStates, getRestorationStats } from '../windowRestoration';
import { WindowState } from '../../components/Shell/types';

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1920,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 1080,
});

describe('Window Restoration Utilities', () => {
  const mockWindows: WindowState[] = [
    {
      id: 'window-1',
      title: 'Window 1',
      position: { x: 100, y: 100 },
      size: { width: 400, height: 300 },
      isMinimized: false,
      isMaximized: false,
      isActive: false,
      zIndex: 1000,
    },
    {
      id: 'window-2',
      title: 'Window 2',
      position: { x: 200, y: 200 },
      size: { width: 300, height: 250 },
      isMinimized: false,
      isMaximized: false,
      isActive: true,
      zIndex: 1001,
    },
  ];

  describe('restoreWindowStates', () => {
    it('should restore windows without modification when valid', () => {
      const restored = restoreWindowStates(mockWindows);

      expect(restored).toHaveLength(2);
      expect(restored[0].position).toEqual({ x: 100, y: 100 });
      expect(restored[1].position).toEqual({ x: 200, y: 200 });
    });

    it('should handle empty window array', () => {
      const restored = restoreWindowStates([]);

      expect(restored).toHaveLength(0);
    });

    it('should normalize z-indexes', () => {
      const windowsWithBadZIndex = [
        { ...mockWindows[0], zIndex: 5000 },
        { ...mockWindows[1], zIndex: 2000 },
      ];

      const restored = restoreWindowStates(windowsWithBadZIndex);

      expect(restored[0].zIndex).toBe(1000); // Lower original z-index
      expect(restored[1].zIndex).toBe(1001); // Higher original z-index
    });

    it('should ensure exactly one active window', () => {
      const windowsWithNoActive = mockWindows.map(w => ({ ...w, isActive: false }));

      const restored = restoreWindowStates(windowsWithNoActive);

      const activeWindows = restored.filter(w => w.isActive);
      expect(activeWindows).toHaveLength(1);
      expect(activeWindows[0].id).toBe('window-2'); // Highest z-index should be active
    });

    it('should handle multiple active windows by keeping only the top one', () => {
      const windowsWithMultipleActive = mockWindows.map(w => ({ ...w, isActive: true }));

      const restored = restoreWindowStates(windowsWithMultipleActive);

      const activeWindows = restored.filter(w => w.isActive);
      expect(activeWindows).toHaveLength(1);
      expect(activeWindows[0].id).toBe('window-2'); // Highest z-index should remain active
    });

    it('should correct invalid window sizes', () => {
      const windowsWithBadSizes = [
        {
          ...mockWindows[0],
          size: { width: 50, height: 30 }, // Too small
        },
        {
          ...mockWindows[1],
          size: { width: 10000, height: 8000 }, // Too large
        },
      ];

      const restored = restoreWindowStates(windowsWithBadSizes);

      expect(restored[0].size.width).toBeGreaterThanOrEqual(200); // Min width
      expect(restored[0].size.height).toBeGreaterThanOrEqual(100); // Min height
      expect(restored[1].size.width).toBeLessThanOrEqual(1920); // Max width
      expect(restored[1].size.height).toBeLessThanOrEqual(1050); // Max height (accounting for taskbar)
    });

    it('should resolve overlapping windows', () => {
      const overlappingWindows = [
        { ...mockWindows[0], position: { x: 100, y: 100 } },
        { ...mockWindows[1], position: { x: 105, y: 105 } }, // Very close overlap
      ];

      const restored = restoreWindowStates(overlappingWindows);

      // Second window should be offset to avoid overlap
      expect(restored[1].position.x).toBeGreaterThan(105);
      expect(restored[1].position.y).toBeGreaterThan(105);
    });

    it('should validate boolean states', () => {
      const windowsWithInvalidBooleans = [
        {
          ...mockWindows[0],
          isMinimized: 'true' as any, // Invalid boolean
          isMaximized: 1 as any, // Invalid boolean
          isActive: null as any, // Invalid boolean
        },
      ];

      const restored = restoreWindowStates(windowsWithInvalidBooleans);

      expect(restored[0].isMinimized).toBe(true);
      expect(restored[0].isMaximized).toBe(true);
      expect(restored[0].isActive).toBe(false);
    });

    it('should handle invalid z-index values', () => {
      const windowsWithBadZIndex = [
        {
          ...mockWindows[0],
          zIndex: -100, // Negative z-index
        },
        {
          ...mockWindows[1],
          zIndex: 'invalid' as any, // Non-numeric z-index
        },
      ];

      const restored = restoreWindowStates(windowsWithBadZIndex);

      expect(restored[0].zIndex).toBeGreaterThanOrEqual(1000);
      expect(restored[1].zIndex).toBeGreaterThanOrEqual(1000);
      expect(typeof restored[0].zIndex).toBe('number');
      expect(typeof restored[1].zIndex).toBe('number');
    });

    it('should respect restoration options', () => {
      const restored = restoreWindowStates(mockWindows, {
        validatePositions: false,
        constrainToBounds: false,
        handleOffScreen: false,
        preserveZIndex: false,
        ensureActiveWindow: false,
      });

      // With all validations disabled, should return windows mostly unchanged
      expect(restored).toHaveLength(2);
      expect(restored[0].id).toBe('window-1');
      expect(restored[1].id).toBe('window-2');
    });
  });

  describe('getRestorationStats', () => {
    it('should provide accurate restoration statistics', () => {
      const originalWindows = [
        { ...mockWindows[0], position: { x: -1000, y: -1000 } }, // Off-screen
        { ...mockWindows[1], size: { width: 50, height: 30 } }, // Too small
      ];

      const restoredWindows = restoreWindowStates(originalWindows);
      const stats = getRestorationStats(originalWindows, restoredWindows);

      expect(stats.totalWindows).toBe(2);
      expect(stats.positionsCorrected).toBe(1); // Off-screen window corrected
      expect(stats.sizesCorrected).toBe(1); // Too small window corrected
      expect(typeof stats.activeWindowChanged).toBe('boolean');
      expect(typeof stats.zIndexesNormalized).toBe('boolean');
    });

    it('should detect when no corrections were needed', () => {
      const restoredWindows = restoreWindowStates(mockWindows);
      const stats = getRestorationStats(mockWindows, restoredWindows);

      expect(stats.totalWindows).toBe(2);
      expect(stats.positionsCorrected).toBe(0);
      expect(stats.sizesCorrected).toBe(0);
    });

    it('should detect active window changes', () => {
      const originalWindows = mockWindows.map(w => ({ ...w, isActive: false }));
      const restoredWindows = restoreWindowStates(originalWindows);
      const stats = getRestorationStats(originalWindows, restoredWindows);

      expect(stats.activeWindowChanged).toBe(true);
    });

    it('should detect z-index normalization', () => {
      const originalWindows = [
        { ...mockWindows[0], zIndex: 5000 },
        { ...mockWindows[1], zIndex: 2000 },
      ];
      const restoredWindows = restoreWindowStates(originalWindows);
      const stats = getRestorationStats(originalWindows, restoredWindows);

      expect(stats.zIndexesNormalized).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle windows with extreme positions', () => {
      const extremeWindows = [
        {
          ...mockWindows[0],
          position: { x: -10000, y: -10000 },
        },
        {
          ...mockWindows[1],
          position: { x: 50000, y: 50000 },
        },
      ];

      const restored = restoreWindowStates(extremeWindows);

      // Should bring windows back on screen
      expect(restored[0].position.x).toBeGreaterThanOrEqual(0);
      expect(restored[0].position.y).toBeGreaterThanOrEqual(0);
      expect(restored[1].position.x).toBeLessThan(window.innerWidth);
      expect(restored[1].position.y).toBeLessThan(window.innerHeight);
    });

    it('should handle minimized windows correctly', () => {
      const minimizedWindows = [
        { ...mockWindows[0], isMinimized: true, isActive: false },
        { ...mockWindows[1], isMinimized: false, isActive: false },
      ];

      const restored = restoreWindowStates(minimizedWindows);

      // Should make the non-minimized window active
      const activeWindow = restored.find(w => w.isActive);
      expect(activeWindow?.isMinimized).toBe(false);
    });

    it('should handle all minimized windows', () => {
      const allMinimizedWindows = mockWindows.map(w => ({
        ...w,
        isMinimized: true,
        isActive: false,
      }));

      const restored = restoreWindowStates(allMinimizedWindows);

      // Should still have an active window even if all are minimized
      const activeWindows = restored.filter(w => w.isActive);
      expect(activeWindows).toHaveLength(1);
    });

    it('should handle single window restoration', () => {
      const singleWindow = [mockWindows[0]];

      const restored = restoreWindowStates(singleWindow);

      expect(restored).toHaveLength(1);
      expect(restored[0].isActive).toBe(true); // Single window should be active
    });
  });
});
