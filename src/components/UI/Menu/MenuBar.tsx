/**
 * XP Menu Bar Component
 * Authentic Windows XP application menu bar
 */

import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { Menu, MenuItem } from './Menu';
import './MenuBar.css';

export interface MenuBarItem {
  id: string;
  label: string;
  items: MenuBarSubItem[];
  disabled?: boolean;
}

export interface MenuBarSubItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface MenuBarProps {
  items: MenuBarItem[];
  onItemSelect?: (itemId: string, subItemId: string) => void;
  className?: string;
  'data-testid'?: string;
}

export const MenuBar = forwardRef<HTMLDivElement, MenuBarProps>(
  (
    {
      items,
      onItemSelect,
      className = '',
      'data-testid': testId,
    },
    ref
  ) => {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const menuBarRef = useRef<HTMLDivElement>(null);
    const menuRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Handle keyboard navigation
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (!activeMenu) return;

        switch (event.key) {
          case 'Escape':
            setActiveMenu(null);
            setOpenMenu(null);
            break;
          case 'ArrowLeft':
            event.preventDefault();
            navigateMenu(-1);
            break;
          case 'ArrowRight':
            event.preventDefault();
            navigateMenu(1);
            break;
        }
      };

      if (activeMenu) {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
      }
    }, [activeMenu]);

    // Handle clicks outside menu
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuBarRef.current && !menuBarRef.current.contains(event.target as Node)) {
          setActiveMenu(null);
          setOpenMenu(null);
        }
      };

      if (openMenu) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [openMenu]);

    const navigateMenu = (direction: number) => {
      const currentIndex = items.findIndex(item => item.id === activeMenu);
      const nextIndex = (currentIndex + direction + items.length) % items.length;
      const nextItem = items[nextIndex];
      
      if (!nextItem.disabled) {
        setActiveMenu(nextItem.id);
        setOpenMenu(nextItem.id);
      }
    };

    const handleMenuClick = (item: MenuBarItem) => {
      if (item.disabled) return;

      if (openMenu === item.id) {
        setActiveMenu(null);
        setOpenMenu(null);
      } else {
        setActiveMenu(item.id);
        setOpenMenu(item.id);
      }
    };

    const handleMenuHover = (item: MenuBarItem) => {
      if (item.disabled) return;
      
      setActiveMenu(item.id);
      if (openMenu) {
        setOpenMenu(item.id);
      }
    };

    const handleSubItemClick = (menuId: string, subItem: MenuBarSubItem) => {
      if (subItem.disabled || subItem.separator) return;

      subItem.onClick?.();
      onItemSelect?.(menuId, subItem.id);
      setActiveMenu(null);
      setOpenMenu(null);
    };

    return (
      <div
        ref={ref}
        className={`xp-menu-bar ${className}`}
        role="menubar"
        data-testid={testId}
      >
        <div ref={menuBarRef} className="xp-menu-bar-items">
          {items.map((item) => (
            <div key={item.id} className="xp-menu-bar-item-container">
              <button
                className={`xp-menu-bar-item ${
                  activeMenu === item.id ? 'xp-menu-bar-item--active' : ''
                } ${item.disabled ? 'xp-menu-bar-item--disabled' : ''}`}
                onClick={() => handleMenuClick(item)}
                onMouseEnter={() => handleMenuHover(item)}
                disabled={item.disabled}
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={openMenu === item.id}
              >
                {item.label}
              </button>
              
              {openMenu === item.id && (
                <div
                  ref={(el) => (menuRefs.current[item.id] = el)}
                  className="xp-menu-bar-dropdown"
                >
                  <Menu>
                    {item.items.map((subItem) => (
                      <MenuItem
                        key={subItem.id}
                        icon={subItem.icon}
                        shortcut={subItem.shortcut}
                        separator={subItem.separator}
                        disabled={subItem.disabled}
                        onClick={() => handleSubItemClick(item.id, subItem)}
                      >
                        {subItem.label}
                      </MenuItem>
                    ))}
                  </Menu>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
);

MenuBar.displayName = 'MenuBar';
