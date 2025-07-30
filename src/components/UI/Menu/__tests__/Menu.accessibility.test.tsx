/**
 * Menu Accessibility Tests
 * Comprehensive WCAG AA compliance testing for Menu components
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Menu, MenuItem, MenuBar, ContextMenu, MenuSeparator } from '../';
import { a11yTestSuite, keyboardTestUtils, screenReaderTestUtils, focusTestUtils } from '../../../../test/accessibility-utils';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Menu Components Accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Menu and MenuItem Components', () => {
    const mockOnClick = jest.fn();
    const menuItems = [
      { id: 'new', label: 'New', shortcut: 'Ctrl+N', onClick: mockOnClick },
      { id: 'open', label: 'Open', shortcut: 'Ctrl+O', onClick: mockOnClick },
      { id: 'separator1', separator: true },
      { id: 'save', label: 'Save', shortcut: 'Ctrl+S', onClick: mockOnClick },
      { id: 'exit', label: 'Exit', onClick: mockOnClick },
    ];

    it('should pass axe accessibility tests', async () => {
      const { container } = render(
        <Menu>
          {menuItems.map(item => 
            item.separator ? (
              <MenuSeparator key={item.id} />
            ) : (
              <MenuItem
                key={item.id}
                onClick={item.onClick}
                shortcut={item.shortcut}
              >
                {item.label}
              </MenuItem>
            )
          )}
        </Menu>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should run complete accessibility audit', async () => {
      const renderResult = render(
        <Menu>
          <MenuItem onClick={mockOnClick}>Test Item</MenuItem>
        </Menu>
      );
      await a11yTestSuite.runCompleteAudit(renderResult);
    });

    it('should have proper semantic structure', () => {
      render(
        <Menu>
          <MenuItem onClick={mockOnClick}>Test Item</MenuItem>
        </Menu>
      );
      
      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
      
      const menuItem = screen.getByRole('menuitem');
      expect(menuItem).toBeInTheDocument();
      expect(menuItem).toHaveTextContent('Test Item');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <Menu>
          {menuItems.filter(item => !item.separator).map(item => (
            <MenuItem key={item.id} onClick={item.onClick}>
              {item.label}
            </MenuItem>
          ))}
        </Menu>
      );
      
      const menuItems = screen.getAllByRole('menuitem');
      
      // Focus first menu item
      menuItems[0].focus();
      expect(document.activeElement).toBe(menuItems[0]);
      
      // Arrow down to next item
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(menuItems[1]);
      
      // Arrow up to previous item
      await user.keyboard('{ArrowUp}');
      expect(document.activeElement).toBe(menuItems[0]);
    });

    it('should support keyboard activation', async () => {
      const user = userEvent.setup();
      render(
        <Menu>
          <MenuItem onClick={mockOnClick}>Test Item</MenuItem>
        </Menu>
      );
      
      const menuItem = screen.getByRole('menuitem');
      menuItem.focus();
      
      await user.keyboard('{Enter}');
      expect(mockOnClick).toHaveBeenCalled();
      
      mockOnClick.mockClear();
      
      await user.keyboard(' ');
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should display shortcuts accessibly', () => {
      render(
        <Menu>
          <MenuItem onClick={mockOnClick} shortcut="Ctrl+N">
            New
          </MenuItem>
        </Menu>
      );
      
      const menuItem = screen.getByRole('menuitem');
      expect(menuItem).toHaveTextContent('New');
      expect(menuItem).toHaveTextContent('Ctrl+N');
      
      // Shortcut should be properly associated
      const shortcutElement = menuItem.querySelector('.xp-menu-item-shortcut');
      expect(shortcutElement).toBeInTheDocument();
    });

    it('should handle disabled menu items', async () => {
      render(
        <Menu>
          <MenuItem disabled onClick={mockOnClick}>
            Disabled Item
          </MenuItem>
        </Menu>
      );
      
      const menuItem = screen.getByRole('menuitem');
      expect(menuItem).toHaveAttribute('aria-disabled', 'true');
      expect(menuItem).toHaveAttribute('tabindex', '-1');
      
      const { container } = render(
        <Menu>
          <MenuItem disabled onClick={mockOnClick}>
            Disabled Item
          </MenuItem>
        </Menu>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have visible focus indicators', () => {
      render(
        <Menu>
          <MenuItem onClick={mockOnClick}>Test Item</MenuItem>
        </Menu>
      );
      
      const menuItem = screen.getByRole('menuitem');
      focusTestUtils.validateFocusIndicators(menuItem);
    });
  });

  describe('MenuBar Component', () => {
    const menuBarItems = [
      {
        id: 'file',
        label: 'File',
        items: [
          { id: 'new', label: 'New', shortcut: 'Ctrl+N', onClick: jest.fn() },
          { id: 'open', label: 'Open', shortcut: 'Ctrl+O', onClick: jest.fn() },
        ],
      },
      {
        id: 'edit',
        label: 'Edit',
        items: [
          { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X', onClick: jest.fn() },
          { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', onClick: jest.fn() },
        ],
      },
    ];

    it('should pass axe accessibility tests', async () => {
      const { container } = render(<MenuBar items={menuBarItems} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper semantic structure', () => {
      render(<MenuBar items={menuBarItems} />);
      
      const menubar = screen.getByRole('menubar');
      expect(menubar).toBeInTheDocument();
      
      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems).toHaveLength(2);
      
      menuItems.forEach((item, index) => {
        expect(item).toHaveTextContent(menuBarItems[index].label);
        expect(item).toHaveAttribute('aria-haspopup', 'true');
        expect(item).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('should support horizontal keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<MenuBar items={menuBarItems} />);
      
      const menuItems = screen.getAllByRole('menuitem');
      
      // Focus first menu item
      menuItems[0].focus();
      expect(document.activeElement).toBe(menuItems[0]);
      
      // Arrow right to next menu
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(menuItems[1]);
      
      // Arrow left to previous menu
      await user.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(menuItems[0]);
    });

    it('should expand submenus with proper ARIA states', async () => {
      const user = userEvent.setup();
      render(<MenuBar items={menuBarItems} />);
      
      const fileMenu = screen.getByRole('menuitem', { name: 'File' });
      
      // Open submenu
      await user.click(fileMenu);
      
      expect(fileMenu).toHaveAttribute('aria-expanded', 'true');
      
      // Check for submenu items
      const submenuItems = screen.getAllByRole('menuitem');
      expect(submenuItems.length).toBeGreaterThan(2); // Original + submenu items
    });

    it('should support escape key to close submenus', async () => {
      const user = userEvent.setup();
      render(<MenuBar items={menuBarItems} />);
      
      const fileMenu = screen.getByRole('menuitem', { name: 'File' });
      
      // Open submenu
      await user.click(fileMenu);
      expect(fileMenu).toHaveAttribute('aria-expanded', 'true');
      
      // Press escape to close
      await user.keyboard('{Escape}');
      expect(fileMenu).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('ContextMenu Component', () => {
    const contextMenuItems = [
      { id: 'cut', label: 'Cut', onClick: jest.fn() },
      { id: 'copy', label: 'Copy', onClick: jest.fn() },
      { id: 'paste', label: 'Paste', onClick: jest.fn() },
    ];

    it('should pass axe accessibility tests when open', async () => {
      const { container } = render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          items={contextMenuItems}
          onClose={jest.fn()}
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not render when closed', () => {
      render(
        <ContextMenu
          isOpen={false}
          position={{ x: 100, y: 100 }}
          items={contextMenuItems}
          onClose={jest.fn()}
        />
      );
      
      const menu = screen.queryByRole('menu');
      expect(menu).not.toBeInTheDocument();
    });

    it('should have proper semantic structure when open', () => {
      render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          items={contextMenuItems}
          onClose={jest.fn()}
        />
      );
      
      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
      expect(menu).toHaveAttribute('aria-label', 'Context menu');
      
      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems).toHaveLength(3);
    });

    it('should trap focus within context menu', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      
      render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          items={contextMenuItems}
          onClose={onClose}
        />
      );
      
      const menu = screen.getByRole('menu');
      const menuItems = screen.getAllByRole('menuitem');
      
      // Test focus trapping
      await focusTestUtils.testFocusTrapping(menu, menuItems.map((_, i) => `menuitem:nth-child(${i + 1})`));
    });

    it('should close on escape key', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      
      render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          items={contextMenuItems}
          onClose={onClose}
        />
      );
      
      const menu = screen.getByRole('menu');
      menu.focus();
      
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalled();
    });

    it('should close when clicking outside', () => {
      const onClose = jest.fn();
      
      render(
        <div>
          <div data-testid="outside">Outside element</div>
          <ContextMenu
            isOpen={true}
            position={{ x: 100, y: 100 }}
            items={contextMenuItems}
            onClose={onClose}
          />
        </div>
      );
      
      const outsideElement = screen.getByTestId('outside');
      fireEvent.mouseDown(outsideElement);
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('MenuSeparator Component', () => {
    it('should pass axe accessibility tests', async () => {
      const { container } = render(
        <Menu>
          <MenuItem onClick={jest.fn()}>Item 1</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={jest.fn()}>Item 2</MenuItem>
        </Menu>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper semantic structure', () => {
      render(
        <Menu>
          <MenuItem onClick={jest.fn()}>Item 1</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={jest.fn()}>Item 2</MenuItem>
        </Menu>
      );
      
      const separator = screen.getByRole('separator');
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('should not be focusable', () => {
      render(
        <Menu>
          <MenuItem onClick={jest.fn()}>Item 1</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={jest.fn()}>Item 2</MenuItem>
        </Menu>
      );
      
      const separator = screen.getByRole('separator');
      expect(separator).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('High Contrast and User Preferences', () => {
    it('should support high contrast mode for all menu components', () => {
      const components = [
        { component: Menu, props: { children: <MenuItem onClick={jest.fn()}>Item</MenuItem> } },
        { component: MenuBar, props: { items: [{ id: 'test', label: 'Test', items: [] }] } },
      ];

      components.forEach(({ component: Component, props }) => {
        const { container } = render(<Component {...props} />);
        
        // Simulate high contrast mode
        container.classList.add('high-contrast-mode');
        
        const menu = screen.getByRole(/menu/);
        const styles = window.getComputedStyle(menu);
        
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

      render(
        <Menu>
          <MenuItem onClick={jest.fn()}>Test Item</MenuItem>
        </Menu>
      );
      
      const menu = screen.getByRole('menu');
      menu.classList.add('reduce-motion');
      
      const styles = window.getComputedStyle(menu);
      expect(
        styles.animationDuration === '0s' ||
        styles.transitionDuration === '0s'
      ).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty menu gracefully', async () => {
      const { container } = render(<Menu></Menu>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle menu items without onClick', async () => {
      const { container } = render(
        <Menu>
          <MenuItem>No Click Handler</MenuItem>
        </Menu>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle MenuBar with empty items', async () => {
      const { container } = render(<MenuBar items={[]} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle ContextMenu with invalid position', async () => {
      const { container } = render(
        <ContextMenu
          isOpen={true}
          position={{ x: -100, y: -100 }}
          items={[{ id: 'test', label: 'Test', onClick: jest.fn() }]}
          onClose={jest.fn()}
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
