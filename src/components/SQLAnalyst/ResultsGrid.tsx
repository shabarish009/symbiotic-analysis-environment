import React, { useMemo, useState, useCallback, useEffect, memo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { QueryResult, ResultsGridProps, PerformanceMetrics } from './types';
import { Button } from '../UI/Button';
import './ResultsGrid.css';

const columnHelper = createColumnHelper<any>();

// Memoized cell component for better performance
const CellContent = memo<{ value: any }>(({ value }) => (
  <div className="cell-content" title={String(value)}>
    {value === null ? (
      <span className="null-value">NULL</span>
    ) : (
      String(value)
    )}
  </div>
));

CellContent.displayName = 'CellContent';

// Memoized column header component
const ColumnHeader = memo<{ name: string; type: string; nullable: boolean }>(({ name, type, nullable }) => (
  <div className="column-header">
    <span className="column-name">{name}</span>
    <span className="column-type">{type}</span>
    {!nullable && <span className="not-null-indicator">*</span>}
  </div>
));

ColumnHeader.displayName = 'ColumnHeader';

export const ResultsGrid: React.FC<ResultsGridProps> = memo(({
  queryResults,
  isLoading,
  error,
  onCancelQuery,
  onRetryQuery,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100, // Optimized for virtualization
  });
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);

  // Create table columns from query results
  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!queryResults?.columns) return [];

    return queryResults.columns.map((col, index) =>
      columnHelper.accessor(index.toString(), {
        id: col.name,
        header: () => <ColumnHeader name={col.name} type={col.type} nullable={col.nullable} />,
        cell: (info) => <CellContent value={info.getValue()} />,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: 'includesString',
        sortingFn: 'alphanumeric',
        size: 150,
        minSize: 100,
        maxSize: 400,
      })
    );
  }, [queryResults?.columns]);

  // Transform rows data for the table
  const data = useMemo(() => {
    if (!queryResults?.rows) return [];
    return queryResults.rows;
  }, [queryResults?.rows]);

  // Create the table instance
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: false,
    enableMultiSort: true,
    manualPagination: false,
    debugTable: false,
  });

  // Virtualization for large datasets
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: useCallback(() => 35, []), // Memoized size estimator
    overscan: data.length > 10000 ? 5 : 10, // Reduce overscan for very large datasets
    measureElement: undefined, // Disable measurement for better performance
    scrollMargin: tableContainerRef.current?.offsetTop ?? 0,
  });

  // Performance monitoring with requestIdleCallback for better performance
  useEffect(() => {
    if (queryResults && data.length > 0) {
      const startTime = performance.now();

      // Use requestIdleCallback for non-critical performance measurements
      const idleCallback = (deadline: IdleDeadline) => {
        if (deadline.timeRemaining() > 0) {
          const renderTime = performance.now() - startTime;

          setPerformanceMetrics({
            renderTime,
            scrollPerformance: 0, // Will be updated during scrolling
            memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
            rowsRendered: rowVirtualizer.getVirtualItems().length,
            totalRows: data.length,
            virtualizationEnabled: data.length > 100,
          });
        }
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(idleCallback);
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => idleCallback({ timeRemaining: () => 50 } as IdleDeadline), 0);
      }
    }
  }, [queryResults, data.length, rowVirtualizer]);

  // Handle column filter changes
  const handleColumnFilter = useCallback((columnId: string, value: string) => {
    setColumnFilters(prev => 
      prev.filter(filter => filter.id !== columnId).concat(
        value ? [{ id: columnId, value }] : []
      )
    );
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setColumnFilters([]);
    setGlobalFilter('');
  }, []);

  // Export functionality (placeholder)
  const handleExport = useCallback(() => {
    if (!queryResults) return;
    
    // Create CSV content
    const headers = queryResults.columns.map(col => col.name).join(',');
    const csvRows = queryResults.rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headers, ...csvRows].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_results_${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [queryResults]);

  // Loading state
  if (isLoading) {
    return (
      <div className="results-grid-container">
        <div className="results-header">
          <h3>Query Results</h3>
          <div className="results-actions">
            <Button
              variant="secondary"
              size="small"
              onClick={onCancelQuery}
              icon="⏹️"
            >
              Cancel Query
            </Button>
          </div>
        </div>
        <div className="results-loading">
          <div className="loading-spinner"></div>
          <span>Executing query...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="results-grid-container">
        <div className="results-header">
          <h3>Query Results</h3>
          <div className="results-actions">
            {onRetryQuery && (
              <Button
                variant="primary"
                size="small"
                onClick={onRetryQuery}
                icon="🔄"
              >
                Retry
              </Button>
            )}
          </div>
        </div>
        <div className="results-error">
          <div className="error-icon">⚠️</div>
          <div className="error-content">
            <h4>Query Execution Failed</h4>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // No results state
  if (!queryResults) {
    return (
      <div className="results-grid-container">
        <div className="results-header">
          <h3>Query Results</h3>
        </div>
        <div className="results-placeholder">
          <div className="placeholder-icon">📊</div>
          <h4>Ready to Execute</h4>
          <p>Run a query to see results here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="results-grid-container">
      {/* Results Header */}
      <div className="results-header">
        <div className="results-info">
          <h3>Query Results</h3>
          <div className="results-metadata">
            <span className="row-count">{queryResults.row_count.toLocaleString()} rows</span>
            <span className="execution-time">{queryResults.execution_time}ms</span>
            {queryResults.affected_rows !== undefined && (
              <span className="affected-rows">{queryResults.affected_rows} affected</span>
            )}
          </div>
        </div>
        <div className="results-actions">
          <Button
            variant="secondary"
            size="small"
            onClick={clearFilters}
            disabled={columnFilters.length === 0 && !globalFilter}
            icon="🗑️"
          >
            Clear Filters
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={handleExport}
            icon="📥"
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Global Search */}
      <div className="results-toolbar">
        <div className="global-search">
          <input
            type="text"
            placeholder="Search all columns..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="search-input"
          />
        </div>
        {performanceMetrics && (
          <div className="performance-info">
            <span>Render: {performanceMetrics.renderTime.toFixed(1)}ms</span>
            <span>Rows: {performanceMetrics.rowsRendered}/{performanceMetrics.totalRows}</span>
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="results-table-container" ref={tableContainerRef}>
        <table className="results-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={header.column.getCanSort() ? 'sortable' : ''}
                  >
                    <div
                      className="header-content"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() && (
                        <span className="sort-indicator">
                          {header.column.getIsSorted() === 'desc' ? ' ↓' : ' ↑'}
                        </span>
                      )}
                    </div>
                    {header.column.getCanFilter() && (
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={(header.column.getFilterValue() as string) ?? ''}
                        onChange={(e) => handleColumnFilter(header.id, e.target.value)}
                        className="column-filter"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="results-pagination">
        <div className="pagination-info">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )}{' '}
          of {table.getFilteredRowModel().rows.length} entries
        </div>
        <div className="pagination-controls">
          <Button
            variant="secondary"
            size="small"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            {'<<'}
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {'<'}
          </Button>
          <span className="page-info">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="secondary"
            size="small"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {'>'}
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            {'>>'}
          </Button>
        </div>
      </div>
    </div>
  );
});

ResultsGrid.displayName = 'ResultsGrid';
