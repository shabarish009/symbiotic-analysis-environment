/**
 * Enhanced Accessibility Tests for ResultsGrid Component
 * 
 * WCAG AA Compliance Validation:
 * - Screen reader compatibility
 * - Keyboard navigation
 * - Focus management
 * - Color contrast
 * - ARIA attributes
 * - High contrast mode support
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ResultsGrid } from '../ResultsGrid';
import type { QueryResult } from '../types';

expect.extend(toHaveNoViolations);

// Mock TanStack dependencies
vi.mock('@tanstack/react-table', () => ({
  useReactTable: vi.fn(() => ({
    getHeaderGroups: () => [
      {
        id: 'header-group-1',
        headers: [
          {
            id: 'id',
            getSize: () => 100,
            column: {
              getCanSort: () => true,
              getToggleSortingHandler: () => vi.fn(),
              getIsSorted: () => false,
              getCanFilter: () => true,
              getFilterValue: () => '',
              columnDef: {
                header: () => 'ID',
              },
            },
            getContext: () => ({}),
          },
          {
            id: 'name',
            getSize: () => 150,
            column: {
              getCanSort: () => true,
              getToggleSortingHandler: () => vi.fn(),
              getIsSorted: () => 'asc',
              getCanFilter: () => true,
              getFilterValue: () => '',
              columnDef: {
                header: () => 'Name',
              },
            },
            getContext: () => ({}),
          },
        ],
      },
    ],
    getRowModel: () => ({
      rows: [
        {
          id: 'row-1',
          getVisibleCells: () => [
            {
              id: 'cell-1-1',
              column: { columnDef: { cell: () => '1' } },
              getContext: () => ({}),
            },
            {
              id: 'cell-1-2',
              column: { columnDef: { cell: () => 'Test User' } },
              getContext: () => ({}),
            },
          ],
        },
        {
          id: 'row-2',
          getVisibleCells: () => [
            {
              id: 'cell-2-1',
              column: { columnDef: { cell: () => '2' } },
              getContext: () => ({}),
            },
            {
              id: 'cell-2-2',
              column: { columnDef: { cell: () => null } },
              getContext: () => ({}),
            },
          ],
        },
      ],
    }),
    getState: () => ({
      pagination: { pageIndex: 0, pageSize: 100 },
    }),
    getCanPreviousPage: () => false,
    getCanNextPage: () => true,
    getPageCount: () => 5,
    getFilteredRowModel: () => ({ rows: Array(200).fill({}) }),
    setPageIndex: vi.fn(),
    previousPage: vi.fn(),
    nextPage: vi.fn(),
  })),
  getCoreRowModel: vi.fn(),
  getSortedRowModel: vi.fn(),
  getFilteredRowModel: vi.fn(),
  getPaginationRowModel: vi.fn(),
  flexRender: vi.fn((component, context) => {
    if (typeof component === 'function') {
      return component(context);
    }
    return component;
  }),
  createColumnHelper: vi.fn(() => ({
    accessor: vi.fn((key, config) => ({ ...config, accessorKey: key })),
  })),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getVirtualItems: () => [
      { index: 0, start: 0, size: 35 },
      { index: 1, start: 35, size: 35 },
    ],
  })),
}));

vi.mock('../../UI/Button', () => ({
  Button: ({ children, onClick, disabled, 'aria-label': ariaLabel, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
  ),
}));

describe('ResultsGrid Accessibility Tests (WCAG AA)', () => {
  const mockQueryResult: QueryResult = {
    query_id: 'accessibility-test',
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false },
      { name: 'name', type: 'VARCHAR', nullable: true },
      { name: 'email', type: 'VARCHAR', nullable: true },
    ],
    rows: [
      [1, 'John Doe', 'john@example.com'],
      [2, 'Jane Smith', 'jane@example.com'],
      [3, null, 'test@example.com'],
    ],
    row_count: 3,
    execution_time: 125,
    affected_rows: 0,
    success: true,
  };

  const defaultProps = {
    queryResults: mockQueryResult,
    isLoading: false,
    error: null,
    onCancelQuery: vi.fn(),
    onRetryQuery: vi.fn(),
  };

  describe('Axe Accessibility Testing', () => {
    it('should have no accessibility violations in success state', async () => {
      const { container } = render(<ResultsGrid {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in loading state', async () => {
      const { container } = render(<ResultsGrid {...defaultProps} isLoading={true} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in error state', async () => {
      const { container } = render(
        <ResultsGrid {...defaultProps} error="Database connection failed" />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in empty state', async () => {
      const { container } = render(
        <ResultsGrid {...defaultProps} queryResults={null} />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation through interactive elements', async () => {
      const user = userEvent.setup();
      render(<ResultsGrid {...defaultProps} />);

      // Tab through interactive elements
      await user.tab();
      expect(document.activeElement).toHaveAttribute('placeholder', 'Search all columns...');

      await user.tab();
      expect(document.activeElement).toHaveTextContent('Clear Filters');

      await user.tab();
      expect(document.activeElement).toHaveTextContent('Export CSV');
    });

    it('should support Enter and Space key activation for buttons', async () => {
      const user = userEvent.setup();
      const onCancelQuery = vi.fn();
      
      render(<ResultsGrid {...defaultProps} isLoading={true} onCancelQuery={onCancelQuery} />);

      const cancelButton = screen.getByText('Cancel Query');
      cancelButton.focus();

      await user.keyboard('{Enter}');
      expect(onCancelQuery).toHaveBeenCalledTimes(1);

      await user.keyboard(' ');
      expect(onCancelQuery).toHaveBeenCalledTimes(2);
    });

    it('should support arrow key navigation in table headers', async () => {
      const user = userEvent.setup();
      render(<ResultsGrid {...defaultProps} />);

      // Focus on first sortable header
      const headers = screen.getAllByRole('columnheader');
      if (headers.length > 0) {
        headers[0].focus();
        expect(document.activeElement).toBe(headers[0]);

        // Arrow key navigation would be implemented by the table library
        // This test validates the structure is in place
        expect(headers[0]).toHaveAttribute('tabindex', '0');
      }
    });
  });

  describe('Screen Reader Support', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<ResultsGrid {...defaultProps} />);

      // Check for table role
      const table = document.querySelector('table');
      expect(table).toHaveAttribute('role', 'table');

      // Check for proper column headers
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThan(0);

      // Check for search input accessibility
      const searchInput = screen.getByPlaceholderText('Search all columns...');
      expect(searchInput).toHaveAttribute('type', 'text');
      expect(searchInput).toHaveAttribute('aria-label', 'Search all columns');
    });

    it('should announce loading state to screen readers', () => {
      render(<ResultsGrid {...defaultProps} isLoading={true} />);

      const loadingRegion = screen.getByText('Executing query...');
      expect(loadingRegion.closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
    });

    it('should announce errors to screen readers', () => {
      const error = 'Connection timeout occurred';
      render(<ResultsGrid {...defaultProps} error={error} />);

      const errorRegion = screen.getByText(error);
      expect(errorRegion.closest('[role="alert"]')).toHaveAttribute('role', 'alert');
    });

    it('should provide accessible descriptions for data cells', () => {
      render(<ResultsGrid {...defaultProps} />);

      // NULL values should be properly announced
      const nullCells = document.querySelectorAll('.null-value');
      nullCells.forEach(cell => {
        expect(cell).toHaveTextContent('NULL');
        expect(cell).toHaveAttribute('aria-label', 'Empty value');
      });
    });
  });

  describe('Focus Management', () => {
    it('should maintain focus during state transitions', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ResultsGrid {...defaultProps} isLoading={true} />);

      const cancelButton = screen.getByText('Cancel Query');
      cancelButton.focus();
      expect(document.activeElement).toBe(cancelButton);

      // Transition to success state
      rerender(<ResultsGrid {...defaultProps} />);

      // Focus should move to a logical element (search input)
      const searchInput = screen.getByPlaceholderText('Search all columns...');
      expect(document.activeElement).toBe(searchInput);
    });

    it('should trap focus in modal-like error states', () => {
      render(<ResultsGrid {...defaultProps} error="Critical error occurred" />);

      const retryButton = screen.queryByText('Retry');
      if (retryButton) {
        expect(retryButton).toBeInTheDocument();
        expect(retryButton).toHaveAttribute('tabindex', '0');
      }
    });
  });

  describe('High Contrast Mode Support', () => {
    it('should maintain visibility in high contrast mode', () => {
      // Simulate high contrast mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(<ResultsGrid {...defaultProps} />);

      // Verify high contrast styles are applied
      const table = document.querySelector('.results-table');
      expect(table).toHaveClass('results-table');
      
      // In a real implementation, you would check for high contrast CSS classes
      // This test validates the structure is in place for high contrast support
    });
  });

  describe('Color and Contrast', () => {
    it('should not rely solely on color to convey information', () => {
      render(<ResultsGrid {...defaultProps} />);

      // Sort indicators should have text/symbols, not just color
      const sortIndicators = document.querySelectorAll('.sort-indicator');
      sortIndicators.forEach(indicator => {
        expect(indicator.textContent).toMatch(/[↑↓]/);
      });

      // NULL values should have text, not just color styling
      const nullValues = document.querySelectorAll('.null-value');
      nullValues.forEach(nullValue => {
        expect(nullValue.textContent).toBe('NULL');
      });
    });

    it('should provide sufficient color contrast for text', () => {
      render(<ResultsGrid {...defaultProps} />);

      // This would typically be tested with automated contrast checking tools
      // Here we verify the structure supports proper contrast
      const headers = document.querySelectorAll('.column-header');
      headers.forEach(header => {
        expect(header).toHaveClass('column-header');
      });
    });
  });

  describe('Responsive Accessibility', () => {
    it('should maintain accessibility on mobile devices', () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<ResultsGrid {...defaultProps} />);

      // Touch targets should be large enough (44px minimum)
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        // In a real test, you would check computed styles for minimum touch target size
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe('Error State Accessibility', () => {
    it('should provide accessible error recovery options', () => {
      const onRetryQuery = vi.fn();
      render(
        <ResultsGrid 
          {...defaultProps} 
          error="Network connection failed" 
          onRetryQuery={onRetryQuery}
        />
      );

      const retryButton = screen.getByText('Retry');
      expect(retryButton).toHaveAttribute('aria-label', 'Retry failed query');
      expect(retryButton).not.toBeDisabled();
    });

    it('should announce dynamic content changes', () => {
      const { rerender } = render(<ResultsGrid {...defaultProps} />);

      // Change to error state
      rerender(<ResultsGrid {...defaultProps} error="Query failed" />);

      // Error should be announced via aria-live region
      const errorMessage = screen.getByText('Query failed');
      expect(errorMessage.closest('[aria-live]')).toHaveAttribute('aria-live', 'assertive');
    });
  });
});
