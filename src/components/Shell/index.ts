/**
 * Shell Components Export
 * Main export file for all XP Shell components
 */

export { DesktopCanvas } from './DesktopCanvas';
export { Taskbar } from './Taskbar';
export { StartMenu } from './StartMenu';
export { WindowFrame } from './WindowFrame';

export type {
  // Base types
  BaseComponentProps,
  AccessibilityProps,

  // Desktop types
  DesktopProps,
  DesktopIcon,
  DesktopEvent,

  // Taskbar types
  TaskbarProps,
  TaskbarItem,
  TaskbarEvent,

  // Start Menu types
  StartMenuProps,
  StartMenuItem,
  StartMenuEvent,

  // Window types
  WindowProps,
  WindowState,
  WindowEvent,

  // System Tray types
  SystemTrayProps,
  SystemTrayItem,

  // Context Menu types
  ContextMenuProps,
  ContextMenuItem,
} from './types';
