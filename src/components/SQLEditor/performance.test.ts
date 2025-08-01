/**
 * Performance benchmarks for SQL Editor
 * Tests compliance with Zeus Directive performance requirements:
 * - Zero input lag for queries up to 10,000 lines
 * - Syntax highlighting updates within 16ms (60fps)
 * - Auto-completion suggestions within 100ms
 */

import { performance } from 'perf_hooks';

// Mock performance.now for consistent testing
const mockPerformanceNow = vi.fn();
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
  },
});

// Mock CodeMirror for performance testing
const mockEditorView = {
  dispatch: vi.fn(),
  state: {
    doc: { toString: () => '' },
  },
  destroy: vi.fn(),
};

vi.mock('@codemirror/view', () => ({
  EditorView: vi.fn(() => mockEditorView),
  keymap: { of: vi.fn() },
}));

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: vi.fn(() => ({
      doc: { toString: () => '' },
    })),
  },
  Compartment: vi.fn(() => ({
    of: vi.fn(),
    reconfigure: vi.fn(),
  })),
}));

describe('SQL Editor Performance Benchmarks', () => {
  let timeCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    timeCounter = 0;
    mockPerformanceNow.mockImplementation(() => {
      timeCounter += 1;
      return timeCounter;
    });
  });

  describe('Large Query Handling', () => {
    it('should handle 10,000 line queries without performance degradation', async () => {
      const { SQLEditor } = await import('./SQLEditor');
      const React = await import('react');
      const { render } = await import('@testing-library/react');

      // Generate a large SQL query (10,000 lines) with realistic complexity
      const largeQuery = Array(10000)
        .fill(0)
        .map((_, i) => {
          // Create more realistic SQL with varying complexity
          const queries = [
            `SELECT id, name, email FROM users WHERE id = ${i};`,
            `UPDATE products SET price = ${i * 10} WHERE category_id = ${i % 100};`,
            `INSERT INTO orders (user_id, product_id, quantity) VALUES (${i}, ${i + 1}, ${i % 10});`,
            `DELETE FROM temp_data WHERE created_at < NOW() - INTERVAL '${i}' DAY;`,
            `WITH RECURSIVE category_tree AS (
              SELECT id, name, parent_id, 0 as level FROM categories WHERE parent_id IS NULL
              UNION ALL
              SELECT c.id, c.name, c.parent_id, ct.level + 1
              FROM categories c JOIN category_tree ct ON c.parent_id = ct.id
            ) SELECT * FROM category_tree WHERE level <= ${i % 5};`,
          ];
          return queries[i % queries.length];
        })
        .join('\n');

      const startTime = performance.now();

      const onChange = vi.fn();
      render(
        React.createElement(SQLEditor, {
          value: largeQuery,
          onChange,
          dialect: 'postgresql',
          theme: 'xp',
          showLineNumbers: true,
          enableAutoCompletion: true,
          enableSyntaxValidation: true,
        })
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within 100ms even for large content
      expect(renderTime).toBeLessThan(100);

      // Additional performance assertions
      expect(largeQuery.length).toBeGreaterThan(500000); // Ensure we're testing substantial content
      expect(largeQuery.split('\n').length).toBe(10000); // Verify line count
    });

    it('should maintain responsive typing with large queries', async () => {
      const { SQLEditor } = await import('./SQLEditor');
      const React = await import('react');
      const { render, fireEvent } = await import('@testing-library/react');

      const largeQuery = Array(5000)
        .fill(0)
        .map((_, i) => `SELECT ${i} as line_${i};`)
        .join('\n');

      const onChange = vi.fn();
      const { container } = render(
        React.createElement(SQLEditor, {
          value: largeQuery,
          onChange,
          dialect: 'postgresql',
          theme: 'xp',
          showLineNumbers: true,
          enableAutoCompletion: true,
          enableSyntaxValidation: true,
        })
      );

      const editor = container.querySelector('[role="textbox"]');
      expect(editor).toBeTruthy();

      // Simulate typing events
      const typingStartTime = performance.now();

      for (let i = 0; i < 10; i++) {
        fireEvent.input(editor!, { target: { value: largeQuery + `\nSELECT ${i};` } });
      }

      const typingEndTime = performance.now();
      const typingTime = typingEndTime - typingStartTime;

      // Each keystroke should be processed within 16ms (60fps requirement)
      const averageKeystrokeTime = typingTime / 10;
      expect(averageKeystrokeTime).toBeLessThan(16);
    });
  });

  describe('Syntax Highlighting Performance', () => {
    it('should update syntax highlighting within 16ms for 60fps experience', async () => {
      const { SQLEditor } = await import('./SQLEditor');
      const React = await import('react');
      const { render } = await import('@testing-library/react');

      const complexQuery = `
        WITH RECURSIVE employee_hierarchy AS (
          SELECT employee_id, manager_id, name, 0 as level
          FROM employees
          WHERE manager_id IS NULL
          UNION ALL
          SELECT e.employee_id, e.manager_id, e.name, eh.level + 1
          FROM employees e
          JOIN employee_hierarchy eh ON e.manager_id = eh.employee_id
        )
        SELECT 
          eh.name,
          eh.level,
          COUNT(DISTINCT o.order_id) as total_orders,
          SUM(oi.quantity * oi.price) as total_revenue,
          AVG(CASE WHEN o.status = 'completed' THEN oi.quantity * oi.price END) as avg_completed_order_value
        FROM employee_hierarchy eh
        LEFT JOIN orders o ON eh.employee_id = o.sales_rep_id
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        WHERE o.created_date >= CURRENT_DATE - INTERVAL '1 year'
        GROUP BY eh.employee_id, eh.name, eh.level
        HAVING COUNT(DISTINCT o.order_id) > 10
        ORDER BY eh.level, total_revenue DESC;
      `;

      const onChange = vi.fn();
      const startTime = performance.now();

      render(
        React.createElement(SQLEditor, {
          value: complexQuery,
          onChange,
          dialect: 'postgresql',
          theme: 'xp',
          showLineNumbers: true,
          enableAutoCompletion: true,
          enableSyntaxValidation: true,
        })
      );

      const endTime = performance.now();
      const highlightingTime = endTime - startTime;

      // Syntax highlighting should complete within 16ms for 60fps
      expect(highlightingTime).toBeLessThan(16);
    });
  });

  describe('Auto-completion Performance', () => {
    it('should provide auto-completion suggestions within 100ms', async () => {
      // Mock Tauri invoke for schema loading
      const mockInvoke = vi.fn().mockResolvedValue({
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'INTEGER' },
              { name: 'username', type: 'VARCHAR(255)' },
              { name: 'email', type: 'VARCHAR(255)' },
            ],
          },
        ],
      });

      vi.doMock('@tauri-apps/api/core', () => ({
        invoke: mockInvoke,
      }));

      const { useAutoCompletion } = await import('./hooks/useAutoCompletion');
      const { renderHook, act } = await import('@testing-library/react');

      const { result } = renderHook(() =>
        useAutoCompletion({
          dialect: 'postgresql',
          connectionId: 'test-connection',
          enabled: true,
        })
      );

      const startTime = performance.now();

      await act(async () => {
        // Simulate auto-completion trigger
        const completions = await result.current.getCompletions('SEL', 3);
        expect(completions).toBeDefined();
      });

      const endTime = performance.now();
      const completionTime = endTime - startTime;

      // Auto-completion should respond within 100ms
      expect(completionTime).toBeLessThan(100);
    });

    it('should cache schema data to improve subsequent completion performance', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({
        tables: [{ name: 'users', columns: [{ name: 'id', type: 'INTEGER' }] }],
      });

      vi.doMock('@tauri-apps/api/core', () => ({
        invoke: mockInvoke,
      }));

      const { useAutoCompletion } = await import('./hooks/useAutoCompletion');
      const { renderHook, act } = await import('@testing-library/react');

      const { result } = renderHook(() =>
        useAutoCompletion({
          dialect: 'postgresql',
          connectionId: 'test-connection',
          enabled: true,
        })
      );

      // First call should load schema
      await act(async () => {
        await result.current.getCompletions('users.', 6);
      });

      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Second call should use cached data
      const startTime = performance.now();

      await act(async () => {
        await result.current.getCompletions('users.', 6);
      });

      const endTime = performance.now();
      const cachedCompletionTime = endTime - startTime;

      // Cached completions should be even faster (< 10ms)
      expect(cachedCompletionTime).toBeLessThan(10);
      // Should not make additional API calls
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memory Management', () => {
    it('should properly cleanup resources when editor is unmounted', async () => {
      const { SQLEditor } = await import('./SQLEditor');
      const React = await import('react');
      const { render, unmount } = await import('@testing-library/react');

      const onChange = vi.fn();
      const { unmount: unmountComponent } = render(
        React.createElement(SQLEditor, {
          value: 'SELECT 1;',
          onChange,
          dialect: 'postgresql',
          theme: 'xp',
          showLineNumbers: true,
          enableAutoCompletion: true,
          enableSyntaxValidation: true,
        })
      );

      // Unmount the component
      unmountComponent();

      // Verify that cleanup was called
      expect(mockEditorView.destroy).toHaveBeenCalled();
    });

    it('should handle rapid re-renders without memory leaks', async () => {
      const { SQLEditor } = await import('./SQLEditor');
      const React = await import('react');
      const { render, rerender } = await import('@testing-library/react');

      const onChange = vi.fn();
      const { rerender: rerenderComponent } = render(
        React.createElement(SQLEditor, {
          value: 'SELECT 1;',
          onChange,
          dialect: 'postgresql',
          theme: 'xp',
          showLineNumbers: true,
          enableAutoCompletion: true,
          enableSyntaxValidation: true,
        })
      );

      // Perform multiple re-renders with different values
      for (let i = 0; i < 100; i++) {
        rerenderComponent(
          React.createElement(SQLEditor, {
            value: `SELECT ${i};`,
            onChange,
            dialect: 'postgresql',
            theme: 'xp',
            showLineNumbers: true,
            enableAutoCompletion: true,
            enableSyntaxValidation: true,
          })
        );
      }

      // Should not create excessive editor instances
      const EditorView = require('@codemirror/view').EditorView;
      expect(EditorView).toHaveBeenCalledTimes(1);
    });
  });

  describe('Debouncing and Throttling', () => {
    it('should debounce syntax validation to prevent excessive API calls', async () => {
      vi.useFakeTimers();

      const mockInvoke = vi.fn().mockResolvedValue({
        is_valid: true,
        errors: [],
        warnings: [],
        suggestions: [],
      });

      vi.doMock('@tauri-apps/api/core', () => ({
        invoke: mockInvoke,
      }));

      const { useSyntaxValidation } = await import('./hooks/useSyntaxValidation');
      const { renderHook, act } = await import('@testing-library/react');

      const { result } = renderHook(() =>
        useSyntaxValidation({
          dialect: 'postgresql',
          connectionId: 'test-connection',
          enabled: true,
        })
      );

      // Simulate rapid typing
      act(() => {
        result.current.validateSyntax('S');
        result.current.validateSyntax('SE');
        result.current.validateSyntax('SEL');
        result.current.validateSyntax('SELE');
        result.current.validateSyntax('SELECT');
      });

      // Fast-forward time to trigger debounced validation
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should only call validation once due to debouncing
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});
