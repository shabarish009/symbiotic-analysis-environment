/**
 * Tests for useWindowResize hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWindowResize } from '../useWindowResize';

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

describe('useWindowResize', () => {
  const mockOnResize = vi.fn();
  const mockOnMove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    windowId: 'test-window',
    currentPosition: { x: 100, y: 100 },
    currentSize: { width: 400, height: 300 },
    onResize: mockOnResize,
    onMove: mockOnMove,
  };

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useWindowResize(defaultProps));

    expect(result.current.isResizing).toBe(false);
    expect(result.current.resizeDirection).toBe(null);
    expect(typeof result.current.handleResizeStart).toBe('function');
  });

  it('should start resize operation', () => {
    const { result } = renderHook(() => useWindowResize(defaultProps));

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 200,
      clientY: 200,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart('se', mockEvent);
    });

    expect(result.current.isResizing).toBe(true);
    expect(result.current.resizeDirection).toBe('se');
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  it('should respect minimum size constraints', () => {
    const constraints = {
      minWidth: 200,
      minHeight: 100,
    };

    const { result } = renderHook(() => 
      useWindowResize({ ...defaultProps, constraints })
    );

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 200,
      clientY: 200,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart('se', mockEvent);
    });

    // Simulate mouse move that would make window too small
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: -50, // deltaX = -50-200 = -250, newWidth = 400-250 = 150 (below min 200)
      clientY: -50, // deltaY = -50-200 = -250, newHeight = 300-250 = 50 (below min 100)
    });

    act(() => {
      document.dispatchEvent(mouseMoveEvent);
    });

    // Should call onResize with constrained dimensions
    expect(mockOnResize).toHaveBeenCalledWith('test-window', {
      width: 200, // Constrained to minimum
      height: 100, // Constrained to minimum
    });
  });

  it('should respect maximum size constraints', () => {
    const constraints = {
      maxWidth: 800,
      maxHeight: 600,
    };

    const { result } = renderHook(() => 
      useWindowResize({ ...defaultProps, constraints })
    );

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 200,
      clientY: 200,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart('se', mockEvent);
    });

    // Simulate mouse move that would make window too large
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 1200, // Would make width 1000 (above maximum)
      clientY: 900,  // Would make height 700 (above maximum)
    });

    act(() => {
      document.dispatchEvent(mouseMoveEvent);
    });

    // Should call onResize with constrained dimensions
    expect(mockOnResize).toHaveBeenCalledWith('test-window', {
      width: 800, // Constrained to maximum
      height: 600, // Constrained to maximum
    });
  });

  it('should handle north resize direction correctly', () => {
    const { result } = renderHook(() => useWindowResize(defaultProps));

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 200,
      clientY: 200,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart('n', mockEvent);
    });

    // Simulate mouse move upward (should increase height and move window up)
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 200,
      clientY: 150, // Move up 50px
    });

    act(() => {
      document.dispatchEvent(mouseMoveEvent);
    });

    expect(mockOnResize).toHaveBeenCalledWith('test-window', {
      width: 400, // Width unchanged
      height: 350, // Height increased by 50
    });

    expect(mockOnMove).toHaveBeenCalledWith('test-window', {
      x: 100, // X unchanged
      y: 50,  // Y moved up by 50
    });
  });

  it('should handle west resize direction correctly', () => {
    const { result } = renderHook(() => useWindowResize(defaultProps));

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 200,
      clientY: 200,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart('w', mockEvent);
    });

    // Simulate mouse move left (should increase width and move window left)
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 150, // Move left 50px
      clientY: 200,
    });

    act(() => {
      document.dispatchEvent(mouseMoveEvent);
    });

    expect(mockOnResize).toHaveBeenCalledWith('test-window', {
      width: 450, // Width increased by 50
      height: 300, // Height unchanged
    });

    expect(mockOnMove).toHaveBeenCalledWith('test-window', {
      x: 50,  // X moved left by 50
      y: 100, // Y unchanged
    });
  });

  it('should stop resizing on mouse up', () => {
    const { result } = renderHook(() => useWindowResize(defaultProps));

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 200,
      clientY: 200,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart('se', mockEvent);
    });

    expect(result.current.isResizing).toBe(true);

    // Simulate mouse up
    const mouseUpEvent = new MouseEvent('mouseup');

    act(() => {
      document.dispatchEvent(mouseUpEvent);
    });

    expect(result.current.isResizing).toBe(false);
    expect(result.current.resizeDirection).toBe(null);
  });

  it('should prevent window from going off-screen during resize', () => {
    const { result } = renderHook(() => useWindowResize(defaultProps));

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 200,
      clientY: 200,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleResizeStart('nw', mockEvent);
    });

    // Simulate mouse move that would push window off-screen
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: -100, // Would move window off left edge
      clientY: -100, // Would move window off top edge
    });

    act(() => {
      document.dispatchEvent(mouseMoveEvent);
    });

    // Should constrain position to stay on screen
    expect(mockOnMove).toHaveBeenCalledWith('test-window', {
      x: 0, // Constrained to left edge
      y: 0, // Constrained to top edge
    });
  });
});
