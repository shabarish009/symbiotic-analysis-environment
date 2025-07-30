/**
 * Window Constraints Utilities
 * Handles window boundary calculations and constraints
 */

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopBounds {
  width: number;
  height: number;
  taskbarHeight: number;
}

export interface WindowConstraints {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  snapZone: number;
  titleBarMinVisible: number;
}

export const DEFAULT_WINDOW_CONSTRAINTS: WindowConstraints = {
  minWidth: 200,
  minHeight: 100,
  maxWidth: Infinity,
  maxHeight: Infinity,
  snapZone: 10,
  titleBarMinVisible: 50,
};

/**
 * Get current desktop bounds accounting for taskbar
 */
export const getDesktopBounds = (): DesktopBounds => {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    taskbarHeight: 30, // XP taskbar height
  };
};

/**
 * Calculate effective desktop area (excluding taskbar)
 */
export const getEffectiveDesktopBounds = (): { width: number; height: number } => {
  const desktop = getDesktopBounds();
  return {
    width: desktop.width,
    height: desktop.height - desktop.taskbarHeight,
  };
};

/**
 * Constrain window position to stay within desktop bounds
 */
export const constrainWindowPosition = (
  position: { x: number; y: number },
  size: { width: number; height: number },
  constraints: Partial<WindowConstraints> = {}
): { x: number; y: number } => {
  const finalConstraints = { ...DEFAULT_WINDOW_CONSTRAINTS, ...constraints };
  const desktop = getEffectiveDesktopBounds();

  let { x, y } = position;

  // Ensure at least titleBarMinVisible pixels of title bar remain visible
  const minX = -(size.width - finalConstraints.titleBarMinVisible);
  const maxX = desktop.width - finalConstraints.titleBarMinVisible;
  const minY = 0;
  const maxY = desktop.height - finalConstraints.titleBarMinVisible;

  x = Math.max(minX, Math.min(maxX, x));
  y = Math.max(minY, Math.min(maxY, y));

  return { x, y };
};

/**
 * Constrain window size to respect min/max constraints
 */
export const constrainWindowSize = (
  size: { width: number; height: number },
  constraints: Partial<WindowConstraints> = {}
): { width: number; height: number } => {
  const finalConstraints = { ...DEFAULT_WINDOW_CONSTRAINTS, ...constraints };
  const desktop = getEffectiveDesktopBounds();

  const maxWidth = Math.min(finalConstraints.maxWidth, desktop.width);
  const maxHeight = Math.min(finalConstraints.maxHeight, desktop.height);

  return {
    width: Math.max(
      finalConstraints.minWidth,
      Math.min(maxWidth, size.width)
    ),
    height: Math.max(
      finalConstraints.minHeight,
      Math.min(maxHeight, size.height)
    ),
  };
};

/**
 * Check if position should snap to desktop edges
 */
export const getSnapPosition = (
  position: { x: number; y: number },
  size: { width: number; height: number },
  constraints: Partial<WindowConstraints> = {}
): { x: number; y: number } | null => {
  const finalConstraints = { ...DEFAULT_WINDOW_CONSTRAINTS, ...constraints };
  const desktop = getEffectiveDesktopBounds();
  const snapZone = finalConstraints.snapZone;

  let snapX = position.x;
  let snapY = position.y;
  let hasSnap = false;

  // Snap to left edge
  if (position.x <= snapZone) {
    snapX = 0;
    hasSnap = true;
  }
  // Snap to right edge
  else if (position.x + size.width >= desktop.width - snapZone) {
    snapX = desktop.width - size.width;
    hasSnap = true;
  }

  // Snap to top edge
  if (position.y <= snapZone) {
    snapY = 0;
    hasSnap = true;
  }
  // Snap to bottom edge (accounting for taskbar)
  else if (position.y + size.height >= desktop.height - snapZone) {
    snapY = desktop.height - size.height;
    hasSnap = true;
  }

  return hasSnap ? { x: snapX, y: snapY } : null;
};

/**
 * Calculate cascaded position for new windows
 */
export const getCascadedPosition = (
  existingWindows: WindowBounds[],
  defaultSize: { width: number; height: number }
): { x: number; y: number } => {
  const CASCADE_OFFSET = 30;
  const desktop = getEffectiveDesktopBounds();

  let x = 100;
  let y = 100;

  // Find a position that doesn't overlap with existing windows
  for (let i = 0; i < existingWindows.length; i++) {
    const hasOverlap = existingWindows.some(window => 
      Math.abs(window.x - x) < CASCADE_OFFSET && 
      Math.abs(window.y - y) < CASCADE_OFFSET
    );

    if (!hasOverlap) {
      break;
    }

    x += CASCADE_OFFSET;
    y += CASCADE_OFFSET;

    // Reset to origin if we've cascaded too far
    if (x + defaultSize.width > desktop.width || y + defaultSize.height > desktop.height) {
      x = 100;
      y = 100;
    }
  }

  return constrainWindowPosition({ x, y }, defaultSize);
};

/**
 * Check if window is completely off-screen
 */
export const isWindowOffScreen = (
  position: { x: number; y: number },
  size: { width: number; height: number },
  constraints: Partial<WindowConstraints> = {}
): boolean => {
  const finalConstraints = { ...DEFAULT_WINDOW_CONSTRAINTS, ...constraints };
  const desktop = getEffectiveDesktopBounds();

  // Window is off-screen if less than titleBarMinVisible pixels are visible
  const rightEdge = position.x + size.width;
  const bottomEdge = position.y + size.height;

  return (
    rightEdge < finalConstraints.titleBarMinVisible ||
    position.x > desktop.width - finalConstraints.titleBarMinVisible ||
    bottomEdge < finalConstraints.titleBarMinVisible ||
    position.y > desktop.height - finalConstraints.titleBarMinVisible
  );
};

/**
 * Bring window back on-screen if it's off-screen
 */
export const bringWindowOnScreen = (
  position: { x: number; y: number },
  size: { width: number; height: number },
  constraints: Partial<WindowConstraints> = {}
): { x: number; y: number } => {
  if (!isWindowOffScreen(position, size, constraints)) {
    return position;
  }

  return constrainWindowPosition(position, size, constraints);
};
