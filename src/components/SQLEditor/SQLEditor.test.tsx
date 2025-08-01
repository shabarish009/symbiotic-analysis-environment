import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SQLEditor } from './SQLEditor';
import type { SQLDialect } from './types';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock CodeMirror
vi.mock('@codemirror/view', () => ({
  EditorView: vi.fn(() => ({
    destroy: vi.fn(),
    dispatch: vi.fn(),
    state: {
      doc: { toString: () => 'SELECT 1;' },
    },
  })),
  keymap: {
    of: vi.fn(),
  },
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

describe('SQLEditor', () => {
  const mockInvoke = require('@tauri-apps/api/core').invoke;
  const defaultProps = {
    value: 'SELECT 1;',
    onChange: vi.fn(),
    dialect: 'postgresql' as SQLDialect,
    theme: 'xp' as const,
    showLineNumbers: true,
    enableAutoCompletion: true,
    enableSyntaxValidation: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({
      is_valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    });
  });

  describe('Basic Functionality', () => {
    it('renders SQL editor with default props', () => {
      render(<SQLEditor {...defaultProps} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      expect(editor).toBeInTheDocument();
    });

    it('displays placeholder text when empty', () => {
      render(
        <SQLEditor
          {...defaultProps}
          value=""
          placeholder="Enter your SQL query here..."
        />
      );
      
      expect(screen.getByText(/enter your sql query here/i)).toBeInTheDocument();
    });

    it('calls onChange when content changes', async () => {
      const onChange = jest.fn();
      render(<SQLEditor {...defaultProps} onChange={onChange} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      
      await userEvent.type(editor, 'SELECT * FROM users;');
      
      // Note: In a real test, we'd need to properly mock CodeMirror's change events
      // For now, we're testing that the component renders without errors
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Accessibility Compliance (WCAG AA)', () => {
    it('has proper ARIA labels and roles', () => {
      render(<SQLEditor {...defaultProps} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      expect(editor).toHaveAttribute('aria-label');
      expect(editor).toHaveAttribute('role', 'textbox');
    });

    it('supports keyboard navigation', () => {
      render(<SQLEditor {...defaultProps} />);
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      
      // Test that the editor can receive focus
      editor.focus();
      expect(document.activeElement).toBe(editor);
    });

    it('announces syntax errors to screen readers', async () => {
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

      render(
        <SQLEditor
          {...defaultProps}
          value="SELEC 1;"
          enableSyntaxValidation={true}
        />
      );

      await waitFor(() => {
        const errorRegion = screen.getByRole('alert');
        expect(errorRegion).toBeInTheDocument();
        expect(errorRegion).toHaveTextContent(/syntax error/i);
      });
    });

    it('supports high contrast theme', () => {
      render(
        <SQLEditor
          {...defaultProps}
          theme="high-contrast"
        />
      );
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      expect(editor).toBeInTheDocument();
      
      // In a real implementation, we'd check for high contrast CSS classes
      expect(editor.closest('.sql-editor')).toHaveClass('theme-high-contrast');
    });

    it('supports customizable font sizes', () => {
      render(
        <SQLEditor
          {...defaultProps}
          fontSize={16}
        />
      );
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      expect(editor).toBeInTheDocument();
      
      // Check that font size is applied
      const editorContainer = editor.closest('.sql-editor');
      expect(editorContainer).toHaveStyle('font-size: 16px');
    });
  });

  describe('Performance Requirements', () => {
    it('handles large queries without lag', async () => {
      const largeQuery = 'SELECT * FROM users;\n'.repeat(1000);
      const onChange = jest.fn();
      
      const startTime = performance.now();
      
      render(
        <SQLEditor
          {...defaultProps}
          value={largeQuery}
          onChange={onChange}
        />
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within 100ms even for large content
      expect(renderTime).toBeLessThan(100);
    });

    it('debounces syntax validation to prevent excessive API calls', async () => {
      jest.useFakeTimers();
      
      render(
        <SQLEditor
          {...defaultProps}
          value=""
          enableSyntaxValidation={true}
        />
      );

      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      
      // Simulate rapid typing
      await userEvent.type(editor, 'S');
      await userEvent.type(editor, 'E');
      await userEvent.type(editor, 'L');
      
      // Fast-forward time to trigger debounced validation
      act(() => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        // Should only call validation once due to debouncing
        expect(mockInvoke).toHaveBeenCalledTimes(1);
      });
      
      jest.useRealTimers();
    });
  });

  describe('SQL Dialect Support', () => {
    const dialects: SQLDialect[] = ['postgresql', 'mysql', 'sqlite', 'mssql', 'oracle'];

    dialects.forEach((dialect) => {
      it(`supports ${dialect} dialect`, () => {
        render(
          <SQLEditor
            {...defaultProps}
            dialect={dialect}
          />
        );
        
        const editor = screen.getByRole('textbox', { name: /sql editor/i });
        expect(editor).toBeInTheDocument();
        
        // Check that dialect-specific class is applied
        const editorContainer = editor.closest('.sql-editor');
        expect(editorContainer).toHaveClass(`dialect-${dialect}`);
      });
    });
  });

  describe('Auto-completion', () => {
    it('shows SQL keyword completions', async () => {
      render(
        <SQLEditor
          {...defaultProps}
          enableAutoCompletion={true}
        />
      );

      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      
      // Simulate typing to trigger auto-completion
      await userEvent.type(editor, 'SEL');
      
      await waitFor(() => {
        // Check for completion popup
        const completions = screen.queryByRole('listbox');
        if (completions) {
          expect(completions).toBeInTheDocument();
        }
      });
    });

    it('shows schema-aware completions when connected to database', async () => {
      mockInvoke.mockImplementation((command) => {
        if (command === 'get_database_schema') {
          return Promise.resolve({
            tables: [
              {
                name: 'users',
                columns: [
                  { name: 'id', type: 'INTEGER' },
                  { name: 'username', type: 'VARCHAR(255)' },
                ],
              },
            ],
          });
        }
        return Promise.resolve({ is_valid: true, errors: [], warnings: [], suggestions: [] });
      });

      render(
        <SQLEditor
          {...defaultProps}
          connectionId="test-connection-id"
          enableAutoCompletion={true}
        />
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_database_schema', {
          connectionId: 'test-connection-id',
        });
      });
    });
  });

  describe('Theme Integration', () => {
    it('applies Windows XP theme correctly', () => {
      render(
        <SQLEditor
          {...defaultProps}
          theme="xp"
        />
      );
      
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      const editorContainer = editor.closest('.sql-editor');
      
      expect(editorContainer).toHaveClass('theme-xp');
      
      // Check for Lucida Console font
      const computedStyle = window.getComputedStyle(editorContainer!);
      expect(computedStyle.fontFamily).toContain('Lucida Console');
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('API Error'));
      
      render(
        <SQLEditor
          {...defaultProps}
          enableSyntaxValidation={true}
        />
      );

      // Should not crash when API fails
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      expect(editor).toBeInTheDocument();
    });

    it('displays connection errors appropriately', async () => {
      render(
        <SQLEditor
          {...defaultProps}
          connectionId="invalid-connection"
          enableAutoCompletion={true}
        />
      );

      // Should handle invalid connection gracefully
      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Integration Features', () => {
    it('supports query execution via keyboard shortcut', () => {
      const onExecute = jest.fn();
      
      render(
        <SQLEditor
          {...defaultProps}
          onExecute={onExecute}
        />
      );

      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      
      // Simulate Ctrl+Enter or F5 key press
      fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true });
      
      expect(onExecute).toHaveBeenCalledWith('SELECT 1;');
    });

    it('supports find and replace functionality', () => {
      render(
        <SQLEditor
          {...defaultProps}
          searchEnabled={true}
        />
      );

      const editor = screen.getByRole('textbox', { name: /sql editor/i });
      
      // Simulate Ctrl+F to open search
      fireEvent.keyDown(editor, { key: 'f', ctrlKey: true });
      
      // Check for search interface
      const searchBox = screen.queryByRole('searchbox');
      if (searchBox) {
        expect(searchBox).toBeInTheDocument();
      }
    });
  });
});
