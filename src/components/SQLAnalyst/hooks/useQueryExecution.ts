import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { 
  QueryExecution, 
  QueryResult, 
  QueryExecutionState, 
  QueryExecutionOptions,
  QueryError 
} from '../types';

interface UseQueryExecutionReturn {
  executionState: QueryExecutionState;
  executeQuery: (query: string, connectionId: string, options?: QueryExecutionOptions) => Promise<void>;
  cancelQuery: () => void;
  clearHistory: () => void;
  retryLastQuery: () => Promise<void>;
}

export const useQueryExecution = (): UseQueryExecutionReturn => {
  const [executionState, setExecutionState] = useState<QueryExecutionState>({
    currentExecution: null,
    executionHistory: [],
    isExecuting: false,
    canCancel: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef<{ query: string; connectionId: string; options?: QueryExecutionOptions } | null>(null);
  const executionLockRef = useRef<boolean>(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const executeQuery = useCallback(async (
    query: string,
    connectionId: string,
    options: QueryExecutionOptions = {}
  ) => {
    // Prevent concurrent executions
    if (executionLockRef.current) {
      console.warn('Query execution already in progress. Ignoring new request.');
      return;
    }

    // Set execution lock
    executionLockRef.current = true;

    try {
      // Cancel any existing query
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();
    
    // Store query for retry functionality
    lastQueryRef.current = { query, connectionId, options };

    // Generate unique query ID
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create execution object
    const execution: QueryExecution = {
      id: queryId,
      query: query.trim(),
      connectionId,
      status: 'pending',
      startTime: new Date(),
    };

    // Update state to show execution started
    setExecutionState(prev => ({
      ...prev,
      currentExecution: execution,
      isExecuting: true,
      canCancel: true,
    }));

    try {
      // Add progress update
      const updatedExecution = {
        ...execution,
        status: 'running' as const,
        progress: {
          stage: 'executing',
          message: 'Executing SQL query...',
          timestamp: new Date(),
        },
      };

      setExecutionState(prev => ({
        ...prev,
        currentExecution: updatedExecution,
      }));

      // Execute query via Tauri command with abort signal monitoring
      const abortSignal = abortControllerRef.current.signal;

      // Set up abort signal listener for immediate cancellation response
      const abortPromise = new Promise<never>((_, reject) => {
        abortSignal.addEventListener('abort', () => {
          reject(new Error('Query was cancelled'));
        });
      });

      // Race between query execution and cancellation
      const result = await Promise.race([
        invoke<QueryResult>('execute_sql_query', {
          connectionId,
          query: query.trim(),
          queryId,
        }),
        abortPromise
      ]);

      // Double-check cancellation status after query completion
      if (abortSignal.aborted) {
        throw new Error('Query was cancelled');
      }

      // Update execution with results
      const completedExecution: QueryExecution = {
        ...updatedExecution,
        status: 'completed',
        endTime: new Date(),
        result,
      };

      setExecutionState(prev => ({
        ...prev,
        currentExecution: completedExecution,
        executionHistory: [completedExecution, ...prev.executionHistory.slice(0, 49)], // Keep last 50
        isExecuting: false,
        canCancel: false,
      }));

    } catch (error) {
      // Handle different types of errors
      let queryError: QueryError;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('cancelled') || errorMessage.includes('aborted')) {
        queryError = {
          type: 'cancelled',
          message: 'Query execution was cancelled',
        };
      } else if (errorMessage.includes('timeout')) {
        queryError = {
          type: 'timeout',
          message: 'Query execution timed out',
          suggestion: 'Try optimizing your query or increasing the timeout limit',
        };
      } else if (errorMessage.includes('syntax')) {
        queryError = {
          type: 'syntax',
          message: 'SQL syntax error',
          details: errorMessage,
          suggestion: 'Check your SQL syntax and try again',
        };
      } else if (errorMessage.includes('connection')) {
        queryError = {
          type: 'connection',
          message: 'Database connection error',
          details: errorMessage,
          suggestion: 'Check your database connection and try again',
        };
      } else {
        queryError = {
          type: 'execution',
          message: 'Query execution failed',
          details: errorMessage,
        };
      }

      const failedExecution: QueryExecution = {
        ...execution,
        status: 'error',
        endTime: new Date(),
        error: queryError.message,
      };

      setExecutionState(prev => ({
        ...prev,
        currentExecution: failedExecution,
        executionHistory: [failedExecution, ...prev.executionHistory.slice(0, 49)],
        isExecuting: false,
        canCancel: false,
      }));

      // Log error for debugging
      console.error('Query execution failed:', queryError);
    } finally {
      abortControllerRef.current = null;
      executionLockRef.current = false; // Always release the lock
    }
    } catch (lockError) {
      // Handle any errors in the lock mechanism itself
      console.error('Execution lock error:', lockError);
      executionLockRef.current = false;
      throw lockError;
    }
  }, []);

  const cancelQuery = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();

      // Update current execution status using functional state update to avoid race conditions
      setExecutionState(prev => {
        if (!prev.canCancel || !prev.currentExecution) {
          return prev; // No-op if cancellation is not allowed or no current execution
        }

        const cancelledExecution: QueryExecution = {
          ...prev.currentExecution,
          status: 'cancelled',
          endTime: new Date(),
          error: 'Query execution was cancelled by user',
        };

        return {
          ...prev,
          currentExecution: cancelledExecution,
          executionHistory: [cancelledExecution, ...prev.executionHistory.slice(0, 49)],
          isExecuting: false,
          canCancel: false,
        };
      });
    }
  }, []); // Remove dependencies to prevent stale closures

  const clearHistory = useCallback(() => {
    setExecutionState(prev => ({
      ...prev,
      executionHistory: [],
    }));
  }, []);

  const retryLastQuery = useCallback(async () => {
    if (lastQueryRef.current) {
      const { query, connectionId, options } = lastQueryRef.current;
      await executeQuery(query, connectionId, options);
    }
  }, [executeQuery]);

  return {
    executionState,
    executeQuery,
    cancelQuery,
    clearHistory,
    retryLastQuery,
  };
};

// Helper hook for query execution metrics
export const useQueryMetrics = (execution: QueryExecution | null) => {
  return {
    duration: execution?.endTime && execution?.startTime 
      ? execution.endTime.getTime() - execution.startTime.getTime()
      : null,
    isLongRunning: execution?.startTime 
      ? Date.now() - execution.startTime.getTime() > 10000 // 10 seconds
      : false,
    executionTime: execution?.result?.execution_time || null,
    rowCount: execution?.result?.row_count || 0,
    hasResults: execution?.result && execution.result.success && execution.result.row_count > 0,
  };
};

// Helper hook for performance monitoring
export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState({
    averageExecutionTime: 0,
    totalQueries: 0,
    successRate: 0,
    lastUpdated: new Date(),
  });

  const updateMetrics = useCallback((executions: QueryExecution[]) => {
    if (executions.length === 0) return;

    const completedExecutions = executions.filter(e => e.status === 'completed' && e.result);
    const totalExecutions = executions.length;
    const successfulExecutions = completedExecutions.length;

    const averageExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => sum + (e.result?.execution_time || 0), 0) / completedExecutions.length
      : 0;

    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    setMetrics({
      averageExecutionTime,
      totalQueries: totalExecutions,
      successRate,
      lastUpdated: new Date(),
    });
  }, []);

  return { metrics, updateMetrics };
};
