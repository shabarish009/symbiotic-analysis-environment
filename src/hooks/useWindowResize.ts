/**
 * useWindowResize Hook
 * Handles window resize functionality with boundary constraints
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface ResizeState {
  isResizing: boolean;
  resizeDirection: ResizeDirection | null;
  startPosition: { x: number; y: number };
  startSize: { width: number; height: number };
  startWindowPosition: { x: number; y: number };
}

interface WindowConstraints {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  desktopBounds: {
    width: number;
    height: number;
  };
}

interface UseWindowResizeProps {
  windowId: string;
  currentPosition: { x: number; y: number };
  currentSize: { width: number; height: number };
  constraints?: Partial<WindowConstraints>;
  onResize?: (windowId: string, size: { width: number; height: number }) => void;
  onMove?: (windowId: string, position: { x: number; y: number }) => void;
}

const DEFAULT_CONSTRAINTS: WindowConstraints = {
  minWidth: 200,
  minHeight: 100,
  maxWidth: window.innerWidth,
  maxHeight: window.innerHeight - 30, // Account for taskbar
  desktopBounds: {
    width: window.innerWidth,
    height: window.innerHeight - 30,
  },
};

export const useWindowResize = ({
  windowId,
  currentPosition,
  currentSize,
  constraints = {},
  onResize,
  onMove,
}: UseWindowResizeProps) => {
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    resizeDirection: null,
    startPosition: { x: 0, y: 0 },
    startSize: { width: 0, height: 0 },
    startWindowPosition: { x: 0, y: 0 },
  });

  const finalConstraints = { ...DEFAULT_CONSTRAINTS, ...constraints };

  const handleResizeStart = useCallback(
    (direction: ResizeDirection, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      setResizeState({
        isResizing: true,
        resizeDirection: direction,
        startPosition: { x: event.clientX, y: event.clientY },
        startSize: { ...currentSize },
        startWindowPosition: { ...currentPosition },
      });
    },
    [currentSize, currentPosition]
  );

  const calculateNewDimensions = useCallback(
    (mouseX: number, mouseY: number) => {
      if (!resizeState.isResizing || !resizeState.resizeDirection) {
        return null;
      }

      const deltaX = mouseX - resizeState.startPosition.x;
      const deltaY = mouseY - resizeState.startPosition.y;
      const direction = resizeState.resizeDirection;

      let newWidth = resizeState.startSize.width;
      let newHeight = resizeState.startSize.height;
      let newX = resizeState.startWindowPosition.x;
      let newY = resizeState.startWindowPosition.y;

      // Handle horizontal resizing
      if (direction.includes('e')) {
        newWidth = resizeState.startSize.width + deltaX;
      } else if (direction.includes('w')) {
        newWidth = resizeState.startSize.width - deltaX;
        newX = resizeState.startWindowPosition.x + deltaX;
      }

      // Handle vertical resizing
      if (direction.includes('s')) {
        newHeight = resizeState.startSize.height + deltaY;
      } else if (direction.includes('n')) {
        newHeight = resizeState.startSize.height - deltaY;
        newY = resizeState.startWindowPosition.y + deltaY;
      }

      // Apply constraints
      const constrainedWidth = Math.max(
        finalConstraints.minWidth,
        Math.min(finalConstraints.maxWidth, newWidth)
      );
      const constrainedHeight = Math.max(
        finalConstraints.minHeight,
        Math.min(finalConstraints.maxHeight, newHeight)
      );

      // Adjust position if size was constrained and we're resizing from top/left
      if (direction.includes('w') && constrainedWidth !== newWidth) {
        newX = resizeState.startWindowPosition.x + (resizeState.startSize.width - constrainedWidth);
      }
      if (direction.includes('n') && constrainedHeight !== newHeight) {
        newY = resizeState.startWindowPosition.y + (resizeState.startSize.height - constrainedHeight);
      }

      // Ensure window doesn't go off-screen
      newX = Math.max(0, Math.min(newX, finalConstraints.desktopBounds.width - constrainedWidth));
      newY = Math.max(0, Math.min(newY, finalConstraints.desktopBounds.height - constrainedHeight));

      return {
        size: { width: constrainedWidth, height: constrainedHeight },
        position: { x: newX, y: newY },
      };
    },
    [resizeState, finalConstraints]
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!resizeState.isResizing) return;

      const newDimensions = calculateNewDimensions(event.clientX, event.clientY);
      if (newDimensions) {
        onResize?.(windowId, newDimensions.size);
        
        // Only move window if position changed (for n/w/nw/ne/sw resizing)
        if (
          newDimensions.position.x !== currentPosition.x ||
          newDimensions.position.y !== currentPosition.y
        ) {
          onMove?.(windowId, newDimensions.position);
        }
      }
    },
    [resizeState.isResizing, calculateNewDimensions, onResize, onMove, windowId, currentPosition]
  );

  const handleMouseUp = useCallback(() => {
    setResizeState(prev => ({
      ...prev,
      isResizing: false,
      resizeDirection: null,
    }));
  }, []);

  // Add global mouse event listeners when resizing
  useEffect(() => {
    if (resizeState.isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = `${resizeState.resizeDirection}-resize`;
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [resizeState.isResizing, handleMouseMove, handleMouseUp, resizeState.resizeDirection]);

  return {
    isResizing: resizeState.isResizing,
    resizeDirection: resizeState.resizeDirection,
    handleResizeStart,
  };
};
