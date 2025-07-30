/**
 * DesktopCanvas Component
 * Main desktop area with XP styling and icon management
 */

import React, { useState, useCallback } from 'react';
import { DesktopProps, DesktopIcon } from '../types';
import { accessibility } from '../../../styles/utils/accessibility';
import './DesktopCanvas.css';

export const DesktopCanvas: React.FC<DesktopProps> = ({
  icons = [],
  onIconSelect,
  onIconMove: _onIconMove,
  onDesktopClick,
  onDesktopContextMenu,
  className = '',
  children,
  'data-testid': testId = 'desktop-canvas',
}) => {
  const [selectedIcons, setSelectedIcons] = useState<Set<string>>(new Set());

  const handleDesktopClick = useCallback(
    (event: React.MouseEvent) => {
      // Clear selection when clicking on empty desktop
      if (event.target === event.currentTarget) {
        setSelectedIcons(new Set());
        onDesktopClick?.();
      }
    },
    [onDesktopClick]
  );

  const handleDesktopContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (event.target === event.currentTarget) {
        onDesktopContextMenu?.(event);
      }
    },
    [onDesktopContextMenu]
  );

  const handleIconClick = useCallback(
    (iconId: string, event: React.MouseEvent) => {
      event.stopPropagation();

      if (event.ctrlKey) {
        // Multi-select with Ctrl
        const newSelection = new Set(selectedIcons);
        if (newSelection.has(iconId)) {
          newSelection.delete(iconId);
        } else {
          newSelection.add(iconId);
        }
        setSelectedIcons(newSelection);
      } else {
        // Single select
        setSelectedIcons(new Set([iconId]));
      }

      onIconSelect?.(iconId);
    },
    [selectedIcons, onIconSelect]
  );

  const handleIconDoubleClick = useCallback(
    (icon: DesktopIcon, event: React.MouseEvent) => {
      event.stopPropagation();
      icon.onDoubleClick?.();
    },
    []
  );

  const handleIconKeyDown = useCallback(
    (icon: DesktopIcon, event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        icon.onDoubleClick?.();
      }
    },
    []
  );

  return (
    <div
      className={`desktop-canvas ${className}`}
      onClick={handleDesktopClick}
      onContextMenu={handleDesktopContextMenu}
      data-testid={testId}
      role="main"
      aria-label="Desktop"
    >
      {/* Desktop Icons */}
      {icons.map(icon => (
        <div
          key={icon.id}
          className={`desktop-icon ${selectedIcons.has(icon.id) ? 'selected' : ''}`}
          style={{
            left: icon.position.x,
            top: icon.position.y,
          }}
          onClick={e => handleIconClick(icon.id, e)}
          onDoubleClick={e => handleIconDoubleClick(icon, e)}
          onKeyDown={e => handleIconKeyDown(icon, e)}
          tabIndex={0}
          role="button"
          aria-label={`${icon.name} icon`}
          data-testid={`desktop-icon-${icon.id}`}
        >
          <div className="desktop-icon-image">
            <img src={icon.icon} alt="" role="presentation" />
          </div>
          <div className="desktop-icon-label">{icon.name}</div>
        </div>
      ))}

      {/* Child windows and other desktop content */}
      {children}

      {/* Screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={accessibility.srOnly}
        data-testid="desktop-announcer"
      >
        {selectedIcons.size > 0 &&
          `${selectedIcons.size} icon${selectedIcons.size > 1 ? 's' : ''} selected`}
      </div>
    </div>
  );
};
