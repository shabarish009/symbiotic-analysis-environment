/**
 * StartMenu Component
 * Windows XP Start Menu with authentic styling and behavior
 */

import React, { useEffect, useRef } from 'react';
import { StartMenuProps } from '../types';
import { a11yUtils } from '../../../styles/utils/accessibility';
import './StartMenu.css';

export const StartMenu: React.FC<StartMenuProps> = ({
  isOpen,
  items = [],
  onClose,
  onItemClick,
  userInfo,
  className = '',
  children,
  'data-testid': testId = 'start-menu',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const trapFocusRef = useRef<(() => void) | null>(null);

  // Handle focus trapping when menu is open
  useEffect(() => {
    if (isOpen && menuRef.current) {
      trapFocusRef.current = a11yUtils.trapFocus(menuRef.current);
    } else if (trapFocusRef.current) {
      trapFocusRef.current();
      trapFocusRef.current = null;
    }

    return () => {
      if (trapFocusRef.current) {
        trapFocusRef.current();
      }
    };
  }, [isOpen]);

  // Handle escape key to close menu
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleItemClick = (itemId: string) => {
    onItemClick?.(itemId);
    onClose?.();
  };

  const handleItemKeyDown = (itemId: string, event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleItemClick(itemId);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className={`start-menu ${className}`}
      data-testid={testId}
      role="menu"
      aria-label="Start menu"
    >
      {/* User Info Section */}
      {userInfo && (
        <div className="start-menu-user" role="banner">
          <div className="start-menu-user-avatar">
            {userInfo.avatar ? (
              <img src={userInfo.avatar} alt="" role="presentation" />
            ) : (
              <div className="default-avatar" aria-hidden="true">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="currentColor"
                >
                  <circle cx="16" cy="12" r="6" />
                  <path d="M4 26c0-6.627 5.373-12 12-12s12 5.373 12 12" />
                </svg>
              </div>
            )}
          </div>
          <div className="start-menu-user-name">{userInfo.name}</div>
        </div>
      )}

      {/* Menu Content */}
      <div className="start-menu-content">
        {/* Left Column - Frequently Used Programs */}
        <div className="start-menu-left" role="group" aria-label="Programs">
          {items
            .filter(item => !item.separator)
            .slice(0, 6)
            .map(item => (
              <button
                key={item.id}
                className="start-menu-item"
                onClick={() => handleItemClick(item.id)}
                onKeyDown={e => handleItemKeyDown(item.id, e)}
                role="menuitem"
                aria-label={item.label}
                data-testid={`start-menu-item-${item.id}`}
              >
                {item.icon && (
                  <img
                    src={item.icon}
                    alt=""
                    className="start-menu-item-icon"
                    role="presentation"
                  />
                )}
                <span className="start-menu-item-text">{item.label}</span>
                {item.shortcut && (
                  <span className="start-menu-item-shortcut">
                    {item.shortcut}
                  </span>
                )}
              </button>
            ))}
        </div>

        {/* Right Column - System Items */}
        <div className="start-menu-right" role="group" aria-label="System">
          {items
            .filter(item => !item.separator)
            .slice(6)
            .map(item => (
              <button
                key={item.id}
                className="start-menu-item system-item"
                onClick={() => handleItemClick(item.id)}
                onKeyDown={e => handleItemKeyDown(item.id, e)}
                role="menuitem"
                aria-label={item.label}
                data-testid={`start-menu-system-${item.id}`}
              >
                {item.icon && (
                  <img
                    src={item.icon}
                    alt=""
                    className="start-menu-item-icon"
                    role="presentation"
                  />
                )}
                <span className="start-menu-item-text">{item.label}</span>
              </button>
            ))}
        </div>
      </div>

      {/* Bottom Section - Power Options */}
      <div
        className="start-menu-bottom"
        role="group"
        aria-label="Power options"
      >
        <button
          className="start-menu-power-button"
          onClick={() => handleItemClick('logoff')}
          role="menuitem"
          aria-label="Log off"
          data-testid="start-menu-logoff"
        >
          Log Off
        </button>
        <button
          className="start-menu-power-button"
          onClick={() => handleItemClick('shutdown')}
          role="menuitem"
          aria-label="Turn off computer"
          data-testid="start-menu-shutdown"
        >
          Turn Off Computer
        </button>
      </div>

      {/* Additional content */}
      {children}
    </div>
  );
};
