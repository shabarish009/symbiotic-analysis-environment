/**
 * Window Restoration Utilities
 * Handles accurate window state restoration with validation
 */

import { WindowState } from '../components/Shell/types';
import { constrainWindowPosition, bringWindowOnScreen } from './windowConstraints';

export interface RestorationOptions {
  validatePositions: boolean;
  constrainToBounds: boolean;
  handleOffScreen: boolean;
  preserveZIndex: boolean;
  ensureActiveWindow: boolean;
}

export const DEFAULT_RESTORATION_OPTIONS: RestorationOptions = {
  validatePositions: true,
  constrainToBounds: true,
  handleOffScreen: true,
  preserveZIndex: true,
  ensureActiveWindow: true,
};

/**
 * Restore windows with validation and correction
 */
export const restoreWindowStates = (
  windows: WindowState[],
  options: Partial<RestorationOptions> = {}
): WindowState[] => {
  const opts = { ...DEFAULT_RESTORATION_OPTIONS, ...options };
  
  if (windows.length === 0) {
    return [];
  }

  let restoredWindows = [...windows];

  // Step 1: Validate and correct window positions and sizes
  if (opts.validatePositions) {
    restoredWindows = restoredWindows.map(window => validateWindowState(window, opts));
  }

  // Step 2: Ensure proper z-index ordering
  if (opts.preserveZIndex) {
    restoredWindows = normalizeZIndexes(restoredWindows);
  }

  // Step 3: Ensure there's an active window
  if (opts.ensureActiveWindow) {
    restoredWindows = ensureActiveWindow(restoredWindows);
  }

  // Step 4: Handle overlapping windows
  restoredWindows = resolveWindowOverlaps(restoredWindows);

  return restoredWindows;
};

/**
 * Validate and correct individual window state
 */
const validateWindowState = (
  window: WindowState,
  options: RestorationOptions
): WindowState => {
  let correctedWindow = { ...window };

  // Validate position
  if (options.constrainToBounds) {
    const constrainedPosition = constrainWindowPosition(
      correctedWindow.position,
      correctedWindow.size
    );
    correctedWindow.position = constrainedPosition;
  }

  // Handle off-screen windows - ensure they're fully visible
  if (options.handleOffScreen) {
    const desktop = { width: globalThis.innerWidth, height: globalThis.innerHeight - 30 }; // Account for taskbar

    let { x, y } = correctedWindow.position;
    const { width, height } = correctedWindow.size;

    // Ensure window is fully on screen
    x = Math.max(0, Math.min(desktop.width - width, x));
    y = Math.max(0, Math.min(desktop.height - height, y));

    correctedWindow.position = { x, y };
  }

  // Validate size constraints
  correctedWindow.size = validateWindowSize(correctedWindow.size);

  // Validate boolean states
  correctedWindow.isMinimized = Boolean(correctedWindow.isMinimized);
  correctedWindow.isMaximized = Boolean(correctedWindow.isMaximized);
  correctedWindow.isActive = Boolean(correctedWindow.isActive);

  // Ensure z-index is a valid number
  if (typeof correctedWindow.zIndex !== 'number' || correctedWindow.zIndex < 0) {
    correctedWindow.zIndex = 1000;
  }

  return correctedWindow;
};

/**
 * Validate and correct window size
 */
const validateWindowSize = (size: { width: number; height: number }): { width: number; height: number } => {
  const MIN_WIDTH = 200;
  const MIN_HEIGHT = 100;
  const MAX_WIDTH = globalThis.innerWidth;
  const MAX_HEIGHT = globalThis.innerHeight - 30; // Account for taskbar

  return {
    width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, size.width)),
    height: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, size.height)),
  };
};

/**
 * Normalize z-indexes to ensure proper ordering
 */
const normalizeZIndexes = (windows: WindowState[]): WindowState[] => {
  // Sort by current z-index
  const sortedWindows = [...windows].sort((a, b) => a.zIndex - b.zIndex);
  
  // Reassign z-indexes starting from 1000
  return sortedWindows.map((window, index) => ({
    ...window,
    zIndex: 1000 + index,
  }));
};

