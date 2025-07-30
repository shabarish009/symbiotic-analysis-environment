/**
 * WindowManager Service
 * Advanced window management functionality
 */

import { WindowState } from '../components/Shell/types';

export type WindowType = 'welcome' | 'about' | 'sql-editor' | 'schema-explorer' | 'generic';

export interface WindowTemplate {
  type: WindowType;
  title: string;
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
  resizable?: boolean;
  maximizable?: boolean;
  minimizable?: boolean;
}

const WINDOW_TEMPLATES: Record<WindowType, WindowTemplate> = {
  welcome: {
    type: 'welcome',
    title: 'Welcome to Symbiotic Analysis Environment',
    defaultSize: { width: 500, height: 400 },
    minSize: { width: 400, height: 300 },
    resizable: true,
    maximizable: true,
    minimizable: true,
  },
  about: {
    type: 'about',
    title: 'About',
    defaultSize: { width: 400, height: 300 },
    minSize: { width: 300, height: 200 },
    resizable: true,
    maximizable: false,
    minimizable: true,
  },
  'sql-editor': {
    type: 'sql-editor',
    title: 'SQL Editor',
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 600, height: 400 },
    resizable: true,
    maximizable: true,
    minimizable: true,
  },
  'schema-explorer': {
    type: 'schema-explorer',
    title: 'Schema Explorer',
    defaultSize: { width: 350, height: 500 },
    minSize: { width: 250, height: 300 },
    resizable: true,
    maximizable: true,
    minimizable: true,
  },
  generic: {
    type: 'generic',
    title: 'Window',
    defaultSize: { width: 400, height: 300 },
    minSize: { width: 200, height: 100 },
    resizable: true,
    maximizable: true,
    minimizable: true,
  },
};

export class WindowManager {
  private static instance: WindowManager;
  private windowCounter: number = 0;
  private zIndexCounter: number = 1000;

  private constructor() {}

  static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  /**
   * Create a new window with proper z-index management
   */
  createWindow(
    type: WindowType,
    position: { x: number; y: number },
    customTitle?: string,
    customSize?: { width: number; height: number }
  ): WindowState {
    const template = WINDOW_TEMPLATES[type];
    const windowId = `${type}-${Date.now()}-${++this.windowCounter}`;

    return {
      id: windowId,
      title: customTitle || template.title,
      position: { ...position },
      size: customSize || { ...template.defaultSize },
      isMinimized: false,
      isMaximized: false,
      isActive: true,
      zIndex: ++this.zIndexCounter,
    };
  }

  /**
   * Get window template for a specific type
   */
  getWindowTemplate(type: WindowType): WindowTemplate {
    return { ...WINDOW_TEMPLATES[type] };
  }

  /**
   * Update z-index for window focus management
   */
  updateZIndex(windows: WindowState[], focusedWindowId: string): WindowState[] {
    const maxZIndex = Math.max(...windows.map(w => w.zIndex));
    
    return windows.map(window => ({
      ...window,
      isActive: window.id === focusedWindowId,
      zIndex: window.id === focusedWindowId ? maxZIndex + 1 : window.zIndex,
    }));
  }

  /**
   * Arrange windows in cascade pattern
   */
  cascadeWindows(windows: WindowState[], startPosition = { x: 100, y: 100 }): WindowState[] {
    const CASCADE_OFFSET = 30;
    let currentX = startPosition.x;
    let currentY = startPosition.y;

    return windows.map((window, index) => {
      const newWindow = {
        ...window,
        position: { x: currentX, y: currentY },
        isMaximized: false,
        zIndex: 1000 + index,
      };

      currentX += CASCADE_OFFSET;
      currentY += CASCADE_OFFSET;

      // Reset position if we've cascaded too far
      if (currentX > window.innerWidth - 200 || currentY > window.innerHeight - 200) {
        currentX = startPosition.x;
        currentY = startPosition.y;
      }

      return newWindow;
    });
  }

  /**
   * Tile windows horizontally
   */
  tileWindowsHorizontally(windows: WindowState[]): WindowState[] {
    if (windows.length === 0) return windows;

    const desktopWidth = window.innerWidth;
    const desktopHeight = window.innerHeight - 30; // Account for taskbar
    const windowWidth = Math.floor(desktopWidth / windows.length);

    return windows.map((window, index) => ({
      ...window,
      position: { x: index * windowWidth, y: 0 },
      size: { width: windowWidth, height: desktopHeight },
      isMaximized: false,
      isMinimized: false,
    }));
  }

