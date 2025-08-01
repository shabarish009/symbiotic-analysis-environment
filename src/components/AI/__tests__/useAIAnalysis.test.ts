// useAIAnalysis Hook Tests - Story 3.6 QA Enhancement
// Comprehensive testing for the dedicated AI analysis state management hook

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAIAnalysis } from '../hooks/useAIAnalysis';

// Mock Tauri API
vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event');

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);
const mockUnlisten = vi.fn();

describe('useAIAnalysis Hook', () => {
  const defaultOptions = {
    activeConnectionId: 'test-connection-123',
    schemaContext: { tables: ['users'] },
    onAnalysisComplete: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockListen.mockResolvedValue(mockUnlisten);
    mockInvoke.mockResolvedValue({
      analysis_id: 'test-analysis-123',
      task_type: 'Explain',
      success: true,
      result: {
        type: 'Explanation',
        summary: 'This query retrieves user data',
        detailed_steps: [],
        data_sources: ['users'],
        operations: ['SELECT'],
        expected_result_description: 'User records'
      },
      confidence_score: 0.95,
      execution_time_ms: 1500,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() => useAIAnalysis(defaultOptions));
      
      expect(result.current.activeTask).toBeNull();
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.progress).toBeNull();
      expect(result.current.canCancel).toBe(false);
      expect(result.current.analysisId).toBeNull();
    });

    it('provides utility functions', () => {
      const { result } = renderHook(() => useAIAnalysis(defaultOptions));
      
      expect(typeof result.current.executeAnalysis).toBe('function');
      expect(typeof result.current.cancelAnalysis).toBe('function');
      expect(typeof result.current.canPerformAnalysis).toBe('function');
      expect(typeof result.current.cleanup).toBe('function');
    });
  });

  describe('Analysis Execution', () => {
    it('executes analysis with correct parameters', async () => {
      const { result } = renderHook(() => useAIAnalysis(defaultOptions));
      
      await act(async () => {
        await result.current.executeAnalysis('Explain', 'SELECT * FROM users');
      });
      
      expect(mockInvoke).toHaveBeenCalledWith('analyze_sql_query', {
        request: expect.objectContaining({
          sql: 'SELECT * FROM users',
          task_type: 'Explain',
          connection_id: 'test-connection-123',
          schema_context: { tables: ['users'] },
        })
      });
    });

    it('updates state during analysis execution', async () => {
      const { result } = renderHook(() => useAIAnalysis(defaultOptions));
      
      // Mock slow analysis
      mockInvoke.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          analysis_id: 'test-analysis-123',
          task_type: 'Explain',
          success: true,
          result: { type: 'Explanation' }
        }), 100);
      }));
      
      const analysisPromise = act(async () => {
        await result.current.executeAnalysis('Explain', 'SELECT * FROM users');
      });
      
      // State should be updated immediately
      expect(result.current.activeTask).toBe('Explain');
      expect(result.current.isProcessing).toBe(true);
      expect(result.current.canCancel).toBe(true);
      
      await analysisPromise;
    });

    it('calls onAnalysisComplete on successful analysis', async () => {
      const onAnalysisComplete = vi.fn();
      const { result } = renderHook(() => useAIAnalysis({
        ...defaultOptions,
        onAnalysisComplete
      }));
      
      await act(async () => {
        await result.current.executeAnalysis('Explain', 'SELECT * FROM users');
      });
      
      expect(onAnalysisComplete).toHaveBeenCalledWith(expect.objectContaining({
        analysis_id: 'test-analysis-123',
        task_type: 'Explain',
        success: true,
      }));
    });

    it('calls onError on failed analysis', async () => {
      const onError = vi.fn();
      mockInvoke.mockRejectedValue(new Error('Analysis failed'));
      
      const { result } = renderHook(() => useAIAnalysis({
        ...defaultOptions,
        onError
      }));
      
      await act(async () => {
        await result.current.executeAnalysis('Explain', 'SELECT * FROM users');
      });
      
      expect(onError).toHaveBeenCalledWith('Analysis failed');
    });
  });

  describe('Race Condition Prevention', () => {
    it('prevents multiple concurrent analysis requests', async () => {
      const { result } = renderHook(() => useAIAnalysis(defaultOptions));
      
      // Mock slow analysis
      mockInvoke.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          analysis_id: 'test-analysis-123',
          task_type: 'Explain',
          success: true,
          result: { type: 'Explanation' }
        }), 1000);
      }));
      
      // Start multiple analyses rapidly
      const promises = [
        act(async () => { await result.current.executeAnalysis('Explain', 'SELECT * FROM users'); }),
        act(async () => { await result.current.executeAnalysis('Optimize', 'SELECT * FROM users'); }),
        act(async () => { await result.current.executeAnalysis('Validate', 'SELECT * FROM users'); }),
      ];
      
      await Promise.all(promises);
      
      // Should only make one API call
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('implements debounce mechanism', async () => {
      const { result } = renderHook(() => useAIAnalysis(defaultOptions));
      
      // Execute analysis
      await act(async () => {
        await result.current.executeAnalysis('Explain', 'SELECT * FROM users');
      });
      
      // Try to execute again immediately (should be debounced)
      await act(async () => {
        await result.current.executeAnalysis('Explain', 'SELECT * FROM users');
      });
      
      // Should only make one API call due to debounce
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('Validation', () => {
    it('validates SQL content', async () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useAIAnalysis({
        ...defaultOptions,
        onError
      }));
      
      await act(async () => {
        await result.current.executeAnalysis('Explain', '');
      });
      
      expect(onError).toHaveBeenCalledWith('Please enter a SQL query to analyze.');
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('validates connection ID', async () => {
      const onError = vi.fn();
      const { result } = renderHook(() => useAIAnalysis({
        ...defaultOptions,
        activeConnectionId: undefined,
        onError
      }));
      
      await act(async () => {
        await result.current.executeAnalysis('Explain', 'SELECT * FROM users');
      });
      
      expect(onError).toHaveBeenCalledWith('Please connect to a database first.');
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('canPerformAnalysis returns correct values', () => {
      const { result } = renderHook(() => useAIAnalysis(defaultOptions));
      
      expect(result.current.canPerformAnalysis('SELECT * FROM users')).toBe(true);
      expect(result.current.canPerformAnalysis('')).toBe(false);
      expect(result.current.canPerformAnalysis('   ')).toBe(false);
    });

    it('canPerformAnalysis checks connection', () => {
      const { result } = renderHook(() => useAIAnalysis({
        ...defaultOptions,
        activeConnectionId: undefined
      }));
      
      expect(result.current.canPerformAnalysis('SELECT * FROM users')).toBe(false);
    });
  });

  describe('Cancellation', () => {
    it('cancels active analysis', async () => {
      const { result } = renderHook(() => useAIAnalysis(defaultOptions));
      
      // Mock slow analysis
      mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolve
      
      // Start analysis
      act(() => {
        result.current.executeAnalysis('Explain', 'SELECT * FROM users');
      });
      
      // Cancel analysis
      await act(async () => {
        await result.current.cancelAnalysis();
      });
      
      expect(mockInvoke).toHaveBeenCalledWith('cancel_sql_analysis', {
        analysisId: expect.any(String)
      });
    });

    it('cleans up state after cancellation', async () => {
      const { result } = renderHook(() => useAIAnalysis(defaultOptions));
      
      // Mock cancellation
      mockInvoke.mockImplementation((command) => {
        if (command === 'cancel_sql_analysis') {
          return Promise.resolve();
        }
        return new Promise(() => {}); // Never resolve for analysis
      });
      
      // Start analysis
      act(() => {
        result.current.executeAnalysis('Explain', 'SELECT * FROM users');
      });
      
      // Cancel analysis
      await act(async () => {
        await result.current.cancelAnalysis();
      });
      
      // State should be cleaned up
      expect(result.current.activeTask).toBeNull();
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.canCancel).toBe(false);
      expect(result.current.analysisId).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('cleans up resources on unmount', () => {
      const { result, unmount } = renderHook(() => useAIAnalysis(defaultOptions));
      
      // Start analysis to set up listeners
      act(() => {
        result.current.executeAnalysis('Explain', 'SELECT * FROM users');
      });
      
      // Unmount should trigger cleanup
      unmount();
      
      // Should call unlisten function
      expect(mockUnlisten).toHaveBeenCalled();
    });

    it('manual cleanup resets all state', () => {
      const { result } = renderHook(() => useAIAnalysis(defaultOptions));
      
      // Start analysis
      act(() => {
        result.current.executeAnalysis('Explain', 'SELECT * FROM users');
      });
      
      // Manual cleanup
      act(() => {
        result.current.cleanup();
      });
      
      // State should be reset
      expect(result.current.activeTask).toBeNull();
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.progress).toBeNull();
      expect(result.current.canCancel).toBe(false);
      expect(result.current.analysisId).toBeNull();
    });
  });
});
