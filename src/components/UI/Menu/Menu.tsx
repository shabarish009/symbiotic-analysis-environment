/**
 * XP Menu Component
 * Authentic Windows XP menu and menu items
 */

import React, { forwardRef } from 'react';
import './Menu.css';

export interface MenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  shortcut?: string;
  separator?: boolean;
  'data-testid'?: string;
}

export interface MenuProps {
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}

export const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(
  (
    {
      icon,
      shortcut,
      separator = false,
      className = '',
      children,
      disabled,
      'data-testid': testId,
      ...props
    },
    ref
  ) => {
    if (separator) {
      return (
        <div
          className="xp-menu-separator"
          role="separator"
          data-testid={testId}
        />
      );
    }

    return (
      <button
        ref={ref}
        className={`xp-menu-item ${disabled ? 'xp-menu-item--disabled' : ''} ${className}`}
        disabled={disabled}
        role="menuitem"
        data-testid={testId}
        {...props}
      >
        {icon && (
          <span className="xp-menu-item-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="xp-menu-item-text">{children}</span>
        {shortcut && (
          <span
            className="xp-menu-item-shortcut"
            aria-label={`Keyboard shortcut: ${shortcut}`}
          >
            {shortcut}
          </span>
        )}
      </button>
    );
  }
);

MenuItem.displayName = 'MenuItem';

export const Menu: React.FC<MenuProps> = ({
  children,
  className = '',
  'data-testid': testId,
}) => {
  return (
    <div className={`xp-menu ${className}`} role="menu" data-testid={testId}>
      {children}
    </div>
  );
};
