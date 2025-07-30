/**
 * WindowFrame Component
 * Reusable XP window chrome for sub-applications
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { WindowProps } from '../types';
import { useWindowResize, ResizeDirection } from '../../../hooks/useWindowResize';
import { useWindowBounds } from '../../../hooks/useWindowBounds';
import { useWindowAccessibility } from '../../../hooks/useWindowAccessibility';
import { WindowAnimationManager } from '../../../utils/windowAnimations';
import './WindowFrame.css';

const WindowFrameComponent: React.FC<WindowProps> = ({
  window,
  onClose,
  onMinimize,
  onMaximize,
  onRestore,
  onMove,
  onResize,
  onFocus,
  className = '',
  children,
  'data-testid': testId = 'window-frame',
}) => {
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const animationManager = useRef(WindowAnimationManager.getInstance());
  const previousWindow = useRef(window);

  // Initialize resize functionality
  const { isResizing, resizeDirection, handleResizeStart } = useWindowResize({
    windowId: window.id,
    currentPosition: window.position,
    currentSize: window.size,
    onResize,
    onMove,
  });

  // Initialize bounds management
  const { handleWindowMove } = useWindowBounds({
    enableSnapping: true,
    snapThreshold: 10,
  });

  // Initialize accessibility features
  const {
    handleWindowFocus,
    handleWindowKeyDown,
    updateWindowAccessibility,
    focusFirstElementInWindow
  } = useWindowAccessibility({
    windows: [window],
    enabled: true,
  });

  const handleTitleBarMouseDown = (event: React.MouseEvent) => {
    if (event.button === 0) {
      // Left mouse button
      setIsDragging(true);
      setDragOffset({
        x: event.clientX - window.position.x,
        y: event.clientY - window.position.y,
      });
      onFocus?.(window.id);
    }
  };

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (isDragging && onMove) {
        const newPosition = {
          x: event.clientX - dragOffset.x,
          y: event.clientY - dragOffset.y,
        };
        // Apply boundary constraints and snapping to window movement
        const constrainedPosition = handleWindowMove(newPosition, window.size, true);
        onMove(window.id, constrainedPosition);
      }
    },
    [isDragging, onMove, dragOffset.x, dragOffset.y, window.id, window.size, handleWindowMove]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging && onMove) {
      // Apply snapping when drag ends
      const snappedPosition = handleWindowMove(window.position, window.size, false);
      if (snappedPosition.x !== window.position.x || snappedPosition.y !== window.position.y) {
        onMove(window.id, snappedPosition);
      }
    }
    setIsDragging(false);
  }, [isDragging, onMove, handleWindowMove, window.position, window.size, window.id]);

  // Add global mouse event listeners for dragging
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset, onMove, handleMouseMove]);

  const handleClose = () => {
    onClose?.(window.id);
  };

  const handleMinimize = () => {
    onMinimize?.(window.id);
  };

  const handleMaximize = () => {
    if (window.isMaximized) {
      onRestore?.(window.id);
    } else {
      onMaximize?.(window.id);
    }
  };

  const handleWindowClick = () => {
    onFocus?.(window.id);
    handleWindowFocus(window.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Handle accessibility keyboard navigation
    if (handleWindowKeyDown(event, windowRef.current!)) {
      return;
    }

    // Handle keyboard shortcuts
    if (event.altKey && event.key === 'F4') {
      event.preventDefault();
      handleClose();
    }
  };

  const handleResizeMouseDown = (direction: ResizeDirection) => (event: React.MouseEvent) => {
    handleResizeStart(direction, event);
  };

  // Update accessibility attributes when window state changes
  useEffect(() => {
    if (windowRef.current) {
      updateWindowAccessibility(windowRef.current, window);
    }
  }, [window, updateWindowAccessibility]);

  // Focus first element when window becomes active
  useEffect(() => {
    if (window.isActive && windowRef.current && !isDragging && !isResizing) {
      // Small delay to ensure window is fully rendered
      setTimeout(() => {
        if (windowRef.current) {
          focusFirstElementInWindow(windowRef.current);
        }
      }, 100);
    }
  }, [window.isActive, isDragging, isResizing, focusFirstElementInWindow]);

  // Animate focus changes
  useEffect(() => {
    if (windowRef.current && previousWindow.current.isActive !== window.isActive) {
      animationManager.current.animateWindowFocus(windowRef.current, window.isActive);
    }
    previousWindow.current = window;
  }, [window.isActive]);

  // Animate window opening
  useEffect(() => {
    if (windowRef.current) {
      animationManager.current.animateWindowOpen(windowRef.current);
    }
  }, []); // Only run on mount

  if (window.isMinimized) {
    return null;
  }

  return (
    <div
      ref={windowRef}
      className={`window-frame ${window.isActive ? 'active' : 'inactive'} ${window.isMaximized ? 'maximized' : ''} ${className}`}
      style={{
        left: window.isMaximized ? 0 : window.position.x,
        top: window.isMaximized ? 0 : window.position.y,
        width: window.isMaximized ? '100%' : window.size.width,
        height: window.isMaximized ? 'calc(100vh - 30px)' : window.size.height,
        zIndex: window.zIndex,
      }}
      onClick={handleWindowClick}
      onKeyDown={handleKeyDown}
      data-testid={testId}
      role="dialog"
      aria-labelledby={`window-title-${window.id}`}
      tabIndex={-1}
    >
      {/* Title Bar */}
      <div
        className="window-title-bar"
        onMouseDown={handleTitleBarMouseDown}
        role="banner"
      >
        <div id={`window-title-${window.id}`} className="window-title">
          {window.title}
        </div>

        <div
          className="window-controls"
          role="group"
          aria-label="Window controls"
        >
          {/* Minimize Button */}
          <button
            className="window-control-button minimize"
            onClick={handleMinimize}
            aria-label="Minimize window"
            data-testid={`minimize-${window.id}`}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <rect x="1" y="6" width="6" height="1" fill="currentColor" />
            </svg>
          </button>

          {/* Maximize/Restore Button */}
          <button
            className="window-control-button maximize"
            onClick={handleMaximize}
            aria-label={
              window.isMaximized ? 'Restore window' : 'Maximize window'
            }
            data-testid={`maximize-${window.id}`}
          >
            {window.isMaximized ? (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <rect
                  x="1"
                  y="2"
                  width="5"
                  height="5"
                  stroke="currentColor"
                  fill="none"
                />
                <rect
                  x="2"
                  y="1"
                  width="5"
                  height="5"
                  stroke="currentColor"
                  fill="none"
                />
              </svg>
            ) : (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <rect
                  x="1"
                  y="1"
                  width="6"
                  height="6"
                  stroke="currentColor"
                  fill="none"
                />
              </svg>
            )}
          </button>

          {/* Close Button */}
          <button
            className="window-control-button close"
            onClick={handleClose}
            aria-label="Close window"
            data-testid={`close-${window.id}`}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path
                d="M1 1L7 7M7 1L1 7"
                stroke="currentColor"
                strokeWidth="1"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div className="window-content" role="main">
        {children}
      </div>

      {/* Resize Handles (only when not maximized) */}
      {!window.isMaximized && (
        <>
          <div
            className="resize-handle resize-n"
            data-direction="n"
            onMouseDown={handleResizeMouseDown('n')}
          />
          <div
            className="resize-handle resize-s"
            data-direction="s"
            onMouseDown={handleResizeMouseDown('s')}
          />
          <div
            className="resize-handle resize-e"
            data-direction="e"
            onMouseDown={handleResizeMouseDown('e')}
          />
          <div
            className="resize-handle resize-w"
            data-direction="w"
            onMouseDown={handleResizeMouseDown('w')}
          />
          <div
            className="resize-handle resize-ne"
            data-direction="ne"
            onMouseDown={handleResizeMouseDown('ne')}
          />
          <div
            className="resize-handle resize-nw"
            data-direction="nw"
            onMouseDown={handleResizeMouseDown('nw')}
          />
          <div
            className="resize-handle resize-se"
            data-direction="se"
            onMouseDown={handleResizeMouseDown('se')}
          />
          <div
            className="resize-handle resize-sw"
            data-direction="sw"
            onMouseDown={handleResizeMouseDown('sw')}
          />
        </>
      )}
    </div>
  );
};

// Memoize component for performance optimization
export const WindowFrame = memo(WindowFrameComponent, (prevProps, nextProps) => {
  // Custom comparison for performance optimization
  const prevWindow = prevProps.window;
  const nextWindow = nextProps.window;

  // Check if window properties that affect rendering have changed
  return (
    prevWindow.id === nextWindow.id &&
    prevWindow.title === nextWindow.title &&
    prevWindow.position.x === nextWindow.position.x &&
    prevWindow.position.y === nextWindow.position.y &&
    prevWindow.size.width === nextWindow.size.width &&
    prevWindow.size.height === nextWindow.size.height &&
    prevWindow.isMinimized === nextWindow.isMinimized &&
    prevWindow.isMaximized === nextWindow.isMaximized &&
    prevWindow.isActive === nextWindow.isActive &&
    prevWindow.zIndex === nextWindow.zIndex &&
    prevProps.className === nextProps.className &&
    prevProps.children === nextProps.children
  );
});
