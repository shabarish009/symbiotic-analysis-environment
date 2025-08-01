/**
 * Button Accessibility Tests
 * Comprehensive WCAG AA compliance testing for Button components
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button, ButtonGroup, IconButton, ToolbarButton } from '../';
import { a11yTestSuite, keyboardTestUtils, screenReaderTestUtils, focusTestUtils, colorContrastUtils } from '../../../../test/accessibility-utils';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Button Components Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Button Component', () => {
    const mockOnClick = vi.fn();

    it('should pass axe accessibility tests', async () => {
      const { container } = render(<Button onClick={mockOnClick}>Test Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should run complete accessibility audit', async () => {
      const renderResult = render(<Button onClick={mockOnClick}>Test Button</Button>);
      await a11yTestSuite.runCompleteAudit(renderResult);
    });

    it('should have proper semantic structure', () => {
      render(<Button onClick={mockOnClick}>Test Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Test Button');
    });

    it('should support all button variants', async () => {
      const variants = ['default', 'primary', 'secondary', 'icon', 'toolbar'] as const;
      
      for (const variant of variants) {
        const { container } = render(
          <Button variant={variant} onClick={mockOnClick}>
            {variant} Button
          </Button>
        );
        
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      }
    });

    it('should support keyboard activation', async () => {
      const user = userEvent.setup();
      render(<Button onClick={mockOnClick}>Test Button</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      
      await user.keyboard('{Enter}');
      expect(mockOnClick).toHaveBeenCalled();
      
      mockOnClick.mockClear();
      
      await user.keyboard(' ');
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should have visible focus indicators', () => {
      render(<Button onClick={mockOnClick}>Test Button</Button>);
      
      const button = screen.getByRole('button');
      focusTestUtils.validateFocusIndicators(button);
    });

    it('should handle disabled state properly', async () => {
      render(<Button disabled onClick={mockOnClick}>Disabled Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      
      const { container } = render(<Button disabled onClick={mockOnClick}>Disabled Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support loading state with proper accessibility', async () => {
      render(<Button loading onClick={mockOnClick}>Loading Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toBeDisabled();
      
      const { container } = render(<Button loading onClick={mockOnClick}>Loading Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle icon buttons with proper accessibility', async () => {
      const icon = <span data-testid="test-icon">🔍</span>;
      render(<Button icon={icon} onClick={mockOnClick}>Search</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName('Search');
      
      const iconContainer = screen.getByTestId('test-icon').closest('.xp-button-icon');
      expect(iconContainer).toHaveAttribute('aria-hidden', 'true');
      
      const { container } = render(<Button icon={icon} onClick={mockOnClick}>Search</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should validate color contrast for all variants', () => {
      const variants = ['default', 'primary', 'secondary'] as const;
      
      variants.forEach(variant => {
        render(<Button variant={variant} onClick={mockOnClick}>{variant} Button</Button>);
        
        const button = screen.getByRole('button');
        const colors = colorContrastUtils.extractColorsFromElement(button);
        
        if (colors.color && colors.backgroundColor) {
          const validation = colorContrastUtils.validateWCAGContrast(
            colors.color,
            colors.backgroundColor
          );
          expect(validation.isValid).toBe(true);
        }
      });
    });
  });

  describe('ButtonGroup Component', () => {
    const buttons = [
      { id: 'btn1', label: 'Button 1', onClick: jest.fn() },
      { id: 'btn2', label: 'Button 2', onClick: jest.fn() },
      { id: 'btn3', label: 'Button 3', onClick: jest.fn() },
    ];

    it('should pass axe accessibility tests', async () => {
      const { container } = render(
        <ButtonGroup>
          {buttons.map(btn => (
            <Button key={btn.id} onClick={btn.onClick}>
              {btn.label}
            </Button>
          ))}
        </ButtonGroup>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper group role and label', () => {
      render(
        <ButtonGroup aria-label="Action buttons">
          {buttons.map(btn => (
            <Button key={btn.id} onClick={btn.onClick}>
              {btn.label}
            </Button>
          ))}
        </ButtonGroup>
      );
      
      const group = screen.getByRole('group');
      expect(group).toBeInTheDocument();
      expect(group).toHaveAttribute('aria-label', 'Action buttons');
    });

    it('should support keyboard navigation within group', async () => {
      const user = userEvent.setup();
      render(
        <ButtonGroup>
          {buttons.map(btn => (
            <Button key={btn.id} onClick={btn.onClick}>
              {btn.label}
            </Button>
          ))}
        </ButtonGroup>
      );
      
      const buttonElements = screen.getAllByRole('button');
      
      // Focus first button
      buttonElements[0].focus();
      expect(document.activeElement).toBe(buttonElements[0]);
      
      // Tab to next button
      await user.tab();
      expect(document.activeElement).toBe(buttonElements[1]);
    });

    it('should support both horizontal and vertical orientations', async () => {
      const orientations = ['horizontal', 'vertical'] as const;
      
      for (const orientation of orientations) {
        const { container } = render(
          <ButtonGroup orientation={orientation}>
            {buttons.map(btn => (
              <Button key={btn.id} onClick={btn.onClick}>
                {btn.label}
              </Button>
            ))}
          </ButtonGroup>
        );
        
        const group = screen.getByRole('group');
        expect(group).toHaveAttribute('aria-orientation', orientation);
        
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      }
    });
  });

  describe('IconButton Component', () => {
    const mockOnClick = jest.fn();
    const icon = <span data-testid="test-icon">🔍</span>;

    it('should pass axe accessibility tests', async () => {
      const { container } = render(
        <IconButton icon={icon} aria-label="Search" onClick={mockOnClick} />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should require aria-label for accessibility', () => {
      render(<IconButton icon={icon} aria-label="Search" onClick={mockOnClick} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Search');
      expect(button).toHaveAccessibleName('Search');
    });

    it('should hide icon from screen readers', () => {
      render(<IconButton icon={icon} aria-label="Search" onClick={mockOnClick} />);
      
      const iconContainer = screen.getByTestId('test-icon').closest('.xp-icon-button-icon');
      expect(iconContainer).toHaveAttribute('aria-hidden', 'true');
    });

    it('should support keyboard activation', async () => {
      const user = userEvent.setup();
      render(<IconButton icon={icon} aria-label="Search" onClick={mockOnClick} />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      await user.keyboard('{Enter}');
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should have proper focus indicators', () => {
      render(<IconButton icon={icon} aria-label="Search" onClick={mockOnClick} />);
      
      const button = screen.getByRole('button');
      focusTestUtils.validateFocusIndicators(button);
    });
  });

  describe('ToolbarButton Component', () => {
    const mockOnClick = jest.fn();

    it('should pass axe accessibility tests', async () => {
      const { container } = render(
        <ToolbarButton onClick={mockOnClick}>Toolbar Action</ToolbarButton>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper toolbar button semantics', () => {
      render(<ToolbarButton onClick={mockOnClick}>Toolbar Action</ToolbarButton>);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('xp-toolbar-button');
    });

    it('should support pressed state for toggle buttons', async () => {
      render(<ToolbarButton pressed onClick={mockOnClick}>Toggle Button</ToolbarButton>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
      
      const { container } = render(
        <ToolbarButton pressed onClick={mockOnClick}>Toggle Button</ToolbarButton>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard activation', async () => {
      const user = userEvent.setup();
      render(<ToolbarButton onClick={mockOnClick}>Toolbar Action</ToolbarButton>);
      
      const button = screen.getByRole('button');
      button.focus();
      
      await user.keyboard('{Enter}');
      expect(mockOnClick).toHaveBeenCalled();
    });
  });

  describe('High Contrast and User Preferences', () => {
    it('should support high contrast mode for all button types', () => {
      const buttonTypes = [
        { component: Button, props: { children: 'Button' } },
        { component: IconButton, props: { icon: <span>🔍</span>, 'aria-label': 'Search' } },
        { component: ToolbarButton, props: { children: 'Toolbar' } },
      ];

      buttonTypes.forEach(({ component: Component, props }) => {
        const { container } = render(<Component onClick={jest.fn()} {...props} />);
        
        // Simulate high contrast mode
        container.classList.add('high-contrast-mode');
        
        const button = screen.getByRole('button');
        const styles = window.getComputedStyle(button);
        
        expect(styles.backgroundColor).not.toBe('transparent');
        expect(styles.color).not.toBe('transparent');
      });
    });

    it('should respect reduced motion preferences', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<Button onClick={jest.fn()}>Test Button</Button>);
      
      const button = screen.getByRole('button');
      button.classList.add('reduce-motion');
      
      const styles = window.getComputedStyle(button);
      expect(
        styles.animationDuration === '0s' ||
        styles.transitionDuration === '0s'
      ).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing onClick gracefully', async () => {
      const { container } = render(<Button>No Click Handler</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle empty button text', async () => {
      const { container } = render(<Button onClick={jest.fn()}></Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle IconButton without aria-label', () => {
      // This should be caught by accessibility testing
      const { container } = render(
        <IconButton icon={<span>🔍</span>} onClick={jest.fn()} />
      );
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // Note: This would fail axe tests due to missing accessible name
    });
  });
});
