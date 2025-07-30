/**
 * Tests for WindowFrame component
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WindowFrame } from '../WindowFrame';
import { WindowState } from '../../types';

// Mock the hooks
vi.mock('../../../../hooks/useWindowResize', () => ({
  useWindowResize: () => ({
    isResizing: false,
    resizeDirection: null,
    handleResizeStart: vi.fn(),
  }),
}));

vi.mock('../../../../hooks/useWindowBounds', () => ({
  useWindowBounds: () => ({
    handleWindowMove: vi.fn((pos) => pos),
  }),
}));

vi.mock('../../../../hooks/useWindowAccessibility', () => ({
  useWindowAccessibility: () => ({
    handleWindowFocus: vi.fn(),
    handleWindowKeyDown: vi.fn(),
    updateWindowAccessibility: vi.fn(),
    focusFirstElementInWindow: vi.fn(),
  }),
}));

describe('WindowFrame', () => {
  const mockWindow: WindowState = {
    id: 'test-window',
    title: 'Test Window',
    position: { x: 100, y: 100 },
    size: { width: 400, height: 300 },
    isMinimized: false,
    isMaximized: false,
    isActive: true,
    zIndex: 1000,
  };

  const mockProps = {
    window: mockWindow,
    onClose: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onRestore: vi.fn(),
    onMove: vi.fn(),
    onResize: vi.fn(),
    onFocus: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render window with correct title', () => {
    render(
      <WindowFrame {...mockProps}>
        <div>Window Content</div>
      </WindowFrame>
    );

    expect(screen.getByText('Test Window')).toBeInTheDocument();
    expect(screen.getByText('Window Content')).toBeInTheDocument();
  });

  it('should apply correct positioning and sizing styles', () => {
    render(
      <WindowFrame {...mockProps}>
        <div>Content</div>
      </WindowFrame>
    );

    const windowElement = screen.getByRole('dialog');
    expect(windowElement).toHaveStyle({
      left: '100px',
      top: '100px',
      width: '400px',
      height: '300px',
      zIndex: '1000',
    });
  });

  it('should show active state styling', () => {
    render(
      <WindowFrame {...mockProps}>
        <div>Content</div>
      </WindowFrame>
    );

    const windowElement = screen.getByRole('dialog');
    expect(windowElement).toHaveClass('active');
    expect(windowElement).not.toHaveClass('inactive');
  });

  it('should show inactive state styling', () => {
    const inactiveWindow = { ...mockWindow, isActive: false };
    
    render(
      <WindowFrame {...mockProps} window={inactiveWindow}>
        <div>Content</div>
      </WindowFrame>
    );

    const windowElement = screen.getByRole('dialog');
    expect(windowElement).toHaveClass('inactive');
    expect(windowElement).not.toHaveClass('active');
  });

  it('should handle window close', async () => {
    const user = userEvent.setup();
    
    render(
      <WindowFrame {...mockProps}>
        <div>Content</div>
      </WindowFrame>
    );

    const closeButton = screen.getByLabelText('Close window');
    await user.click(closeButton);

    expect(mockProps.onClose).toHaveBeenCalledWith('test-window');
  });

  it('should handle window minimize', async () => {
    const user = userEvent.setup();
    
    render(
      <WindowFrame {...mockProps}>
        <div>Content</div>
      </WindowFrame>
    );

    const minimizeButton = screen.getByLabelText('Minimize window');
    await user.click(minimizeButton);

    expect(mockProps.onMinimize).toHaveBeenCalledWith('test-window');
  });

  it('should handle window maximize', async () => {
    const user = userEvent.setup();
    
    render(
      <WindowFrame {...mockProps}>
        <div>Content</div>
      </WindowFrame>
    );

    const maximizeButton = screen.getByLabelText('Maximize window');
    await user.click(maximizeButton);

    expect(mockProps.onMaximize).toHaveBeenCalledWith('test-window');
  });

  it('should handle window restore when maximized', async () => {
    const user = userEvent.setup();
    const maximizedWindow = { ...mockWindow, isMaximized: true };
    
    render(
      <WindowFrame {...mockProps} window={maximizedWindow}>
        <div>Content</div>
      </WindowFrame>
    );

    const restoreButton = screen.getByLabelText('Restore window');
    await user.click(restoreButton);

    expect(mockProps.onRestore).toHaveBeenCalledWith('test-window');
  });

  it('should handle Alt+F4 keyboard shortcut', async () => {
    render(
      <WindowFrame {...mockProps}>
        <div>Content</div>
      </WindowFrame>
    );

    const windowElement = screen.getByRole('dialog');
    fireEvent.keyDown(windowElement, { key: 'F4', altKey: true });

    expect(mockProps.onClose).toHaveBeenCalledWith('test-window');
  });

  it('should handle window focus on click', async () => {
    const user = userEvent.setup();
    
    render(
      <WindowFrame {...mockProps}>
        <div>Content</div>
      </WindowFrame>
    );

    const windowElement = screen.getByRole('dialog');
    await user.click(windowElement);

    expect(mockProps.onFocus).toHaveBeenCalledWith('test-window');
  });

  it('should not render when minimized', () => {
    const minimizedWindow = { ...mockWindow, isMinimized: true };
    
    render(
      <WindowFrame {...mockProps} window={minimizedWindow}>
        <div>Content</div>
      </WindowFrame>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should apply maximized styles when maximized', () => {
    const maximizedWindow = { ...mockWindow, isMaximized: true };
    
    render(
      <WindowFrame {...mockProps} window={maximizedWindow}>
        <div>Content</div>
      </WindowFrame>
    );

    const windowElement = screen.getByRole('dialog');
    expect(windowElement).toHaveClass('maximized');
    expect(windowElement).toHaveStyle({
      left: '0px',
      top: '0px',
      width: '100%',
      height: 'calc(100vh - 30px)',
    });
  });

  it('should render resize handles when not maximized', () => {
    render(
      <WindowFrame {...mockProps}>
        <div>Content</div>
      </WindowFrame>
    );

    expect(screen.getByTestId('window-frame')).toContainElement(
      document.querySelector('.resize-handle.resize-n')
    );
    expect(screen.getByTestId('window-frame')).toContainElement(
      document.querySelector('.resize-handle.resize-s')
    );
    expect(screen.getByTestId('window-frame')).toContainElement(
      document.querySelector('.resize-handle.resize-e')
    );
    expect(screen.getByTestId('window-frame')).toContainElement(
      document.querySelector('.resize-handle.resize-w')
    );
  });

  it('should not render resize handles when maximized', () => {
    const maximizedWindow = { ...mockWindow, isMaximized: true };
    
    render(
      <WindowFrame {...mockProps} window={maximizedWindow}>
        <div>Content</div>
      </WindowFrame>
    );

    expect(document.querySelector('.resize-handle')).not.toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(
      <WindowFrame {...mockProps}>
        <div>Content</div>
      </WindowFrame>
    );

    const windowElement = screen.getByRole('dialog');
    expect(windowElement).toHaveAttribute('aria-labelledby', 'window-title-test-window');
    expect(windowElement).toHaveAttribute('tabIndex', '-1');

    const titleElement = screen.getByText('Test Window');
    expect(titleElement).toHaveAttribute('id', 'window-title-test-window');

    const controlsGroup = screen.getByRole('group', { name: 'Window controls' });
    expect(controlsGroup).toBeInTheDocument();
  });

  it('should handle custom className', () => {
    render(
      <WindowFrame {...mockProps} className="custom-class">
        <div>Content</div>
      </WindowFrame>
    );

    const windowElement = screen.getByRole('dialog');
    expect(windowElement).toHaveClass('custom-class');
  });

  it('should handle custom testId', () => {
    render(
      <WindowFrame {...mockProps} data-testid="custom-window">
        <div>Content</div>
      </WindowFrame>
    );

    expect(screen.getByTestId('custom-window')).toBeInTheDocument();
  });
});
