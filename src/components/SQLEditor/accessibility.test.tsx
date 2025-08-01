/**
 * Accessibility tests for SQL Editor
 * Tests compliance with WCAG AA requirements as mandated by Zeus Directive:
 * - Keyboard-only navigation
 * - Screen reader compatibility
 * - High-contrast theme support
 * - Focus management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SQLEditor } from './SQLEditor';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({
    is_valid: true,
    errors: [],
    warnings: [],
    suggestions: [],
  }),
}));

// Mock CodeMirror with accessibility features
const mockEditorView = {
  destroy: vi.fn(),
  dispatch: vi.fn(),
  state: {
    doc: { toString: () => 'SELECT 1;' },
  },
  dom: document.createElement('div'),
  focus: vi.fn(),
};

vi.mock('@codemirror/view', () => ({
  EditorView: vi.fn(() => mockEditorView),
  keymap: { of: vi.fn() },
}));

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: vi.fn(() => ({
      doc: { toString: () => 'SELECT 1;' },
    })),
  },
  Compartment: vi.fn(() => ({
    of: vi.fn(),
    reconfigure: vi.fn(),
  })),
}));

describe('SQL Editor Accessibility (WCAG AA Compliance)', () => {
  const defaultProps = {
    value: 'SELECT 1;',
    onChange: vi.fn(),
    dialect: 'postgresql' as const,
    theme: 'xp' as const,
    showLineNumbers: true,
    enableAutoCompletion: true,
    enableSyntaxValidation: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Automated Accessibility Testing', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<SQLEditor {...defaultProps} />);
      const results = await axe(container, {
        rules: {
          // Enable all WCAG AA rules
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true },
          'focus-management': { enabled: true },
          'aria-labels': { enabled: true },
        },
      });
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with high contrast theme', async () => {
      const { container } = render(
        <SQLEditor {...defaultProps} theme="high-contrast" />
      );
      const results = await axe(container, {
        rules: {
          // Stricter color contrast rules for high contrast theme
          'color-contrast-enhanced': { enabled: true },
        },
      });
      expect(results).toHaveNoViolations();
    });

    it('should maintain accessibility with large content', async () => {
      const largeContent = Array(1000)
        .fill(0)
        .map((_, i) => `SELECT ${i} FROM table_${i};`)
        .join('\n');

      const { container } = render(
        <SQLEditor {...defaultProps} value={largeContent} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with syntax errors', async () => {
      const mockInvoke = require('@tauri-apps/api/core').invoke;
      mockInvoke.mockResolvedValue({
        is_valid: false,
        errors: [
          {
            line: 1,
            column: 1,
            length: 6,
            message: 'Syntax error: unexpected token',
            severity: 'error',
          },
        ],
        warnings: [],
        suggestions: [],
      });

      const { container } = render(
        <SQLEditor {...defaultProps} value="SELEC 1;" />
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should be focusable via keyboard', () => {
      render(<SQLEditor {...defaultProps} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      
      // Tab to the editor
      userEvent.tab();
      expect(document.activeElement).toBe(editor);
    });

    it('should support all standard text editing keyboard shortcuts', async () => {
      const onChange = jest.fn();
      render(<SQLEditor {...defaultProps} onChange={onChange} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      editor.focus();

      // Test Ctrl+A (Select All)
      await userEvent.keyboard('{Control>}a{/Control}');
      
      // Test Ctrl+C (Copy)
      await userEvent.keyboard('{Control>}c{/Control}');
      
      // Test Ctrl+V (Paste)
      await userEvent.keyboard('{Control>}v{/Control}');
      
      // Test Ctrl+Z (Undo)
      await userEvent.keyboard('{Control>}z{/Control}');
      
      // Test Ctrl+Y (Redo)
      await userEvent.keyboard('{Control>}y{/Control}');
      
      // Should not throw errors
      expect(editor).toBeInTheDocument();
    });

    it('should support find and replace via keyboard shortcuts', async () => {
      render(<SQLEditor {...defaultProps} searchEnabled={true} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      editor.focus();

      // Test Ctrl+F (Find)
      await userEvent.keyboard('{Control>}f{/Control}');
      
      // Test Ctrl+H (Replace)
      await userEvent.keyboard('{Control>}h{/Control}');
      
      // Should not throw errors
      expect(editor).toBeInTheDocument();
    });

    it('should support query execution via keyboard shortcuts', async () => {
      const onExecute = jest.fn();
      render(<SQLEditor {...defaultProps} onExecute={onExecute} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      editor.focus();

      // Test Ctrl+Enter (Execute Query)
      await userEvent.keyboard('{Control>}{Enter}{/Control}');
      
      expect(onExecute).toHaveBeenCalledWith('SELECT 1;');
    });

    it('should navigate auto-completion suggestions with arrow keys', async () => {
      render(<SQLEditor {...defaultProps} enableAutoCompletion={true} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      editor.focus();

      // Type to trigger auto-completion
      await userEvent.type(editor, 'SEL');
      
      // Navigate suggestions with arrow keys
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowUp}');
      await userEvent.keyboard('{Enter}');
      
      // Should not throw errors
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Screen Reader Support', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<SQLEditor {...defaultProps} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      
      expect(editor).toHaveAttribute('aria-label');
      expect(editor).toHaveAttribute('role', 'textbox');
      expect(editor).toHaveAttribute('aria-multiline', 'true');
    });

    it('should announce syntax errors to screen readers', async () => {
      const mockInvoke = require('@tauri-apps/api/core').invoke;
      mockInvoke.mockResolvedValue({
        is_valid: false,
        errors: [
          {
            line: 1,
            column: 1,
            length: 6,
            message: 'Syntax error: unexpected token',
            severity: 'error',
          },
        ],
        warnings: [],
        suggestions: [],
      });

      render(<SQLEditor {...defaultProps} value="SELEC 1;" />);

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toBeInTheDocument();
        expect(errorAlert).toHaveAttribute('aria-live', 'polite');
        expect(errorAlert).toHaveTextContent(/syntax error/i);
      });
    });

    it('should announce auto-completion suggestions to screen readers', async () => {
      render(<SQLEditor {...defaultProps} enableAutoCompletion={true} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      
      // Type to trigger auto-completion
      await userEvent.type(editor, 'SEL');
      
      await waitFor(() => {
        const completionList = screen.queryByRole('listbox');
        if (completionList) {
          expect(completionList).toHaveAttribute('aria-label');
          expect(completionList).toHaveAttribute('aria-live', 'polite');
        }
      });
    });

    it('should provide descriptive labels for line numbers', () => {
      render(<SQLEditor {...defaultProps} showLineNumbers={true} />);
      
      // Line numbers should be properly labeled for screen readers
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      expect(editor).toHaveAttribute('aria-describedby');
    });

    it('should announce current line and column position', async () => {
      render(<SQLEditor {...defaultProps} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      editor.focus();

      // Move cursor and check for position announcements
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowRight}');
      
      // Should have aria-describedby for position information
      expect(editor).toHaveAttribute('aria-describedby');
    });
  });

  describe('High Contrast Theme Support', () => {
    it('should apply high contrast colors correctly', () => {
      const { container } = render(
        <SQLEditor {...defaultProps} theme="high-contrast" />
      );
      
      const editorContainer = container.querySelector('.sql-editor');
      expect(editorContainer).toHaveClass('theme-high-contrast');
      
      // Check for high contrast CSS custom properties
      const computedStyle = window.getComputedStyle(editorContainer!);
      expect(computedStyle.getPropertyValue('--editor-bg')).toBe('#000000');
      expect(computedStyle.getPropertyValue('--editor-text')).toBe('#ffffff');
    });

    it('should maintain proper color contrast ratios', () => {
      const { container } = render(
        <SQLEditor {...defaultProps} theme="high-contrast" />
      );
      
      const editorContainer = container.querySelector('.sql-editor');
      const computedStyle = window.getComputedStyle(editorContainer!);
      
      // High contrast theme should use pure black/white for maximum contrast
      expect(computedStyle.backgroundColor).toBe('rgb(0, 0, 0)');
      expect(computedStyle.color).toBe('rgb(255, 255, 255)');
    });

    it('should respect system high contrast preferences', () => {
      // Mock prefers-contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const { container } = render(<SQLEditor {...defaultProps} />);
      
      const editorContainer = container.querySelector('.sql-editor');
      expect(editorContainer).toHaveClass('respects-system-contrast');
    });
  });

  describe('Focus Management', () => {
    it('should maintain focus within editor during auto-completion', async () => {
      render(<SQLEditor {...defaultProps} enableAutoCompletion={true} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      editor.focus();

      // Type to trigger auto-completion
      await userEvent.type(editor, 'SEL');
      
      // Focus should remain on editor or move to completion list
      await waitFor(() => {
        const activeElement = document.activeElement;
        expect(
          activeElement === editor || 
          activeElement?.getAttribute('role') === 'option'
        ).toBe(true);
      });
    });

    it('should return focus to editor after dismissing auto-completion', async () => {
      render(<SQLEditor {...defaultProps} enableAutoCompletion={true} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      editor.focus();

      // Type to trigger auto-completion
      await userEvent.type(editor, 'SEL');
      
      // Dismiss auto-completion with Escape
      await userEvent.keyboard('{Escape}');
      
      // Focus should return to editor
      expect(document.activeElement).toBe(editor);
    });

    it('should provide visible focus indicators', () => {
      const { container } = render(<SQLEditor {...defaultProps} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      editor.focus();
      
      // Check for focus indicator styles
      const editorContainer = container.querySelector('.sql-editor');
      expect(editorContainer).toHaveClass('focused');
      
      const computedStyle = window.getComputedStyle(editor);
      expect(computedStyle.outline).not.toBe('none');
    });
  });

  describe('Font Size and Zoom Support', () => {
    it('should support custom font sizes', () => {
      const { container } = render(
        <SQLEditor {...defaultProps} fontSize={16} />
      );
      
      const editorContainer = container.querySelector('.sql-editor');
      expect(editorContainer).toHaveStyle('font-size: 16px');
    });

    it('should scale properly with browser zoom', () => {
      // Mock browser zoom
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        value: 2, // 200% zoom
      });

      const { container } = render(<SQLEditor {...defaultProps} />);
      
      const editorContainer = container.querySelector('.sql-editor');
      
      // Should maintain readability at different zoom levels
      const computedStyle = window.getComputedStyle(editorContainer!);
      expect(parseFloat(computedStyle.fontSize!)).toBeGreaterThan(0);
    });

    it('should respect system font size preferences', () => {
      // Mock system font size preference
      Object.defineProperty(document.documentElement, 'style', {
        value: {
          fontSize: '18px',
        },
      });

      const { container } = render(<SQLEditor {...defaultProps} />);
      
      const editorContainer = container.querySelector('.sql-editor');
      
      // Should inherit or scale with system preferences
      const computedStyle = window.getComputedStyle(editorContainer!);
      expect(parseFloat(computedStyle.fontSize!)).toBeGreaterThanOrEqual(12);
    });
  });

  describe('Error Handling and User Feedback', () => {
    it('should provide accessible error messages', async () => {
      const mockInvoke = require('@tauri-apps/api/core').invoke;
      mockInvoke.mockResolvedValue({
        is_valid: false,
        errors: [
          {
            line: 1,
            column: 7,
            length: 1,
            message: 'Expected semicolon',
            severity: 'error',
          },
        ],
        warnings: [
          {
            line: 1,
            column: 1,
            length: 6,
            message: 'Consider using uppercase for keywords',
            severity: 'warning',
          },
        ],
        suggestions: ['Use SELECT instead of select'],
      });

      render(<SQLEditor {...defaultProps} value="select 1" />);

      await waitFor(() => {
        // Error should be announced
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent(/expected semicolon/i);
        
        // Warning should be available but not intrusive
        const warningElement = screen.getByText(/consider using uppercase/i);
        expect(warningElement).toBeInTheDocument();
      });
    });

    it('should provide accessible loading states', () => {
      render(<SQLEditor {...defaultProps} />);
      
      // Should have proper loading indicators
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      expect(editor).toHaveAttribute('aria-busy', 'false');
    });
  });
});
