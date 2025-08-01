/**
 * Taskbar Component
 * Windows XP taskbar with Start button, window buttons, and system tray
 */

import React, { useState, useEffect } from 'react';
import { TaskbarProps } from '../types';
import './Taskbar.css';

export const Taskbar: React.FC<TaskbarProps> = ({
  items = [],
  onStartClick,
  onItemClick,
  showClock = true,
  currentTime,
  className = '',
  children,
  'data-testid': testId = 'taskbar',
}) => {
  const [time, setTime] = useState(currentTime || new Date());

  // Update clock every second (only if no currentTime prop is provided)
  useEffect(() => {
    if (showClock && !currentTime) {
      const interval = setInterval(() => {
        setTime(new Date());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showClock, currentTime]);

  // Update time when currentTime prop changes
  useEffect(() => {
    if (currentTime) {
      setTime(currentTime);
    }
  }, [currentTime]);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleStartClick = () => {
    onStartClick?.();
  };

  const handleItemClick = (itemId: string) => {
    onItemClick?.(itemId);
  };

  const handleStartKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleStartClick();
    }
  };

  const handleItemKeyDown = (itemId: string, event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleItemClick(itemId);
    }
  };

  return (
    <div
      className={`taskbar ${className}`}
      data-testid={testId}
      role="navigation"
      aria-label="Taskbar"
    >
      {/* Start Button */}
      <button
        className="start-button"
        onClick={handleStartClick}
        onKeyDown={handleStartKeyDown}
        aria-label="Start menu"
        data-testid="start-button"
      >
        <div className="start-button-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect
              x="2"
              y="2"
              width="12"
              height="12"
              fill="currentColor"
              opacity="0.8"
            />
            <rect x="4" y="4" width="8" height="8" fill="currentColor" />
          </svg>
        </div>
        <span className="start-button-text">Start</span>
      </button>

      {/* Task Buttons */}
      <div className="task-buttons" role="group" aria-label="Open windows">
        {items.map(item => (
          <button
            key={item.id}
            className={`task-button ${item.isActive ? 'active' : ''} ${item.isMinimized ? 'minimized' : ''}`}
            onClick={() => handleItemClick(item.id)}
            onKeyDown={e => handleItemKeyDown(item.id, e)}
            aria-label={`${item.title} window`}
            aria-pressed={item.isActive}
            data-testid={`task-button-${item.id}`}
          >
            {item.icon && (
              <img
                src={item.icon}
                alt=""
                className="task-button-icon"
                role="presentation"
              />
            )}
            <span className="task-button-text">{item.title}</span>
          </button>
        ))}
      </div>

      {/* System Tray */}
      <div className="system-tray" role="group" aria-label="System tray">
        {/* Clock */}
        {showClock && (
          <div
            className="system-clock"
            aria-label={`Current time: ${formatTime(time)}`}
            data-testid="system-clock"
          >
            {formatTime(time)}
          </div>
        )}

        {/* Additional system tray items */}
        {children}
      </div>
    </div>
  );
};
