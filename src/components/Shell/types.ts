/**
 * Type definitions for Shell components
 * Common interfaces and types used across XP Shell components
 */

import { ReactNode } from 'react';

// Base component props
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
  'data-testid'?: string;
}

// Window management types
export interface WindowState {
  id: string;
  title: string;
  isMinimized: boolean;
  isMaximized: boolean;
  isActive: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}

export interface WindowProps extends BaseComponentProps {
  window: WindowState;
  onClose?: (windowId: string) => void;
  onMinimize?: (windowId: string) => void;
  onMaximize?: (windowId: string) => void;
  onRestore?: (windowId: string) => void;
  onMove?: (windowId: string, position: { x: number; y: number }) => void;
  onResize?: (
    windowId: string,
    size: { width: number; height: number }
  ) => void;
  onFocus?: (windowId: string) => void;
}

// Desktop types
export interface DesktopIcon {
  id: string;
  name: string;
  icon: string;
  position: { x: number; y: number };
  isSelected: boolean;
  onDoubleClick?: () => void;
}

export interface DesktopProps extends BaseComponentProps {
  icons?: DesktopIcon[];
  onIconSelect?: (iconId: string) => void;
  onIconMove?: (iconId: string, position: { x: number; y: number }) => void;
  onDesktopClick?: () => void;
  onDesktopContextMenu?: (event: React.MouseEvent) => void;
}

// Taskbar types
export interface TaskbarItem {
  id: string;
  title: string;
  icon?: string;
  isActive: boolean;
  isMinimized: boolean;
  onClick?: () => void;
}

export interface TaskbarProps extends BaseComponentProps {
  items?: TaskbarItem[];
  onStartClick?: () => void;
  onItemClick?: (itemId: string) => void;
  showClock?: boolean;
  currentTime?: Date;
}

// Start Menu types
export interface StartMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  separator?: boolean;
  submenu?: StartMenuItem[];
  onClick?: () => void;
}

export interface StartMenuProps extends BaseComponentProps {
  isOpen: boolean;
  items?: StartMenuItem[];
  onClose?: () => void;
  onItemClick?: (itemId: string) => void;
  userInfo?: {
    name: string;
    avatar?: string;
  };
}

// System tray types
export interface SystemTrayItem {
  id: string;
  icon: string;
  tooltip?: string;
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}

export interface SystemTrayProps extends BaseComponentProps {
  items?: SystemTrayItem[];
  showClock?: boolean;
  currentTime?: Date;
}

// Context menu types
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  onClick?: () => void;
}

export interface ContextMenuProps extends BaseComponentProps {
  isOpen: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose?: () => void;
  onItemClick?: (itemId: string) => void;
}

// Event types
export type WindowEvent =
  | { type: 'close'; windowId: string }
  | { type: 'minimize'; windowId: string }
  | { type: 'maximize'; windowId: string }
  | { type: 'restore'; windowId: string }
  | { type: 'move'; windowId: string; position: { x: number; y: number } }
  | {
      type: 'resize';
      windowId: string;
      size: { width: number; height: number };
    }
  | { type: 'focus'; windowId: string };

export type DesktopEvent =
  | { type: 'iconSelect'; iconId: string }
  | { type: 'iconMove'; iconId: string; position: { x: number; y: number } }
  | { type: 'desktopClick' }
  | { type: 'contextMenu'; position: { x: number; y: number } };

export type TaskbarEvent =
  | { type: 'startClick' }
  | { type: 'itemClick'; itemId: string };

export type StartMenuEvent =
  | { type: 'itemClick'; itemId: string }
  | { type: 'close' };

// Accessibility types
export interface AccessibilityProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  'aria-disabled'?: boolean;
  role?: string;
  tabIndex?: number;
}