  /**
   * Tile windows vertically
   */
  tileWindowsVertically(windows: WindowState[]): WindowState[] {
    if (windows.length === 0) return windows;

    const desktopWidth = window.innerWidth;
    const desktopHeight = window.innerHeight - 30; // Account for taskbar
    const windowHeight = Math.floor(desktopHeight / windows.length);

    return windows.map((window, index) => ({
      ...window,
      position: { x: 0, y: index * windowHeight },
      size: { width: desktopWidth, height: windowHeight },
      isMaximized: false,
      isMinimized: false,
    }));
  }

  /**
   * Minimize all windows
   */
  minimizeAllWindows(windows: WindowState[]): WindowState[] {
    return windows.map(window => ({
      ...window,
      isMinimized: true,
      isActive: false,
    }));
  }

  /**
   * Restore all minimized windows
   */
  restoreAllWindows(windows: WindowState[]): WindowState[] {
    return windows.map(window => ({
      ...window,
      isMinimized: false,
    }));
  }

  /**
   * Close windows of specific type
   */
  closeWindowsByType(windows: WindowState[], type: WindowType): WindowState[] {
    return windows.filter(window => !window.id.startsWith(type));
  }

  /**
   * Get windows by type
   */
  getWindowsByType(windows: WindowState[], type: WindowType): WindowState[] {
    return windows.filter(window => window.id.startsWith(type));
  }

  /**
   * Find window by ID
   */
  findWindowById(windows: WindowState[], windowId: string): WindowState | undefined {
    return windows.find(window => window.id === windowId);
  }

  /**
   * Get active window
   */
  getActiveWindow(windows: WindowState[]): WindowState | undefined {
    return windows.find(window => window.isActive);
  }

  /**
   * Get next window in tab order
   */
  getNextWindow(windows: WindowState[], currentWindowId: string): WindowState | undefined {
    const visibleWindows = windows.filter(w => !w.isMinimized);
    const currentIndex = visibleWindows.findIndex(w => w.id === currentWindowId);
    
    if (currentIndex === -1 || visibleWindows.length <= 1) {
      return undefined;
    }

    const nextIndex = (currentIndex + 1) % visibleWindows.length;
    return visibleWindows[nextIndex];
  }

  /**
   * Get previous window in tab order
   */
  getPreviousWindow(windows: WindowState[], currentWindowId: string): WindowState | undefined {
    const visibleWindows = windows.filter(w => !w.isMinimized);
    const currentIndex = visibleWindows.findIndex(w => w.id === currentWindowId);
    
    if (currentIndex === -1 || visibleWindows.length <= 1) {
      return undefined;
    }

    const prevIndex = currentIndex === 0 ? visibleWindows.length - 1 : currentIndex - 1;
    return visibleWindows[prevIndex];
  }

  /**
   * Check if window can be closed
   */
  canCloseWindow(window: WindowState): boolean {
    const template = this.getWindowTemplate(window.id.split('-')[0] as WindowType);
    return template ? true : true; // All windows can be closed for now
  }

  /**
   * Check if window can be maximized
   */
  canMaximizeWindow(window: WindowState): boolean {
    const windowType = window.id.split('-')[0] as WindowType;
    const template = WINDOW_TEMPLATES[windowType] || WINDOW_TEMPLATES.generic;
    return template.maximizable !== false;
  }

  /**
   * Check if window can be minimized
   */
  canMinimizeWindow(window: WindowState): boolean {
    const windowType = window.id.split('-')[0] as WindowType;
    const template = WINDOW_TEMPLATES[windowType] || WINDOW_TEMPLATES.generic;
    return template.minimizable !== false;
  }

  /**
   * Check if window can be resized
   */
  canResizeWindow(window: WindowState): boolean {
    const windowType = window.id.split('-')[0] as WindowType;
    const template = WINDOW_TEMPLATES[windowType] || WINDOW_TEMPLATES.generic;
    return template.resizable !== false;
  }
}
