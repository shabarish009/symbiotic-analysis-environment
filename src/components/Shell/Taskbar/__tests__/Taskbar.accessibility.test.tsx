/**
 * Taskbar Accessibility Tests
 * Comprehensive WCAG AA compliance testing for Taskbar component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Taskbar } from '../Taskbar';
import { TaskbarItem } from '../../types';
import { a11yTestSuite, keyboardTestUtils, screenReaderTestUtils, focusTestUtils } from '../../../../test/accessibility-utils';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Taskbar Accessibility', () => {
  const mockItems: TaskbarItem[] = [
    {
      id: 'window1',
      title: 'My Computer',
      icon: '/icons/computer.png',
      isActive: true,
      isMinimized: false,
    },
    {
      id: 'window2',
      title: 'Notepad',
      icon: '/icons/notepad.png',
      isActive: false,
      isMinimized: false,
    },
    {
      id: 'window3',
      title: 'Calculator',
      icon: '/icons/calculator.png',
      isActive: false,
      isMinimized: true,
    },
  ];

  const defaultProps = {
    items: mockItems,
    onStartClick: vi.fn(),
    onItemClick: vi.fn(),
    showClock: true,
    currentTime: new Date('2023-12-25T10:30:00'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WCAG AA Compliance', () => {
    it('should pass axe accessibility tests', async () => {
      const { container } = render(<Taskbar {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should run complete accessibility audit', async () => {
      const renderResult = render(<Taskbar {...defaultProps} />);
      await a11yTestSuite.runCompleteAudit(renderResult);
    });
  });

  describe('Semantic Structure and ARIA', () => {
    it('should have proper semantic structure', () => {
      render(<Taskbar {...defaultProps} />);
      
      const taskbar = screen.getByRole('navigation');
      expect(taskbar).toBeInTheDocument();
      expect(taskbar).toHaveAttribute('aria-label', 'Taskbar');
    });

    it('should have proper ARIA attributes for Start button', () => {
      render(<Taskbar {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: 'Start menu' });
      expect(startButton).toBeInTheDocument();
      expect(startButton).toHaveAttribute('aria-label', 'Start menu');
    });

    it('should have proper ARIA attributes for task buttons', () => {
      render(<Taskbar {...defaultProps} />);
      
      const taskButtons = screen.getAllByRole('button').filter(button => 
        button.getAttribute('aria-label')?.includes('window')
      );
      
      expect(taskButtons).toHaveLength(3);
      
      taskButtons.forEach((button, index) => {
        const item = mockItems[index];
        expect(button).toHaveAttribute('aria-label', `${item.title} window`);
        expect(button).toHaveAttribute('aria-pressed', item.isActive.toString());
      });
    });

    it('should have proper group roles', () => {
      render(<Taskbar {...defaultProps} />);
      
      const taskButtonsGroup = screen.getByRole('group', { name: 'Open windows' });
      expect(taskButtonsGroup).toBeInTheDocument();
      
      const systemTrayGroup = screen.getByRole('group', { name: 'System tray' });
      expect(systemTrayGroup).toBeInTheDocument();
    });

    it('should have proper clock accessibility', () => {
      render(<Taskbar {...defaultProps} />);
      
      const clock = screen.getByTestId('system-clock');
      expect(clock).toHaveAttribute('aria-label', 'Current time: 10:30 AM');
    });

    it('should have proper image alt attributes', () => {
      render(<Taskbar {...defaultProps} />);
      
      const images = screen.getAllByRole('presentation');
      images.forEach(image => {
        expect(image).toHaveAttribute('alt', '');
        expect(image).toHaveAttribute('role', 'presentation');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation through all buttons', async () => {
      const user = userEvent.setup();
      render(<Taskbar {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      
      // Focus first button (Start button)
      buttons[0].focus();
      expect(document.activeElement).toBe(buttons[0]);
      
      // Tab through all buttons
      for (let i = 1; i < buttons.length; i++) {
        await user.tab();
        expect(document.activeElement).toBe(buttons[i]);
      }
    });

    it('should support keyboard activation with Enter key', async () => {
      const user = userEvent.setup();
      render(<Taskbar {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: 'Start menu' });
      startButton.focus();
      
      await user.keyboard('{Enter}');
      expect(defaultProps.onStartClick).toHaveBeenCalled();
    });

    it('should support keyboard activation with Space key', async () => {
      const user = userEvent.setup();
      render(<Taskbar {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: 'Start menu' });
      startButton.focus();
      
      await user.keyboard(' ');
      expect(defaultProps.onStartClick).toHaveBeenCalled();
    });

    it('should support keyboard activation for task buttons', async () => {
      const user = userEvent.setup();
      render(<Taskbar {...defaultProps} />);
      
      const taskButton = screen.getByRole('button', { name: 'My Computer window' });
      taskButton.focus();
      
      await user.keyboard('{Enter}');
      expect(defaultProps.onItemClick).toHaveBeenCalledWith('window1');
    });

    it('should test keyboard navigation order', async () => {
      const { container } = render(<Taskbar {...defaultProps} />);
      
      const expectedOrder = [
        '[data-testid="start-button"]',
        '[data-testid="task-button-window1"]',
        '[data-testid="task-button-window2"]',
        '[data-testid="task-button-window3"]',
      ];
      
      await keyboardTestUtils.testTabNavigation(container, expectedOrder);
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce button states correctly', () => {
      render(<Taskbar {...defaultProps} />);
      
      const activeButton = screen.getByRole('button', { name: 'My Computer window' });
      expect(activeButton).toHaveAttribute('aria-pressed', 'true');
      
      const inactiveButton = screen.getByRole('button', { name: 'Notepad window' });
      expect(inactiveButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should have proper semantic structure for screen readers', () => {
      const { container } = render(<Taskbar {...defaultProps} />);
      screenReaderTestUtils.validateSemanticStructure(container);
    });

    it('should announce time updates', () => {
      const { rerender } = render(<Taskbar {...defaultProps} />);
      
      const newTime = new Date('2023-12-25T10:31:00');
      rerender(<Taskbar {...defaultProps} currentTime={newTime} />);
      
      const clock = screen.getByTestId('system-clock');
      expect(clock).toHaveAttribute('aria-label', 'Current time: 10:31 AM');
    });
  });

  describe('Focus Management', () => {
    it('should have visible focus indicators', () => {
      render(<Taskbar {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        focusTestUtils.validateFocusIndicators(button);
      });
    });

    it('should maintain focus when buttons are clicked', () => {
      render(<Taskbar {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: 'Start menu' });
      startButton.focus();
      
      fireEvent.click(startButton);
      expect(document.activeElement).toBe(startButton);
    });

    it('should handle focus with keyboard activation', async () => {
      const user = userEvent.setup();
      render(<Taskbar {...defaultProps} />);
      
      const taskButton = screen.getByRole('button', { name: 'Notepad window' });
      taskButton.focus();
      
      await user.keyboard('{Enter}');
      expect(document.activeElement).toBe(taskButton);
    });
  });

  describe('Mouse and Touch Interaction', () => {
    it('should handle Start button click', () => {
      render(<Taskbar {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: 'Start menu' });
      fireEvent.click(startButton);
      
      expect(defaultProps.onStartClick).toHaveBeenCalled();
    });

    it('should handle task button clicks', () => {
      render(<Taskbar {...defaultProps} />);
      
      const taskButton = screen.getByRole('button', { name: 'My Computer window' });
      fireEvent.click(taskButton);
      
      expect(defaultProps.onItemClick).toHaveBeenCalledWith('window1');
    });

    it('should handle multiple task button clicks', () => {
      render(<Taskbar {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button').filter(button => 
        button.getAttribute('aria-label')?.includes('window')
      );
      
      buttons.forEach((button, index) => {
        fireEvent.click(button);
        expect(defaultProps.onItemClick).toHaveBeenCalledWith(mockItems[index].id);
      });
    });
  });

  describe('Clock Functionality', () => {
    it('should display clock when enabled', () => {
      render(<Taskbar {...defaultProps} showClock={true} />);
      
      const clock = screen.getByTestId('system-clock');
      expect(clock).toBeInTheDocument();
      expect(clock).toHaveTextContent('10:30 AM');
    });

    it('should hide clock when disabled', () => {
      render(<Taskbar {...defaultProps} showClock={false} />);
      
      const clock = screen.queryByTestId('system-clock');
      expect(clock).not.toBeInTheDocument();
    });

    it('should update clock accessibility label', () => {
      const { rerender } = render(<Taskbar {...defaultProps} />);
      
      const newTime = new Date('2023-12-25T14:45:00');
      rerender(<Taskbar {...defaultProps} currentTime={newTime} />);
      
      const clock = screen.getByTestId('system-clock');
      expect(clock).toHaveAttribute('aria-label', 'Current time: 2:45 PM');
    });
  });

  describe('High Contrast and User Preferences', () => {
    it('should support high contrast mode', () => {
      const { container } = render(<Taskbar {...defaultProps} />);
      
      // Simulate high contrast mode
      container.classList.add('high-contrast-mode');
      
      const taskbar = screen.getByRole('navigation');
      const styles = window.getComputedStyle(taskbar);
      
      expect(styles.backgroundColor).not.toBe('transparent');
      expect(styles.color).not.toBe('transparent');
    });

    it('should respect reduced motion preferences', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const { container } = render(<Taskbar {...defaultProps} />);
      
      // Verify reduced motion styles are applied
      const taskbar = screen.getByRole('navigation');
      taskbar.classList.add('reduce-motion');
      
      const styles = window.getComputedStyle(taskbar);
      expect(
        styles.animationDuration === '0s' ||
        styles.transitionDuration === '0s'
      ).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty items array', async () => {
      const { container } = render(<Taskbar {...defaultProps} items={[]} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle items without icons', () => {
      const itemsWithoutIcons = mockItems.map(item => ({
        ...item,
        icon: undefined,
      }));
      
      render(<Taskbar {...defaultProps} items={itemsWithoutIcons} />);
      
      const taskButtons = screen.getAllByRole('button').filter(button => 
        button.getAttribute('aria-label')?.includes('window')
      );
      
      expect(taskButtons).toHaveLength(3);
    });

    it('should handle missing callbacks gracefully', () => {
      render(
        <Taskbar 
          {...defaultProps} 
          onStartClick={undefined}
          onItemClick={undefined}
        />
      );
      
      const startButton = screen.getByRole('button', { name: 'Start menu' });
      fireEvent.click(startButton);
      
      // Should not throw error
      expect(startButton).toBeInTheDocument();
    });

    it('should handle invalid time gracefully', () => {
      render(<Taskbar {...defaultProps} currentTime={new Date('invalid')} />);
      
      const clock = screen.getByTestId('system-clock');
      expect(clock).toBeInTheDocument();
    });
  });
});
