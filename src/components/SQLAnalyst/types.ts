// SQL Analyst specific types for query execution and results

export interface QueryResult {
  query_id: string;
  columns: ColumnDefinition[];
  rows: any[][];
  row_count: number;
  execution_time: number;
  affected_rows?: number;
  success: boolean;
  error?: string;
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
}

export interface QueryExecution {
  id: string;
  query: string;
  connectionId: string;
  status: QueryExecutionStatus;
  startTime: Date;
  endTime?: Date;
  result?: QueryResult;
  error?: string;
  progress?: QueryProgress;
}

export type QueryExecutionStatus = 
  | 'pending'
  | 'running' 
  | 'completed'
  | 'error'
  | 'cancelled';

export interface QueryProgress {
  stage: string;
  message: string;
  percentage?: number;
  timestamp: Date;
}

export interface ResultsGridProps {
  queryResults: QueryResult | null;
  isLoading: boolean;
  error: string | null;
  onCancelQuery: () => void;
  onRetryQuery?: () => void;
}

export interface QueryExecutionState {
  currentExecution: QueryExecution | null;
  executionHistory: QueryExecution[];
  isExecuting: boolean;
  canCancel: boolean;
}

// TanStack Table column definition
export interface TableColumn {
  id: string;
  header: string;
  accessorKey: string;
  cell?: (info: any) => React.ReactNode;
  enableSorting?: boolean;
  enableColumnFilter?: boolean;
  filterFn?: string;
  sortingFn?: string;
  size?: number;
  minSize?: number;
  maxSize?: number;
}

// Filtering and sorting state
export interface TableState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
  pagination: PaginationState;
}

export type SortingState = {
  id: string;
  desc: boolean;
}[];

export type ColumnFiltersState = {
  id: string;
  value: unknown;
}[];

export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

// Performance metrics for large datasets
export interface PerformanceMetrics {
  renderTime: number;
  scrollPerformance: number;
  memoryUsage: number;
  rowsRendered: number;
  totalRows: number;
  virtualizationEnabled: boolean;
}

// Query execution options
export interface QueryExecutionOptions {
  timeout?: number; // in milliseconds
  maxRows?: number;
  enableProgress?: boolean;
  enableCancellation?: boolean;
}

// Error types for better error handling
export interface QueryError {
  type: 'syntax' | 'connection' | 'execution' | 'timeout' | 'cancelled';
  message: string;
  details?: string;
  line?: number;
  column?: number;
  suggestion?: string;
}
