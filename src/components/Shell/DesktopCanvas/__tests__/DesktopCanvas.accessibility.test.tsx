/**
 * DesktopCanvas Accessibility Tests
 * Comprehensive WCAG AA compliance testing for DesktopCanvas component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { DesktopCanvas } from '../DesktopCanvas';
import { DesktopIcon } from '../../types';
import { a11yTestSuite, keyboardTestUtils, screenReaderTestUtils, focusTestUtils } from '../../../../test/accessibility-utils';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('DesktopCanvas Accessibility', () => {
  const mockIcons: DesktopIcon[] = [
    {
      id: 'icon1',
      name: 'My Computer',
      icon: '/icons/computer.png',
      position: { x: 50, y: 50 },
      onDoubleClick: vi.fn(),
    },
    {
      id: 'icon2',
      name: 'Recycle Bin',
      icon: '/icons/recycle.png',
      position: { x: 50, y: 150 },
      onDoubleClick: vi.fn(),
    },
    {
      id: 'icon3',
      name: 'My Documents',
      icon: '/icons/documents.png',
      position: { x: 50, y: 250 },
      onDoubleClick: vi.fn(),
    },
  ];

  const defaultProps = {
    icons: mockIcons,
    onIconSelect: vi.fn(),
    onIconMove: vi.fn(),
    onDesktopClick: vi.fn(),
    onDesktopContextMenu: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WCAG AA Compliance', () => {
    it('should pass axe accessibility tests', async () => {
      const { container } = render(<DesktopCanvas {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should run complete accessibility audit', async () => {
      const renderResult = render(<DesktopCanvas {...defaultProps} />);
      await a11yTestSuite.runCompleteAudit(renderResult);
    });
  });

  describe('Semantic Structure and ARIA', () => {
    it('should have proper semantic structure', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const desktop = screen.getByRole('main');
      expect(desktop).toBeInTheDocument();
      expect(desktop).toHaveAttribute('aria-label', 'Desktop');
    });

    it('should have proper ARIA attributes for desktop icons', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const icons = screen.getAllByRole('button');
      expect(icons).toHaveLength(3);

      icons.forEach((icon, index) => {
        expect(icon).toHaveAttribute('aria-label', `${mockIcons[index].name} icon`);
        expect(icon).toHaveAttribute('tabindex', '0');
      });
    });

    it('should have proper image alt attributes', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const images = screen.getAllByRole('presentation');
      expect(images).toHaveLength(3);

      images.forEach(image => {
        expect(image).toHaveAttribute('alt', '');
        expect(image).toHaveAttribute('role', 'presentation');
      });
    });

    it('should have live region for announcements', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const announcer = screen.getByTestId('desktop-announcer');
      expect(announcer).toHaveAttribute('aria-live', 'polite');
      expect(announcer).toHaveAttribute('aria-atomic', 'true');
    });

    it('should validate ARIA relationships', () => {
      render(<DesktopCanvas {...defaultProps} />);
      const desktop = screen.getByRole('main');
      screenReaderTestUtils.validateARIAAttributes(desktop, {
        'role': 'main',
        'aria-label': 'Desktop',
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation through icons', async () => {
      const user = userEvent.setup();
      render(<DesktopCanvas {...defaultProps} />);
      
      const icons = screen.getAllByRole('button');
      
      // Focus first icon
      icons[0].focus();
      expect(document.activeElement).toBe(icons[0]);
      
      // Tab to next icon
      await user.tab();
      expect(document.activeElement).toBe(icons[1]);
      
      // Tab to next icon
      await user.tab();
      expect(document.activeElement).toBe(icons[2]);
    });

    it('should support keyboard activation with Enter key', async () => {
      const user = userEvent.setup();
      render(<DesktopCanvas {...defaultProps} />);
      
      const firstIcon = screen.getAllByRole('button')[0];
      firstIcon.focus();
      
      await user.keyboard('{Enter}');
      expect(mockIcons[0].onDoubleClick).toHaveBeenCalled();
    });

    it('should support keyboard activation with Space key', async () => {
      const user = userEvent.setup();
      render(<DesktopCanvas {...defaultProps} />);
      
      const firstIcon = screen.getAllByRole('button')[0];
      firstIcon.focus();
      
      await user.keyboard(' ');
      expect(mockIcons[0].onDoubleClick).toHaveBeenCalled();
    });

    it('should test keyboard navigation order', async () => {
      const { container } = render(<DesktopCanvas {...defaultProps} />);
      
      const expectedOrder = [
        '[data-testid="desktop-icon-icon1"]',
        '[data-testid="desktop-icon-icon2"]',
        '[data-testid="desktop-icon-icon3"]',
      ];
      
      await keyboardTestUtils.testTabNavigation(container, expectedOrder);
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce icon selection', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const firstIcon = screen.getAllByRole('button')[0];
      fireEvent.click(firstIcon);
      
      const announcer = screen.getByTestId('desktop-announcer');
      expect(announcer).toHaveTextContent('1 icon selected');
    });

    it('should announce multiple icon selection', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const icons = screen.getAllByRole('button');
      
      // Select first icon
      fireEvent.click(icons[0]);
      
      // Select second icon with Ctrl
      fireEvent.click(icons[1], { ctrlKey: true });
      
      const announcer = screen.getByTestId('desktop-announcer');
      expect(announcer).toHaveTextContent('2 icons selected');
    });

    it('should clear announcements when no icons selected', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const desktop = screen.getByRole('main');
      const firstIcon = screen.getAllByRole('button')[0];
      
      // Select icon
      fireEvent.click(firstIcon);
      
      // Click desktop to clear selection
      fireEvent.click(desktop);
      
      const announcer = screen.getByTestId('desktop-announcer');
      expect(announcer).toBeEmptyDOMElement();
    });

    it('should have proper semantic structure for screen readers', () => {
      const { container } = render(<DesktopCanvas {...defaultProps} />);
      screenReaderTestUtils.validateSemanticStructure(container);
    });
  });

  describe('Focus Management', () => {
    it('should have visible focus indicators', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const icons = screen.getAllByRole('button');
      icons.forEach(icon => {
        focusTestUtils.validateFocusIndicators(icon);
      });
    });

    it('should maintain focus when icons are selected', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const firstIcon = screen.getAllByRole('button')[0];
      firstIcon.focus();
      
      fireEvent.click(firstIcon);
      expect(document.activeElement).toBe(firstIcon);
    });

    it('should handle focus with keyboard selection', async () => {
      const user = userEvent.setup();
      render(<DesktopCanvas {...defaultProps} />);
      
      const firstIcon = screen.getAllByRole('button')[0];
      firstIcon.focus();
      
      await user.keyboard('{Enter}');
      expect(document.activeElement).toBe(firstIcon);
    });
  });

  describe('Mouse and Touch Interaction', () => {
    it('should handle single click selection', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const firstIcon = screen.getAllByRole('button')[0];
      fireEvent.click(firstIcon);
      
      expect(defaultProps.onIconSelect).toHaveBeenCalledWith('icon1');
    });

    it('should handle double click activation', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const firstIcon = screen.getAllByRole('button')[0];
      fireEvent.doubleClick(firstIcon);
      
      expect(mockIcons[0].onDoubleClick).toHaveBeenCalled();
    });

    it('should handle multi-select with Ctrl+click', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const icons = screen.getAllByRole('button');
      
      // Select first icon
      fireEvent.click(icons[0]);
      expect(defaultProps.onIconSelect).toHaveBeenCalledWith('icon1');
      
      // Add second icon to selection
      fireEvent.click(icons[1], { ctrlKey: true });
      expect(defaultProps.onIconSelect).toHaveBeenCalledWith('icon2');
    });

    it('should handle desktop click to clear selection', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const desktop = screen.getByRole('main');
      fireEvent.click(desktop);
      
      expect(defaultProps.onDesktopClick).toHaveBeenCalled();
    });

    it('should handle context menu', () => {
      render(<DesktopCanvas {...defaultProps} />);
      
      const desktop = screen.getByRole('main');
      fireEvent.contextMenu(desktop);
      
      expect(defaultProps.onDesktopContextMenu).toHaveBeenCalled();
    });
  });

  describe('High Contrast and User Preferences', () => {
    it('should support high contrast mode', () => {
      const { container } = render(<DesktopCanvas {...defaultProps} />);
      
      // Simulate high contrast mode
      container.classList.add('high-contrast-mode');
      
      const desktop = screen.getByRole('main');
      const styles = window.getComputedStyle(desktop);
      
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

      const { container } = render(<DesktopCanvas {...defaultProps} />);
      
      // Verify reduced motion styles are applied
      const desktop = screen.getByRole('main');
      desktop.classList.add('reduce-motion');
      
      const styles = window.getComputedStyle(desktop);
      expect(
        styles.animationDuration === '0s' ||
        styles.transitionDuration === '0s'
      ).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty icons array', async () => {
      const { container } = render(<DesktopCanvas {...defaultProps} icons={[]} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle icons without onDoubleClick', async () => {
      const iconsWithoutHandler = mockIcons.map(icon => ({
        ...icon,
        onDoubleClick: undefined,
      }));
      
      render(<DesktopCanvas {...defaultProps} icons={iconsWithoutHandler} />);
      
      const firstIcon = screen.getAllByRole('button')[0];
      fireEvent.doubleClick(firstIcon);
      
      // Should not throw error
      expect(firstIcon).toBeInTheDocument();
    });

    it('should handle missing icon images gracefully', () => {
      const iconsWithoutImages = mockIcons.map(icon => ({
        ...icon,
        icon: '',
      }));
      
      render(<DesktopCanvas {...defaultProps} icons={iconsWithoutImages} />);
      
      const icons = screen.getAllByRole('button');
      expect(icons).toHaveLength(3);
    });
  });
});
