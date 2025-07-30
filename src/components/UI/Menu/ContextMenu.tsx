/**
 * XP Context Menu Component
 * Authentic Windows XP right-click context menu
 */

import React, { useEffect, useRef, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Menu, MenuItem } from './Menu';
import './ContextMenu.css';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
  onItemSelect?: (itemId: string) => void;
  className?: string;
  'data-testid'?: string;
}

export const ContextMenu = forwardRef<HTMLDivElement, ContextMenuProps>(
  (
    {
      items,
      position,
      onClose,
      onItemSelect,
      className = '',
      'data-testid': testId,
    },
    ref
  ) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // Handle clicks outside menu
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          onClose();
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }
      };

      // Add listeners after a small delay to prevent immediate closing
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
      }, 10);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [onClose]);

    // Position menu within viewport
    useEffect(() => {
      if (!menuRef.current) return;

      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      let { x, y } = position;

      // Adjust horizontal position if menu would overflow
      if (x + rect.width > viewport.width) {
        x = viewport.width - rect.width - 8;
      }
      if (x < 8) {
        x = 8;
      }

      // Adjust vertical position if menu would overflow
      if (y + rect.height > viewport.height) {
        y = viewport.height - rect.height - 8;
      }
      if (y < 8) {
        y = 8;
      }

      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
    }, [position]);

    const handleItemClick = (item: ContextMenuItem) => {
      if (item.disabled || item.separator) return;

      item.onClick?.();
      onItemSelect?.(item.id);
      onClose();
    };

    const menuElement = (
      <div
        ref={menuRef}
        className={`xp-context-menu ${className}`}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
        }}
        data-testid={testId}
      >
        <Menu>
          {items.map((item) => (
            <MenuItem
              key={item.id}
              icon={item.icon}
              shortcut={item.shortcut}
              separator={item.separator}
              disabled={item.disabled}
              onClick={() => handleItemClick(item)}
            >
              {item.label}
            </MenuItem>
          ))}
        </Menu>
      </div>
    );

    // Render in portal to ensure proper z-index stacking
    return createPortal(menuElement, document.body);
  }
);

ContextMenu.displayName = 'ContextMenu';
