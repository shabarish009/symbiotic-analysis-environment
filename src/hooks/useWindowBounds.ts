/**
 * useWindowBounds Hook
 * Handles window boundary management, snapping, and cascading
 */

import { useCallback } from 'react';
import { 
  constrainWindowPosition, 
  getSnapPosition, 
  getCascadedPosition,
  bringWindowOnScreen,
  WindowBounds 
} from '../utils/windowConstraints';

interface UseWindowBoundsProps {
  enableSnapping?: boolean;
  snapThreshold?: number;
}

export const useWindowBounds = ({ 
  enableSnapping = true, 
  snapThreshold = 10 
}: UseWindowBoundsProps = {}) => {
  
  /**
   * Constrain window position to desktop boundaries
   */
  const constrainPosition = useCallback((
    position: { x: number; y: number },
    size: { width: number; height: number }
  ) => {
    return constrainWindowPosition(position, size, { snapZone: snapThreshold });
  }, [snapThreshold]);

  /**
   * Apply snapping logic to window position
   */
  const applySnapping = useCallback((
    position: { x: number; y: number },
    size: { width: number; height: number }
  ) => {
    if (!enableSnapping) {
      return position;
    }

    const snapPosition = getSnapPosition(position, size, { snapZone: snapThreshold });
    return snapPosition || position;
  }, [enableSnapping, snapThreshold]);

  /**
   * Get cascaded position for new window
   */
  const getCascadedWindowPosition = useCallback((
    existingWindows: WindowBounds[],
    defaultSize: { width: number; height: number }
  ) => {
    return getCascadedPosition(existingWindows, defaultSize);
  }, []);

  /**
   * Bring window back on screen if it's off-screen
   */
  const bringOnScreen = useCallback((
    position: { x: number; y: number },
    size: { width: number; height: number }
  ) => {
    return bringWindowOnScreen(position, size, { snapZone: snapThreshold });
  }, [snapThreshold]);

  /**
   * Handle window move with boundary constraints and snapping
   */
  const handleWindowMove = useCallback((
    position: { x: number; y: number },
    size: { width: number; height: number },
    isDragging: boolean = false
  ) => {
    // First constrain to boundaries
    let constrainedPosition = constrainPosition(position, size);
    
    // Apply snapping only when not actively dragging (on release)
    if (!isDragging && enableSnapping) {
      constrainedPosition = applySnapping(constrainedPosition, size);
    }

    return constrainedPosition;
  }, [constrainPosition, applySnapping, enableSnapping]);

  /**
   * Validate and fix window position on window resize
   */
  const validatePositionOnResize = useCallback((
    position: { x: number; y: number },
    oldSize: { width: number; height: number },
    newSize: { width: number; height: number }
  ) => {
    // Check if the new size would push window off-screen
    const constrainedPosition = constrainPosition(position, newSize);
    
    // If window was resized and position changed, apply snapping
    if (constrainedPosition.x !== position.x || constrainedPosition.y !== position.y) {
      return applySnapping(constrainedPosition, newSize);
    }

    return constrainedPosition;
  }, [constrainPosition, applySnapping]);

  return {
    constrainPosition,
    applySnapping,
    getCascadedWindowPosition,
    bringOnScreen,
    handleWindowMove,
    validatePositionOnResize,
  };
};
