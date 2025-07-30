/**
 * StartMenu Accessibility Tests
 * Comprehensive WCAG AA compliance testing for StartMenu component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { StartMenu } from '../StartMenu';
import { StartMenuItem, UserInfo } from '../../types';
import { a11yTestSuite, keyboardTestUtils, screenReaderTestUtils, focusTestUtils } from '../../../../test/accessibility-utils';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('StartMenu Accessibility', () => {
  const mockItems: StartMenuItem[] = [
    {
      id: 'programs',
      label: 'Programs',
      icon: '/icons/programs.png',
      shortcut: 'P',
    },
    {
      id: 'documents',
      label: 'My Documents',
      icon: '/icons/documents.png',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '/icons/settings.png',
    },
    {
      id: 'search',
      label: 'Search',
      icon: '/icons/search.png',
      shortcut: 'S',
    },
    {
      id: 'help',
      label: 'Help and Support',
      icon: '/icons/help.png',
    },
    {
      id: 'run',
      label: 'Run...',
      icon: '/icons/run.png',
      shortcut: 'R',
    },
    {
      id: 'control-panel',
      label: 'Control Panel',
      icon: '/icons/control-panel.png',
    },
    {
      id: 'network',
      label: 'Network Connections',
      icon: '/icons/network.png',
    },
  ];

  const mockUserInfo: UserInfo = {
    name: 'John Doe',
    avatar: '/avatars/john.png',
  };

  const defaultProps = {
    isOpen: true,
    items: mockItems,
    onClose: jest.fn(),
    onItemClick: jest.fn(),
    userInfo: mockUserInfo,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WCAG AA Compliance', () => {
    it('should pass axe accessibility tests when open', async () => {
      const { container } = render(<StartMenu {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should run complete accessibility audit', async () => {
      const renderResult = render(<StartMenu {...defaultProps} />);
      await a11yTestSuite.runCompleteAudit(renderResult);
    });

    it('should not render when closed', () => {
      render(<StartMenu {...defaultProps} isOpen={false} />);
      
      const menu = screen.queryByRole('menu');
      expect(menu).not.toBeInTheDocument();
    });
  });

  describe('Semantic Structure and ARIA', () => {
    it('should have proper semantic structure', () => {
      render(<StartMenu {...defaultProps} />);
      
      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
      expect(menu).toHaveAttribute('aria-label', 'Start menu');
    });

    it('should have proper ARIA attributes for menu items', () => {
      render(<StartMenu {...defaultProps} />);
      
      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems.length).toBeGreaterThan(0);
      
      menuItems.forEach((item, index) => {
        expect(item).toHaveAttribute('role', 'menuitem');
        expect(item).toHaveAttribute('aria-label');
      });
    });

    it('should have proper group roles', () => {
      render(<StartMenu {...defaultProps} />);
      
      const programsGroup = screen.getByRole('group', { name: 'Programs' });
      expect(programsGroup).toBeInTheDocument();
      
      const systemGroup = screen.getByRole('group', { name: 'System' });
      expect(systemGroup).toBeInTheDocument();
      
      const powerGroup = screen.getByRole('group', { name: 'Power options' });
      expect(powerGroup).toBeInTheDocument();
    });

    it('should have proper banner role for user info', () => {
      render(<StartMenu {...defaultProps} />);
      
      const userBanner = screen.getByRole('banner');
      expect(userBanner).toBeInTheDocument();
    });

    it('should have proper image alt attributes', () => {
      render(<StartMenu {...defaultProps} />);
      
      const images = screen.getAllByRole('presentation');
      images.forEach(image => {
        expect(image).toHaveAttribute('alt', '');
        expect(image).toHaveAttribute('role', 'presentation');
      });
    });

    it('should have proper power button accessibility', () => {
      render(<StartMenu {...defaultProps} />);
      
      const logoffButton = screen.getByRole('menuitem', { name: 'Log off' });
      expect(logoffButton).toBeInTheDocument();
      
      const shutdownButton = screen.getByRole('menuitem', { name: 'Turn off computer' });
      expect(shutdownButton).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation through menu items', async () => {
      const user = userEvent.setup();
      render(<StartMenu {...defaultProps} />);
      
      const menuItems = screen.getAllByRole('menuitem');
      
      // Focus first menu item
      menuItems[0].focus();
      expect(document.activeElement).toBe(menuItems[0]);
      
      // Tab through menu items
      for (let i = 1; i < Math.min(menuItems.length, 5); i++) {
        await user.tab();
        expect(document.activeElement).toBe(menuItems[i]);
      }
    });

    it('should support keyboard activation with Enter key', async () => {
      const user = userEvent.setup();
      render(<StartMenu {...defaultProps} />);
      
      const firstMenuItem = screen.getAllByRole('menuitem')[0];
      firstMenuItem.focus();
      
      await user.keyboard('{Enter}');
      expect(defaultProps.onItemClick).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should support keyboard activation with Space key', async () => {
      const user = userEvent.setup();
      render(<StartMenu {...defaultProps} />);
      
      const firstMenuItem = screen.getAllByRole('menuitem')[0];
      firstMenuItem.focus();
      
      await user.keyboard(' ');
      expect(defaultProps.onItemClick).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should close menu with Escape key', async () => {
      const user = userEvent.setup();
      render(<StartMenu {...defaultProps} />);
      
      const menu = screen.getByRole('menu');
      menu.focus();
      
      await user.keyboard('{Escape}');
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should test keyboard navigation order', async () => {
      const { container } = render(<StartMenu {...defaultProps} />);
      
      const expectedOrder = [
        '[data-testid="start-menu-item-programs"]',
        '[data-testid="start-menu-item-documents"]',
        '[data-testid="start-menu-item-settings"]',
        '[data-testid="start-menu-item-search"]',
        '[data-testid="start-menu-item-help"]',
        '[data-testid="start-menu-item-run"]',
      ];
      
      await keyboardTestUtils.testTabNavigation(container, expectedOrder);
    });
  });

  describe('Focus Management', () => {
    it('should trap focus within menu when open', async () => {
      const user = userEvent.setup();
      render(<StartMenu {...defaultProps} />);
      
      const menu = screen.getByRole('menu');
      const menuItems = screen.getAllByRole('menuitem');
      
      // Focus should be trapped within the menu
      await focusTestUtils.testFocusTrapping(menu, menuItems.map((_, i) => `menuitem:nth-child(${i + 1})`));
    });

    it('should have visible focus indicators', () => {
      render(<StartMenu {...defaultProps} />);
      
      const menuItems = screen.getAllByRole('menuitem');
      menuItems.forEach(item => {
        focusTestUtils.validateFocusIndicators(item);
      });
    });

    it('should maintain focus when items are activated', async () => {
      const user = userEvent.setup();
      render(<StartMenu {...defaultProps} />);
      
      const firstMenuItem = screen.getAllByRole('menuitem')[0];
      firstMenuItem.focus();
      
      await user.keyboard('{Enter}');
      // Focus should be maintained until menu closes
      expect(document.activeElement).toBe(firstMenuItem);
    });
  });

  describe('Screen Reader Support', () => {
    it('should have proper semantic structure for screen readers', () => {
      const { container } = render(<StartMenu {...defaultProps} />);
      screenReaderTestUtils.validateSemanticStructure(container);
    });

    it('should announce menu items with shortcuts', () => {
      render(<StartMenu {...defaultProps} />);
      
      const programsItem = screen.getByRole('menuitem', { name: 'Programs' });
      expect(programsItem).toBeInTheDocument();
      
      // Check if shortcut is displayed
      const shortcutElement = programsItem.querySelector('.start-menu-item-shortcut');
      if (shortcutElement) {
        expect(shortcutElement).toHaveTextContent('P');
      }
    });

    it('should announce user information', () => {
      render(<StartMenu {...defaultProps} />);
      
      const userName = screen.getByText('John Doe');
      expect(userName).toBeInTheDocument();
    });

    it('should handle menu without user info', () => {
      render(<StartMenu {...defaultProps} userInfo={undefined} />);
      
      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
      
      const userBanner = screen.queryByRole('banner');
      expect(userBanner).not.toBeInTheDocument();
    });
  });

  describe('Mouse and Touch Interaction', () => {
    it('should handle menu item clicks', () => {
      render(<StartMenu {...defaultProps} />);
      
      const firstMenuItem = screen.getAllByRole('menuitem')[0];
      fireEvent.click(firstMenuItem);
      
      expect(defaultProps.onItemClick).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should handle power button clicks', () => {
      render(<StartMenu {...defaultProps} />);
      
      const logoffButton = screen.getByRole('menuitem', { name: 'Log off' });
      fireEvent.click(logoffButton);
      
      expect(defaultProps.onItemClick).toHaveBeenCalledWith('logoff');
      expect(defaultProps.onClose).toHaveBeenCalled();
      
      const shutdownButton = screen.getByRole('menuitem', { name: 'Turn off computer' });
      fireEvent.click(shutdownButton);
      
      expect(defaultProps.onItemClick).toHaveBeenCalledWith('shutdown');
    });

    it('should close menu when clicking outside', () => {
      render(
        <div>
          <div data-testid="outside">Outside element</div>
          <StartMenu {...defaultProps} />
        </div>
      );
      
      const outsideElement = screen.getByTestId('outside');
      fireEvent.mouseDown(outsideElement);
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should not close menu when clicking inside', () => {
      render(<StartMenu {...defaultProps} />);
      
      const menu = screen.getByRole('menu');
      fireEvent.mouseDown(menu);
      
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('High Contrast and User Preferences', () => {
    it('should support high contrast mode', () => {
      const { container } = render(<StartMenu {...defaultProps} />);
      
      // Simulate high contrast mode
      container.classList.add('high-contrast-mode');
      
      const menu = screen.getByRole('menu');
      const styles = window.getComputedStyle(menu);
      
      expect(styles.backgroundColor).not.toBe('transparent');
      expect(styles.color).not.toBe('transparent');
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

      const { container } = render(<StartMenu {...defaultProps} />);
      
      // Verify reduced motion styles are applied
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
    it('should handle empty items array', async () => {
      const { container } = render(<StartMenu {...defaultProps} items={[]} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle items without icons', () => {
      const itemsWithoutIcons = mockItems.map(item => ({
        ...item,
        icon: undefined,
      }));
      
      render(<StartMenu {...defaultProps} items={itemsWithoutIcons} />);
      
      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems.length).toBeGreaterThan(0);
    });

    it('should handle items without shortcuts', () => {
      const itemsWithoutShortcuts = mockItems.map(item => ({
        ...item,
        shortcut: undefined,
      }));
      
      render(<StartMenu {...defaultProps} items={itemsWithoutShortcuts} />);
      
      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems.length).toBeGreaterThan(0);
    });

    it('should handle missing callbacks gracefully', () => {
      render(
        <StartMenu 
          {...defaultProps} 
          onClose={undefined}
          onItemClick={undefined}
        />
      );
      
      const firstMenuItem = screen.getAllByRole('menuitem')[0];
      fireEvent.click(firstMenuItem);
      
      // Should not throw error
      expect(firstMenuItem).toBeInTheDocument();
    });

    it('should handle user info without avatar', () => {
      const userInfoWithoutAvatar = {
        name: 'Jane Doe',
        avatar: undefined,
      };
      
      render(<StartMenu {...defaultProps} userInfo={userInfoWithoutAvatar} />);
      
      const userName = screen.getByText('Jane Doe');
      expect(userName).toBeInTheDocument();
      
      const defaultAvatar = screen.getByRole('banner').querySelector('.default-avatar');
      expect(defaultAvatar).toBeInTheDocument();
      expect(defaultAvatar).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
