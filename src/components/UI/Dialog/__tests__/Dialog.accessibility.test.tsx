/**
 * Dialog Components Accessibility Tests
 * Comprehensive WCAG AA compliance testing for Dialog components
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Dialog, MessageBox, PropertyDialog, ModalBackdrop } from '../';
import { a11yTestSuite, keyboardTestUtils, screenReaderTestUtils, focusTestUtils } from '../../../../test/accessibility-utils';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Dialog Components Accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Dialog Component', () => {
    const mockOnClose = jest.fn();

    it('should pass axe accessibility tests when open', async () => {
      const { container } = render(
        <Dialog
          isOpen={true}
          title="Test Dialog"
          onClose={mockOnClose}
        >
          <p>Dialog content</p>
        </Dialog>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should run complete accessibility audit', async () => {
      const renderResult = render(
        <Dialog
          isOpen={true}
          title="Test Dialog"
          onClose={mockOnClose}
        >
          <p>Dialog content</p>
        </Dialog>
      );
      await a11yTestSuite.runCompleteAudit(renderResult);
    });

    it('should not render when closed', () => {
      render(
        <Dialog
          isOpen={false}
          title="Test Dialog"
          onClose={mockOnClose}
        >
          <p>Dialog content</p>
        </Dialog>
      );
      
      const dialog = screen.queryByRole('dialog');
      expect(dialog).not.toBeInTheDocument();
    });

    it('should have proper semantic structure when open', () => {
      render(
        <Dialog
          isOpen={true}
          title="Test Dialog"
          onClose={mockOnClose}
        >
          <p>Dialog content</p>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      
      const title = screen.getByText('Test Dialog');
      expect(title).toBeInTheDocument();
      
      const titleId = dialog.getAttribute('aria-labelledby');
      expect(title.id).toBe(titleId);
    });

    it('should trap focus within dialog', async () => {
      const user = userEvent.setup();
      render(
        <Dialog
          isOpen={true}
          title="Test Dialog"
          onClose={mockOnClose}
        >
          <button>Button 1</button>
          <button>Button 2</button>
          <button>Close</button>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog');
      const buttons = screen.getAllByRole('button');
      
      // Test focus trapping
      await focusTestUtils.testFocusTrapping(dialog, buttons.map((_, i) => `button:nth-child(${i + 1})`));
    });

    it('should close on escape key', async () => {
      const user = userEvent.setup();
      render(
        <Dialog
          isOpen={true}
          title="Test Dialog"
          onClose={mockOnClose}
        >
          <p>Dialog content</p>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog');
      dialog.focus();
      
      await user.keyboard('{Escape}');
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close when clicking backdrop', () => {
      render(
        <Dialog
          isOpen={true}
          title="Test Dialog"
          onClose={mockOnClose}
          closeOnBackdropClick={true}
        >
          <p>Dialog content</p>
        </Dialog>
      );
      
      const backdrop = screen.getByTestId('modal-backdrop');
      fireEvent.click(backdrop);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not close when clicking dialog content', () => {
      render(
        <Dialog
          isOpen={true}
          title="Test Dialog"
          onClose={mockOnClose}
          closeOnBackdropClick={true}
        >
          <p>Dialog content</p>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should restore focus when closed', () => {
      const triggerButton = document.createElement('button');
      triggerButton.textContent = 'Open Dialog';
      document.body.appendChild(triggerButton);
      triggerButton.focus();
      
      const { rerender } = render(
        <Dialog
          isOpen={true}
          title="Test Dialog"
          onClose={mockOnClose}
        >
          <p>Dialog content</p>
        </Dialog>
      );
      
      // Close dialog
      rerender(
        <Dialog
          isOpen={false}
          title="Test Dialog"
          onClose={mockOnClose}
        >
          <p>Dialog content</p>
        </Dialog>
      );
      
      // Focus should be restored to trigger button
      expect(document.activeElement).toBe(triggerButton);
      
      document.body.removeChild(triggerButton);
    });

    it('should have visible focus indicators', () => {
      render(
        <Dialog
          isOpen={true}
          title="Test Dialog"
          onClose={mockOnClose}
        >
          <button>Test Button</button>
        </Dialog>
      );
      
      const button = screen.getByRole('button');
      focusTestUtils.validateFocusIndicators(button);
    });
  });

  describe('MessageBox Component', () => {
    const mockOnClose = jest.fn();
    const mockOnConfirm = jest.fn();

    it('should pass axe accessibility tests for all types', async () => {
      const types = ['info', 'warning', 'error', 'question'] as const;
      
      for (const type of types) {
        const { container } = render(
          <MessageBox
            isOpen={true}
            type={type}
            title="Test Message"
            message="This is a test message"
            onClose={mockOnClose}
          />
        );
        
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      }
    });

    it('should have proper semantic structure', () => {
      render(
        <MessageBox
          isOpen={true}
          type="info"
          title="Information"
          message="This is an information message"
          onClose={mockOnClose}
        />
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-labelledby');
      
      const title = screen.getByText('Information');
      expect(title).toBeInTheDocument();
      
      const message = screen.getByText('This is an information message');
      expect(message).toBeInTheDocument();
    });

    it('should have proper button configuration for different types', () => {
      // Info type - OK button only
      const { rerender } = render(
        <MessageBox
          isOpen={true}
          type="info"
          title="Information"
          message="Info message"
          onClose={mockOnClose}
        />
      );
      
      let buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveTextContent('OK');
      
      // Question type - Yes/No buttons
      rerender(
        <MessageBox
          isOpen={true}
          type="question"
          title="Confirmation"
          message="Are you sure?"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );
      
      buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
      expect(buttons[0]).toHaveTextContent('Yes');
      expect(buttons[1]).toHaveTextContent('No');
    });

    it('should support keyboard navigation between buttons', async () => {
      const user = userEvent.setup();
      render(
        <MessageBox
          isOpen={true}
          type="question"
          title="Confirmation"
          message="Are you sure?"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );
      
      const buttons = screen.getAllByRole('button');
      
      // Focus first button
      buttons[0].focus();
      expect(document.activeElement).toBe(buttons[0]);
      
      // Tab to next button
      await user.tab();
      expect(document.activeElement).toBe(buttons[1]);
    });

    it('should handle button activation', async () => {
      const user = userEvent.setup();
      render(
        <MessageBox
          isOpen={true}
          type="question"
          title="Confirmation"
          message="Are you sure?"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );
      
      const yesButton = screen.getByRole('button', { name: 'Yes' });
      await user.click(yesButton);
      
      expect(mockOnConfirm).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should have proper icon accessibility', () => {
      render(
        <MessageBox
          isOpen={true}
          type="warning"
          title="Warning"
          message="This is a warning"
          onClose={mockOnClose}
        />
      );
      
      const icon = screen.getByRole('img', { hidden: true });
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('PropertyDialog Component', () => {
    const mockOnClose = jest.fn();
    const tabs = [
      { id: 'general', label: 'General', content: <div>General content</div> },
      { id: 'advanced', label: 'Advanced', content: <div>Advanced content</div> },
      { id: 'security', label: 'Security', content: <div>Security content</div> },
    ];

    it('should pass axe accessibility tests', async () => {
      const { container } = render(
        <PropertyDialog
          isOpen={true}
          title="Properties"
          tabs={tabs}
          activeTab="general"
          onTabChange={jest.fn()}
          onClose={mockOnClose}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper tablist structure', () => {
      render(
        <PropertyDialog
          isOpen={true}
          title="Properties"
          tabs={tabs}
          activeTab="general"
          onTabChange={jest.fn()}
          onClose={mockOnClose}
        />
      );
      
      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
      
      const tabElements = screen.getAllByRole('tab');
      expect(tabElements).toHaveLength(3);
      
      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel).toBeInTheDocument();
    });

    it('should support keyboard navigation between tabs', async () => {
      const user = userEvent.setup();
      const mockOnTabChange = jest.fn();
      
      render(
        <PropertyDialog
          isOpen={true}
          title="Properties"
          tabs={tabs}
          activeTab="general"
          onTabChange={mockOnTabChange}
          onClose={mockOnClose}
        />
      );
      
      const tabElements = screen.getAllByRole('tab');
      
      // Focus first tab
      tabElements[0].focus();
      expect(document.activeElement).toBe(tabElements[0]);
      
      // Arrow right to next tab
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(tabElements[1]);
      expect(mockOnTabChange).toHaveBeenCalledWith('advanced');
    });

    it('should have proper ARIA attributes for tabs', () => {
      render(
        <PropertyDialog
          isOpen={true}
          title="Properties"
          tabs={tabs}
          activeTab="general"
          onTabChange={jest.fn()}
          onClose={mockOnClose}
        />
      );
      
      const activeTab = screen.getByRole('tab', { selected: true });
      expect(activeTab).toHaveAttribute('aria-selected', 'true');
      expect(activeTab).toHaveAttribute('tabindex', '0');
      
      const inactiveTabs = screen.getAllByRole('tab').filter(tab => 
        tab.getAttribute('aria-selected') === 'false'
      );
      inactiveTabs.forEach(tab => {
        expect(tab).toHaveAttribute('aria-selected', 'false');
        expect(tab).toHaveAttribute('tabindex', '-1');
      });
    });

    it('should associate tabpanel with active tab', () => {
      render(
        <PropertyDialog
          isOpen={true}
          title="Properties"
          tabs={tabs}
          activeTab="general"
          onTabChange={jest.fn()}
          onClose={mockOnClose}
        />
      );
      
      const activeTab = screen.getByRole('tab', { selected: true });
      const tabpanel = screen.getByRole('tabpanel');
      
      expect(activeTab).toHaveAttribute('aria-controls', tabpanel.id);
      expect(tabpanel).toHaveAttribute('aria-labelledby', activeTab.id);
    });
  });

  describe('ModalBackdrop Component', () => {
    const mockOnClick = jest.fn();

    it('should pass axe accessibility tests', async () => {
      const { container } = render(
        <ModalBackdrop onClick={mockOnClick}>
          <div>Modal content</div>
        </ModalBackdrop>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper semantic structure', () => {
      render(
        <ModalBackdrop onClick={mockOnClick}>
          <div>Modal content</div>
        </ModalBackdrop>
      );
      
      const backdrop = screen.getByTestId('modal-backdrop');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveAttribute('role', 'presentation');
    });

    it('should handle backdrop clicks', () => {
      render(
        <ModalBackdrop onClick={mockOnClick}>
          <div>Modal content</div>
        </ModalBackdrop>
      );
      
      const backdrop = screen.getByTestId('modal-backdrop');
      fireEvent.click(backdrop);
      
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should not trigger click when clicking content', () => {
      render(
        <ModalBackdrop onClick={mockOnClick}>
          <div data-testid="modal-content">Modal content</div>
        </ModalBackdrop>
      );
      
      const content = screen.getByTestId('modal-content');
      fireEvent.click(content);
      
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('High Contrast and User Preferences', () => {
    it('should support high contrast mode for all dialog types', () => {
      const dialogs = [
        { component: Dialog, props: { isOpen: true, title: 'Dialog', onClose: jest.fn(), children: <div>Content</div> } },
        { component: MessageBox, props: { isOpen: true, type: 'info' as const, title: 'Message', message: 'Test', onClose: jest.fn() } },
      ];

      dialogs.forEach(({ component: Component, props }) => {
        const { container } = render(<Component {...props} />);
        
        // Simulate high contrast mode
        container.classList.add('high-contrast-mode');
        
        const dialog = screen.getByRole('dialog');
        const styles = window.getComputedStyle(dialog);
        
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
        <Dialog
          isOpen={true}
          title="Test Dialog"
          onClose={jest.fn()}
        >
          <p>Content</p>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog');
      dialog.classList.add('reduce-motion');
      
      const styles = window.getComputedStyle(dialog);
      expect(
        styles.animationDuration === '0s' ||
        styles.transitionDuration === '0s'
      ).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle dialog without title', async () => {
      const { container } = render(
        <Dialog
          isOpen={true}
          onClose={jest.fn()}
        >
          <p>Content without title</p>
        </Dialog>
      );
      
      // This should have accessibility violations due to missing title
      const results = await axe(container);
      expect(results.violations.length).toBeGreaterThan(0);
    });

    it('should handle PropertyDialog with empty tabs', async () => {
      const { container } = render(
        <PropertyDialog
          isOpen={true}
          title="Properties"
          tabs={[]}
          activeTab=""
          onTabChange={jest.fn()}
          onClose={jest.fn()}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle missing callbacks gracefully', () => {
      render(
        <Dialog
          isOpen={true}
          title="Test Dialog"
          onClose={undefined as any}
        >
          <p>Content</p>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });
  });
});
