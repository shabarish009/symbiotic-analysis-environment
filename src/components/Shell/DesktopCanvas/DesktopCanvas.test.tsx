/**
 * DesktopCanvas Component Tests
 * Tests for accessibility and functionality
 */

import { render, screen, fireEvent } from '../../../test/test-utils';
import { DesktopCanvas } from './DesktopCanvas';
import type { DesktopIcon } from '../types';

describe('DesktopCanvas', () => {
  const mockIcons: DesktopIcon[] = [
    {
      id: 'test-icon',
      name: 'Test Icon',
      icon: 'test-icon.png',
      position: { x: 32, y: 32 },
      isSelected: false,
      onDoubleClick: vi.fn(),
    },
  ];

  it('renders with proper accessibility attributes', () => {
    render(<DesktopCanvas icons={mockIcons} />);

    const desktop = screen.getByRole('main');
    expect(desktop).toHaveAttribute('aria-label', 'Desktop');
  });

  it('renders desktop icons with proper accessibility', () => {
    render(<DesktopCanvas icons={mockIcons} />);

    const icon = screen.getByRole('button', { name: 'Test Icon icon' });
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('tabIndex', '0');
  });

  it('handles icon selection with keyboard', () => {
    const onIconSelect = vi.fn();
    render(<DesktopCanvas icons={mockIcons} onIconSelect={onIconSelect} />);

    const icon = screen.getByRole('button', { name: 'Test Icon icon' });
    fireEvent.keyDown(icon, { key: 'Enter' });

    expect(mockIcons[0].onDoubleClick).toHaveBeenCalled();
  });

  it('announces selection changes to screen readers', () => {
    render(<DesktopCanvas icons={mockIcons} />);

    const announcer = screen.getByTestId('desktop-announcer');
    expect(announcer).toHaveAttribute('aria-live', 'polite');
    expect(announcer).toHaveAttribute('aria-atomic', 'true');
  });

  it('handles desktop click to clear selection', () => {
    const onDesktopClick = vi.fn();
    render(<DesktopCanvas icons={mockIcons} onDesktopClick={onDesktopClick} />);

    const desktop = screen.getByRole('main');
    fireEvent.click(desktop);

    expect(onDesktopClick).toHaveBeenCalled();
  });

  it('supports context menu on desktop', () => {
    const onDesktopContextMenu = vi.fn();
    render(
      <DesktopCanvas
        icons={mockIcons}
        onDesktopContextMenu={onDesktopContextMenu}
      />
    );

    const desktop = screen.getByRole('main');
    fireEvent.contextMenu(desktop);

    expect(onDesktopContextMenu).toHaveBeenCalled();
  });
});
