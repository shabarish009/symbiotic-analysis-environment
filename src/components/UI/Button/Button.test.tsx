/**
 * Button Component Tests
 * Tests for accessibility and XP styling
 */

import { render, screen, fireEvent } from '../../../test/test-utils';
import { Button } from './Button';

describe('Button', () => {
  it('renders with proper accessibility attributes', () => {
    render(<Button>Test Button</Button>);

    const button = screen.getByRole('button', { name: 'Test Button' });
    expect(button).toBeInTheDocument();
  });

  it('supports keyboard navigation', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Test Button</Button>);

    const button = screen.getByRole('button');

    // Button should be focusable (default behavior for button elements)
    expect(button.tagName).toBe('BUTTON');

    // Test keyboard interaction
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyUp(button, { key: 'Enter' });
  });

  it('shows loading state with proper accessibility', () => {
    render(<Button loading>Loading Button</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');

    // Should have screen reader text for loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles disabled state properly', () => {
    render(<Button disabled>Disabled Button</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('applies correct CSS classes for variants', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);

    let button = screen.getByRole('button');
    expect(button).toHaveClass('xp-button--primary');

    rerender(<Button variant="secondary">Secondary</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('xp-button--secondary');
  });

  it('supports different sizes', () => {
    const { rerender } = render(<Button size="small">Small</Button>);

    let button = screen.getByRole('button');
    expect(button).toHaveClass('xp-button--small');

    rerender(<Button size="large">Large</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('xp-button--large');
  });

  it('renders with icon in different positions', () => {
    const icon = <span data-testid="icon">🔍</span>;

    // Left icon
    const { rerender } = render(
      <Button icon={icon} iconPosition="left">Search</Button>
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();

    // Right icon
    rerender(<Button icon={icon} iconPosition="right">Search</Button>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();

    // Icon only
    rerender(<Button icon={icon} iconPosition="only" aria-label="Search" />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.queryByText('Search')).not.toBeInTheDocument();
  });

  it('handles pressed state for toggle buttons', () => {
    render(<Button pressed>Toggle Button</Button>);
    const button = screen.getByRole('button');

    expect(button).toHaveClass('xp-button--pressed');
  });

  it('supports group styling', () => {
    render(<Button group>Group Button</Button>);
    const button = screen.getByRole('button');

    expect(button).toHaveClass('xp-button--group');
  });

  it('handles icon-only variant', () => {
    const icon = <span data-testid="icon">🔍</span>;
    render(<Button variant="icon" icon={icon} iconPosition="only" aria-label="Search" />);

    const button = screen.getByRole('button', { name: 'Search' });
    expect(button).toHaveClass('xp-button--icon');
    expect(button).toHaveClass('xp-button--icon-only');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('handles toolbar variant', () => {
    render(<Button variant="toolbar">Toolbar</Button>);
    const button = screen.getByRole('button');

    expect(button).toHaveClass('xp-button--toolbar');
  });

  it('renders with icon and maintains accessibility', () => {
    const icon = <span data-testid="test-icon">🔍</span>;
    render(<Button icon={icon}>Search</Button>);

    const button = screen.getByRole('button', { name: 'Search' });
    expect(button).toBeInTheDocument();

    // Icon should be present
    const iconElement = screen.getByTestId('test-icon');
    expect(iconElement).toBeInTheDocument();

    // Icon container should have aria-hidden
    const iconContainer = iconElement.closest('.xp-button-icon');
    expect(iconContainer).toHaveAttribute('aria-hidden', 'true');
  });
});
