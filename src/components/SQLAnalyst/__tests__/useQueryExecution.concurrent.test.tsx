/**
 * Concurrent Query Execution Stress Tests
 * 
 * ZEUS DIRECTIVE COMPLIANCE - ATHENA'S PROACTIVE RECOMMENDATION:
 * "Add a new stress test scenario that simulates multiple, concurrent query 
 * executions to check for potential race conditions in the state management 
 * hook (useQueryExecution.ts)."
 * 
 * This test suite validates:
 * - Race condition prevention in concurrent query executions
 * - State consistency during rapid query cancellations
 * - Memory stability under concurrent load
 * - Proper cleanup of resources in high-stress scenarios
 */

import { renderHook, act } from '@testing-library/react';
import { useQueryExecution } from '../hooks/useQueryExecution';

// Mock Tauri invoke with realistic delays and potential failures
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

describe('useQueryExecution Concurrent Stress Tests (Zeus Directive)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('CRITICAL: Concurrent Query Execution Prevention', () => {
    it('should prevent multiple simultaneous query executions', async () => {
      mockInvoke.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          query_id: 'test',
          success: true,
          rows: [],
          columns: [],
          row_count: 0,
          execution_time: 100
        }), 1000))
      );

      const { result } = renderHook(() => useQueryExecution());

      // Attempt to execute multiple queries simultaneously
      const promises = [
        act(() => result.current.executeQuery('SELECT 1', 'conn1')),
        act(() => result.current.executeQuery('SELECT 2', 'conn1')),
        act(() => result.current.executeQuery('SELECT 3', 'conn1')),
      ];

      // Fast-forward timers to resolve promises
      act(() => {
        jest.advanceTimersByTime(1100);
      });

      await Promise.all(promises);

      // Should only execute one query (the first one)
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(result.current.executionState.isExecuting).toBe(false);
    });

    it('should handle rapid query cancellations without race conditions', async () => {
      let resolveQuery: (value: any) => void;
      mockInvoke.mockImplementation(() => 
        new Promise(resolve => {
          resolveQuery = resolve;
        })
      );

      const { result } = renderHook(() => useQueryExecution());

      // Start a query
      act(() => {
        result.current.executeQuery('SELECT * FROM large_table', 'conn1');
      });

      expect(result.current.executionState.isExecuting).toBe(true);
      expect(result.current.executionState.canCancel).toBe(true);

      // Rapidly cancel and restart queries
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.cancelQuery();
        });
        
        act(() => {
          result.current.executeQuery(`SELECT ${i}`, 'conn1');
        });
      }

      // State should be consistent
      expect(result.current.executionState.isExecuting).toBe(false);
      expect(result.current.executionState.canCancel).toBe(false);
      expect(result.current.executionState.currentExecution?.status).toBe('cancelled');
    });
  });

  describe('State Consistency Under Stress', () => {
    it('should maintain state consistency during concurrent operations', async () => {
      const queryResults = Array.from({ length: 50 }, (_, i) => ({
        query_id: `query-${i}`,
        success: true,
        rows: [[i, `Row ${i}`]],
        columns: [{ name: 'id', type: 'INTEGER', nullable: false }],
        row_count: 1,
        execution_time: Math.random() * 100
      }));

      let queryIndex = 0;
      mockInvoke.mockImplementation(() => 
        Promise.resolve(queryResults[queryIndex++ % queryResults.length])
      );

      const { result } = renderHook(() => useQueryExecution());

      // Execute many queries in rapid succession
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(
          act(async () => {
            if (Math.random() > 0.7) {
              // 30% chance to cancel
              result.current.cancelQuery();
            } else {
              // 70% chance to execute new query
              await result.current.executeQuery(`SELECT ${i}`, 'conn1');
            }
          })
        );
      }

      await Promise.all(operations);

      // Verify state consistency
      const state = result.current.executionState;
      expect(state.executionHistory.length).toBeLessThanOrEqual(50); // Max history limit
      expect(typeof state.isExecuting).toBe('boolean');
      expect(typeof state.canCancel).toBe('boolean');
      
      // If there's a current execution, it should have valid properties
      if (state.currentExecution) {
        expect(state.currentExecution.id).toBeDefined();
        expect(state.currentExecution.startTime).toBeInstanceOf(Date);
        expect(['pending', 'running', 'completed', 'error', 'cancelled']).toContain(state.currentExecution.status);
      }
    });

    it('should handle query timeout scenarios correctly', async () => {
      // Mock a query that times out
      mockInvoke.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 500)
        )
      );

      const { result } = renderHook(() => useQueryExecution());

      await act(async () => {
        try {
          await result.current.executeQuery('SELECT * FROM slow_table', 'conn1');
        } catch (error) {
          // Expected to fail
        }
      });

      act(() => {
        jest.advanceTimersByTime(600);
      });

      expect(result.current.executionState.currentExecution?.status).toBe('error');
      expect(result.current.executionState.isExecuting).toBe(false);
      expect(result.current.executionState.canCancel).toBe(false);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should properly cleanup resources during stress testing', async () => {
      const abortSpy = jest.fn();
      const mockAbortController = {
        signal: { aborted: false, addEventListener: jest.fn() },
        abort: abortSpy
      };

      // Mock AbortController
      global.AbortController = jest.fn(() => mockAbortController) as any;

      mockInvoke.mockResolvedValue({
        query_id: 'test',
        success: true,
        rows: [],
        columns: [],
        row_count: 0,
        execution_time: 50
      });

      const { result, unmount } = renderHook(() => useQueryExecution());

      // Execute and cancel many queries
      for (let i = 0; i < 20; i++) {
        await act(async () => {
          await result.current.executeQuery(`SELECT ${i}`, 'conn1');
        });
        
        act(() => {
          result.current.cancelQuery();
        });
      }

      // Unmount component
      unmount();

      // Verify cleanup occurred
      expect(abortSpy).toHaveBeenCalled();
    });

    it('should limit execution history to prevent memory leaks', async () => {
      mockInvoke.mockResolvedValue({
        query_id: 'test',
        success: true,
        rows: [],
        columns: [],
        row_count: 0,
        execution_time: 10
      });

      const { result } = renderHook(() => useQueryExecution());

      // Execute more queries than the history limit (50)
      for (let i = 0; i < 75; i++) {
        await act(async () => {
          await result.current.executeQuery(`SELECT ${i}`, 'conn1');
        });
      }

      // History should be capped at 50 entries
      expect(result.current.executionState.executionHistory.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Error Handling Under Concurrent Load', () => {
    it('should handle mixed success/failure scenarios', async () => {
      let callCount = 0;
      mockInvoke.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('Simulated database error'));
        }
        return Promise.resolve({
          query_id: `query-${callCount}`,
          success: true,
          rows: [[callCount]],
          columns: [{ name: 'id', type: 'INTEGER', nullable: false }],
          row_count: 1,
          execution_time: 25
        });
      });

      const { result } = renderHook(() => useQueryExecution());

      // Execute multiple queries with mixed outcomes
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          act(async () => {
            try {
              await result.current.executeQuery(`SELECT ${i}`, 'conn1');
            } catch (error) {
              // Some queries expected to fail
            }
          })
        );
      }

      await Promise.all(promises);

      // Verify that both successful and failed executions are in history
      const history = result.current.executionState.executionHistory;
      const successfulQueries = history.filter(e => e.status === 'completed');
      const failedQueries = history.filter(e => e.status === 'error');

      expect(successfulQueries.length).toBeGreaterThan(0);
      expect(failedQueries.length).toBeGreaterThan(0);
      expect(successfulQueries.length + failedQueries.length).toBe(history.length);
    });

    it('should handle network interruption scenarios', async () => {
      // Simulate network interruption
      mockInvoke.mockImplementation(() => 
        Promise.reject(new Error('Network connection lost'))
      );

      const { result } = renderHook(() => useQueryExecution());

      await act(async () => {
        try {
          await result.current.executeQuery('SELECT * FROM remote_table', 'conn1');
        } catch (error) {
          // Expected to fail
        }
      });

      expect(result.current.executionState.currentExecution?.status).toBe('error');
      expect(result.current.executionState.currentExecution?.error).toContain('connection');
    });
  });

  describe('Performance Under Concurrent Load', () => {
    it('should maintain performance with rapid state updates', async () => {
      mockInvoke.mockResolvedValue({
        query_id: 'perf-test',
        success: true,
        rows: Array.from({ length: 1000 }, (_, i) => [i, `Row ${i}`]),
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false },
          { name: 'name', type: 'VARCHAR', nullable: true }
        ],
        row_count: 1000,
        execution_time: 150
      });

      const { result } = renderHook(() => useQueryExecution());

      const startTime = performance.now();

      // Perform rapid operations
      for (let i = 0; i < 50; i++) {
        await act(async () => {
          await result.current.executeQuery(`SELECT * FROM table_${i}`, 'conn1');
        });
        
        if (i % 5 === 0) {
          act(() => {
            result.current.clearHistory();
          });
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(totalTime).toBeLessThan(5000); // 5 seconds max for 50 operations
      expect(result.current.executionState.executionHistory.length).toBeLessThanOrEqual(50);
    });
  });
});