/**
 * Ensure there's exactly one active window
 */
const ensureActiveWindow = (windows: WindowState[]): WindowState[] => {
  const activeWindows = windows.filter(w => w.isActive && !w.isMinimized);

  if (activeWindows.length === 0) {
    // No active window, make the top-most non-minimized window active
    const visibleWindows = windows.filter(w => !w.isMinimized);
    if (visibleWindows.length > 0) {
      const topWindow = visibleWindows.reduce((prev, current) =>
        current.zIndex > prev.zIndex ? current : prev
      );

      return windows.map(w => ({
        ...w,
        isActive: w.id === topWindow.id,
      }));
    } else if (windows.length > 0) {
      // All windows are minimized, make the top-most one active anyway
      const topWindow = windows.reduce((prev, current) =>
        current.zIndex > prev.zIndex ? current : prev
      );

      return windows.map(w => ({
        ...w,
        isActive: w.id === topWindow.id,
      }));
    }
  } else if (activeWindows.length > 1) {
    // Multiple active windows, keep only the top-most one active
    const topActiveWindow = activeWindows.reduce((prev, current) =>
      current.zIndex > prev.zIndex ? current : prev
    );

    return windows.map(w => ({
      ...w,
      isActive: w.id === topActiveWindow.id,
    }));
  }

  return windows;
};

/**
 * Resolve overlapping windows by slightly offsetting them
 */
const resolveWindowOverlaps = (windows: WindowState[]): WindowState[] => {
  const OVERLAP_THRESHOLD = 10;
  const OFFSET_AMOUNT = 20;
  
  return windows.map((window, index) => {
    // Check for overlaps with previous windows
    const overlappingWindows = windows.slice(0, index).filter(otherWindow => {
      const xOverlap = Math.abs(window.position.x - otherWindow.position.x) < OVERLAP_THRESHOLD;
      const yOverlap = Math.abs(window.position.y - otherWindow.position.y) < OVERLAP_THRESHOLD;
      return xOverlap && yOverlap && !otherWindow.isMinimized && !window.isMinimized;
    });

    if (overlappingWindows.length > 0) {
      // Offset the window to avoid overlap
      const offsetX = overlappingWindows.length * OFFSET_AMOUNT;
      const offsetY = overlappingWindows.length * OFFSET_AMOUNT;
      
      const newPosition = constrainWindowPosition(
        {
          x: window.position.x + offsetX,
          y: window.position.y + offsetY,
        },
        window.size
      );

      return {
        ...window,
        position: newPosition,
      };
    }

    return window;
  });
};

/**
 * Get restoration statistics for debugging
 */
export const getRestorationStats = (
  originalWindows: WindowState[],
  restoredWindows: WindowState[]
): {
  totalWindows: number;
  positionsCorrected: number;
  sizesCorrected: number;
  activeWindowChanged: boolean;
  zIndexesNormalized: boolean;
} => {
  let positionsCorrected = 0;
  let sizesCorrected = 0;

  originalWindows.forEach((original, index) => {
    const restored = restoredWindows[index];
    if (restored) {
      if (
        original.position.x !== restored.position.x ||
        original.position.y !== restored.position.y
      ) {
        positionsCorrected++;
      }
      
      if (
        original.size.width !== restored.size.width ||
        original.size.height !== restored.size.height
      ) {
        sizesCorrected++;
      }
    }
  });

  const originalActiveWindow = originalWindows.find(w => w.isActive);
  const restoredActiveWindow = restoredWindows.find(w => w.isActive);
  const activeWindowChanged = originalActiveWindow?.id !== restoredActiveWindow?.id;

  const originalZIndexes = originalWindows.map(w => w.zIndex).sort((a, b) => a - b);
  const restoredZIndexes = restoredWindows.map(w => w.zIndex).sort((a, b) => a - b);
  const zIndexesNormalized = JSON.stringify(originalZIndexes) !== JSON.stringify(restoredZIndexes);

  return {
    totalWindows: restoredWindows.length,
    positionsCorrected,
    sizesCorrected,
    activeWindowChanged,
    zIndexesNormalized,
  };
};
