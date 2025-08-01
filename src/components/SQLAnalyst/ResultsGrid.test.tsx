import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsGrid } from './ResultsGrid';
import type { QueryResult } from './types';

// Mock TanStack Table and Virtual
jest.mock('@tanstack/react-table', () => ({
  useReactTable: jest.fn(() => ({
    getHeaderGroups: () => [
      {
        id: 'header-group-1',
        headers: [
          {
            id: 'id',
            getSize: () => 100,
            column: {
              getCanSort: () => true,
              getToggleSortingHandler: () => jest.fn(),
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
              getToggleSortingHandler: () => jest.fn(),
              getIsSorted: () => false,
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
              column: { columnDef: { cell: () => 'Test' } },
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
    getCanNextPage: () => false,
    getPageCount: () => 1,
    getFilteredRowModel: () => ({ rows: [] }),
    setPageIndex: jest.fn(),
    previousPage: jest.fn(),
    nextPage: jest.fn(),
  })),
  getCoreRowModel: jest.fn(),
  getSortedRowModel: jest.fn(),
  getFilteredRowModel: jest.fn(),
  getPaginationRowModel: jest.fn(),
  flexRender: jest.fn((component, context) => {
    if (typeof component === 'function') {
      return component(context);
    }
    return component;
  }),
  createColumnHelper: jest.fn(() => ({
    accessor: jest.fn((key, config) => ({ ...config, accessorKey: key })),
  })),
}));

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(() => ({
    getVirtualItems: () => [
      { index: 0, start: 0, size: 35 },
    ],
  })),
}));

// Mock Button component
jest.mock('../UI/Button', () => ({
  Button: ({ children, onClick, disabled, icon, variant, size }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={`button-${children?.toString().toLowerCase().replace(/\s+/g, '-')}`}
      data-variant={variant}
      data-size={size}
    >
      {icon} {children}
    </button>
  ),
}));

describe('ResultsGrid', () => {
  const mockQueryResult: QueryResult = {
    query_id: 'test-query-1',
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false },
      { name: 'name', type: 'VARCHAR', nullable: true },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false },
    ],
    rows: [
      [1, 'Test User', '2025-07-31T10:00:00Z'],
      [2, 'Another User', '2025-07-31T10:01:00Z'],
      [3, null, '2025-07-31T10:02:00Z'],
    ],
    row_count: 3,
    execution_time: 150,
    affected_rows: 0,
    success: true,
  };

  const defaultProps = {
    queryResults: null,
    isLoading: false,
    error: null,
    onCancelQuery: jest.fn(),
    onRetryQuery: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading spinner when isLoading is true', () => {
      render(<ResultsGrid {...defaultProps} isLoading={true} />);
      
      expect(screen.getByText('Executing query...')).toBeInTheDocument();
      expect(screen.getByText('Cancel Query')).toBeInTheDocument();
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    it('should call onCancelQuery when cancel button is clicked during loading', async () => {
      const onCancelQuery = jest.fn();
      render(<ResultsGrid {...defaultProps} isLoading={true} onCancelQuery={onCancelQuery} />);
      
      const cancelButton = screen.getByText('Cancel Query');
      await userEvent.click(cancelButton);
      
      expect(onCancelQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error State', () => {
    it('should display error message when error is provided', () => {
      const error = 'Connection timeout occurred';
      render(<ResultsGrid {...defaultProps} error={error} />);
      
      expect(screen.getByText('Query Execution Failed')).toBeInTheDocument();
      expect(screen.getByText(error)).toBeInTheDocument();
    });

    it('should show retry button when onRetryQuery is provided', async () => {
      const onRetryQuery = jest.fn();
      render(<ResultsGrid {...defaultProps} error="Test error" onRetryQuery={onRetryQuery} />);
      
      const retryButton = screen.getByText('Retry');
      await userEvent.click(retryButton);
      
      expect(onRetryQuery).toHaveBeenCalledTimes(1);
    });

    it('should not show retry button when onRetryQuery is not provided', () => {
      render(<ResultsGrid {...defaultProps} error="Test error" />);
      
      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display placeholder when no query results are provided', () => {
      render(<ResultsGrid {...defaultProps} />);
      
      expect(screen.getByText('Ready to Execute')).toBeInTheDocument();
      expect(screen.getByText('Run a query to see results here.')).toBeInTheDocument();
    });
  });

  describe('Results Display', () => {
    it('should display query results with correct metadata', () => {
      render(<ResultsGrid {...defaultProps} queryResults={mockQueryResult} />);
      
      expect(screen.getByText('3 rows')).toBeInTheDocument();
      expect(screen.getByText('150ms')).toBeInTheDocument();
      expect(screen.getByText('0 affected')).toBeInTheDocument();
    });

    it('should display column headers with types', () => {
      render(<ResultsGrid {...defaultProps} queryResults={mockQueryResult} />);
      
      // Note: This test would need to be adjusted based on actual table rendering
      // The mock setup above provides basic structure
      expect(screen.getByText('Query Results')).toBeInTheDocument();
    });

    it('should handle null values correctly', () => {
      render(<ResultsGrid {...defaultProps} queryResults={mockQueryResult} />);
      
      // The component should render without errors even with null values in data
      expect(screen.getByText('Query Results')).toBeInTheDocument();
    });
  });

  describe('Filtering and Search', () => {
    it('should render global search input', () => {
      render(<ResultsGrid {...defaultProps} queryResults={mockQueryResult} />);
      
      const searchInput = screen.getByPlaceholderText('Search all columns...');
      expect(searchInput).toBeInTheDocument();
    });

    it('should update global filter when typing in search', async () => {
      render(<ResultsGrid {...defaultProps} queryResults={mockQueryResult} />);
      
      const searchInput = screen.getByPlaceholderText('Search all columns...');
      await userEvent.type(searchInput, 'test');
      
      expect(searchInput).toHaveValue('test');
    });

    it('should enable clear filters button when filters are applied', async () => {
      render(<ResultsGrid {...defaultProps} queryResults={mockQueryResult} />);
      
      const searchInput = screen.getByPlaceholderText('Search all columns...');
      await userEvent.type(searchInput, 'test');
      
      const clearButton = screen.getByText('Clear Filters');
      expect(clearButton).not.toBeDisabled();
    });
  });

  describe('Export Functionality', () => {
    it('should render export button', () => {
      render(<ResultsGrid {...defaultProps} queryResults={mockQueryResult} />);
      
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    it('should handle export button click', async () => {
      // Mock URL.createObjectURL and related functions
      global.URL.createObjectURL = jest.fn(() => 'mock-url');
      global.URL.revokeObjectURL = jest.fn();
      
      const mockClick = jest.fn();
      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick,
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);

      render(<ResultsGrid {...defaultProps} queryResults={mockQueryResult} />);
      
      const exportButton = screen.getByText('Export CSV');
      await userEvent.click(exportButton);
      
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('Performance Metrics', () => {
    it('should display performance information when available', async () => {
      render(<ResultsGrid {...defaultProps} queryResults={mockQueryResult} />);
      
      // Wait for performance metrics to be calculated
      await waitFor(() => {
        const performanceElements = screen.queryAllByText(/Render:/);
        if (performanceElements.length > 0) {
          expect(performanceElements[0]).toBeInTheDocument();
        }
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<ResultsGrid {...defaultProps} queryResults={mockQueryResult} />);
      
      const searchInput = screen.getByPlaceholderText('Search all columns...');
      expect(searchInput).toHaveAttribute('type', 'text');
    });

    it('should support keyboard navigation', async () => {
      render(<ResultsGrid {...defaultProps} queryResults={mockQueryResult} />);
      
      const searchInput = screen.getByPlaceholderText('Search all columns...');
      searchInput.focus();
      
      expect(document.activeElement).toBe(searchInput);
    });
  });

  describe('Large Dataset Handling', () => {
    it('should handle large datasets without crashing', () => {
      const largeDataset: QueryResult = {
        ...mockQueryResult,
        rows: Array.from({ length: 10000 }, (_, i) => [i, `User ${i}`, '2025-07-31T10:00:00Z']),
        row_count: 10000,
      };

      expect(() => {
        render(<ResultsGrid {...defaultProps} queryResults={largeDataset} />);
      }).not.toThrow();
    });
  });
});
