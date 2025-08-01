// AI Actions Panel Race Condition Tests - Story 3.6
// Zeus Directive: Mandatory race condition testing for rapid analysis triggering

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AIActionsPanel from '../AIActionsPanel';

// Mock Tauri API with race condition simulation
vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event');

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);
const mockUnlisten = vi.fn();

describe('AIActionsPanel - Race Condition Stress Tests (Zeus Directive)', () => {
  const defaultProps = {
    sqlContent: 'SELECT * FROM users WHERE id = 1;',
    activeConnectionId: 'test-connection-123',
    schemaContext: { tables: ['users'] },
    onAnalysisComplete: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockListen.mockResolvedValue(mockUnlisten);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rapid Successive Analysis Requests', () => {
    it('handles rapid clicking of the same analysis type', async () => {
      const user = userEvent.setup();
      let callCount = 0;
      
      mockInvoke.mockImplementation(() => {
        callCount++;
        return new Promise(resolve => {
          setTimeout(() => resolve({
            analysis_id: `test-analysis-${callCount}`,
            task_type: 'Explain',
            success: true,
            result: { type: 'Explanation', summary: 'Test explanation' }
          }), 100);
        });
      });
      
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      
      // Rapid fire clicks
      await user.click(explainButton);
      await user.click(explainButton);
      await user.click(explainButton);
      await user.click(explainButton);
      await user.click(explainButton);
      
      // Should only make one API call due to race condition prevention
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(callCount).toBe(1);
    });

    it('handles rapid switching between different analysis types', async () => {
      const user = userEvent.setup();
      let callCount = 0;
      
      mockInvoke.mockImplementation(() => {
        callCount++;
        return new Promise(resolve => {
          setTimeout(() => resolve({
            analysis_id: `test-analysis-${callCount}`,
            task_type: 'Explain',
            success: true,
            result: { type: 'Explanation', summary: 'Test explanation' }
          }), 200);
        });
      });
      
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      
      // Start with explain
      await user.click(explainButton);
      
      // Wait for processing state
      await waitFor(() => {
        expect(screen.getByText(/explain in progress/i)).toBeInTheDocument();
      });
      
      // Try to click other buttons (they should not be visible)
      expect(screen.queryByRole('button', { name: /optimize sql query/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /validate sql query/i })).not.toBeInTheDocument();
      
      // Should only have one API call
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(callCount).toBe(1);
    });

    it('handles analysis requests during component state transitions', async () => {
      const user = userEvent.setup();
      let resolveAnalysis: (value: any) => void;
      
      mockInvoke.mockImplementation(() => {
        return new Promise(resolve => {
          resolveAnalysis = resolve;
        });
      });
      
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      
      // Start analysis
      await user.click(explainButton);
      
      // Try to click again while transitioning to processing state
      await user.click(explainButton);
      await user.click(explainButton);
      
      // Complete the analysis
      resolveAnalysis({
        analysis_id: 'test-analysis-123',
        task_type: 'Explain',
        success: true,
        result: { type: 'Explanation', summary: 'Test explanation' }
      });
      
      // Should only have one API call
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cancellation During Analysis Switching', () => {
    it('handles cancellation followed by immediate new analysis request', async () => {
      const user = userEvent.setup();
      let analysisPromiseResolve: (value: any) => void;
      
      mockInvoke.mockImplementation((command) => {
        if (command === 'analyze_sql_query') {
          return new Promise(resolve => {
            analysisPromiseResolve = resolve;
          });
        }
        if (command === 'cancel_sql_analysis') {
          // Simulate successful cancellation
          if (analysisPromiseResolve) {
            analysisPromiseResolve({
              analysis_id: 'test-analysis-123',
              task_type: 'Explain',
              success: false,
              error_message: 'Analysis cancelled'
            });
          }
          return Promise.resolve();
        }
        return Promise.resolve();
      });
      
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      
      // Start analysis
      await user.click(explainButton);
      
      // Wait for cancel button to appear
      const cancelButton = await screen.findByRole('button', { name: /cancel explain/i });
      
      // Cancel the analysis
      await user.click(cancelButton);
      
      // Wait for return to initial state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /explain sql query/i })).toBeInTheDocument();
      });
      
      // Immediately start a new analysis
      await user.click(explainButton);
      
      // Should have made 2 analysis calls and 1 cancel call
      expect(mockInvoke).toHaveBeenCalledWith('analyze_sql_query', expect.any(Object));
      expect(mockInvoke).toHaveBeenCalledWith('cancel_sql_analysis', expect.any(Object));
      expect(mockInvoke).toHaveBeenCalledTimes(3); // 2 analysis + 1 cancel
    });

    it('prevents new analysis during cancellation process', async () => {
      const user = userEvent.setup();
      let cancelPromiseResolve: () => void;
      
      mockInvoke.mockImplementation((command) => {
        if (command === 'analyze_sql_query') {
          return new Promise(() => {}); // Never resolve
        }
        if (command === 'cancel_sql_analysis') {
          return new Promise(resolve => {
            cancelPromiseResolve = resolve;
          });
        }
        return Promise.resolve();
      });
      
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      
      // Start analysis
      await user.click(explainButton);
      
      // Wait for cancel button
      const cancelButton = await screen.findByRole('button', { name: /cancel explain/i });
      
      // Start cancellation (but don't complete it)
      await user.click(cancelButton);
      
      // Try to start new analysis while cancellation is in progress
      // The button should not be available yet
      expect(screen.queryByRole('button', { name: /explain sql query/i })).not.toBeInTheDocument();
      
      // Complete cancellation
      cancelPromiseResolve();
      
      // Now the button should be available again
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /explain sql query/i })).toBeInTheDocument();
      });
    });
  });

  describe('Component Unmount During Active Analysis', () => {
    it('handles component unmount during analysis without memory leaks', async () => {
      const user = userEvent.setup();
      
      mockInvoke.mockImplementation(() => {
        return new Promise(() => {}); // Never resolve to simulate long-running analysis
      });
      
      const { unmount } = render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      
      // Start analysis
      await user.click(explainButton);
      
      // Wait for processing state
      await waitFor(() => {
        expect(screen.getByText(/explain in progress/i)).toBeInTheDocument();
      });
      
      // Unmount component during analysis
      unmount();
      
      // Should not throw errors or cause memory leaks
      expect(mockUnlisten).toHaveBeenCalled();
    });

    it('handles component unmount during progress updates', async () => {
      const user = userEvent.setup();
      let progressCallback: (event: any) => void;
      
      mockListen.mockImplementation((event, callback) => {
        progressCallback = callback;
        return Promise.resolve(mockUnlisten);
      });
      
      mockInvoke.mockImplementation(() => {
        // Simulate progress updates
        setTimeout(() => {
          progressCallback({
            payload: {
              analysis_id: 'test-analysis-123',
              task_type: 'Explain',
              stage: 'analyzing',
              progress_percent: 25,
              message: 'Starting analysis',
              timestamp: new Date().toISOString(),
            }
          });
        }, 100);
        
        return new Promise(() => {}); // Never resolve
      });
      
      const { unmount } = render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      
      // Start analysis
      await user.click(explainButton);
      
      // Wait for progress to start
      await waitFor(() => {
        expect(screen.getByText(/starting analysis/i)).toBeInTheDocument();
      });
      
      // Unmount during progress updates
      unmount();
      
      // Should clean up properly
      expect(mockUnlisten).toHaveBeenCalled();
    });
  });

  describe('Network Interruption Scenarios', () => {
    it('handles network timeout during analysis', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();
      
      mockInvoke.mockRejectedValue(new Error('Network timeout'));
      
      render(<AIActionsPanel {...defaultProps} onError={onError} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      
      // Start analysis
      await user.click(explainButton);
      
      // Should handle error and return to initial state
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Network timeout');
        expect(screen.getByRole('button', { name: /explain sql query/i })).toBeInTheDocument();
      });
    });

    it('handles analysis timeout with proper cleanup', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();
      
      // Mock a very slow analysis that will timeout
      mockInvoke.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({
            analysis_id: 'test-analysis-123',
            task_type: 'Explain',
            success: true,
            result: { type: 'Explanation' }
          }), 40000); // 40 seconds - longer than 35 second timeout
        });
      });
      
      render(<AIActionsPanel {...defaultProps} onError={onError} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      
      // Start analysis
      await user.click(explainButton);
      
      // Should timeout and call error handler
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Analysis timeout');
      }, { timeout: 36000 }); // Wait for timeout
      
      // Should return to initial state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /explain sql query/i })).toBeInTheDocument();
      });
    });
  });

  describe('Concurrent Analysis Requests Validation', () => {
    it('validates that only one analysis can be active at a time', async () => {
      const user = userEvent.setup();
      let activeAnalysisCount = 0;
      
      mockInvoke.mockImplementation(() => {
        activeAnalysisCount++;
        return new Promise(resolve => {
          setTimeout(() => {
            activeAnalysisCount--;
            resolve({
              analysis_id: 'test-analysis-123',
              task_type: 'Explain',
              success: true,
              result: { type: 'Explanation' }
            });
          }, 500);
        });
      });
      
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      
      // Try to start multiple analyses
      await user.click(explainButton);
      await user.click(explainButton);
      await user.click(explainButton);
      
      // Should never have more than one active analysis
      expect(activeAnalysisCount).toBeLessThanOrEqual(1);
      
      // Wait for completion
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /explain sql query/i })).toBeInTheDocument();
      });
      
      expect(activeAnalysisCount).toBe(0);
    });

    it('ensures proper state isolation between different analysis types', async () => {
      const user = userEvent.setup();
      
      mockInvoke.mockImplementation((command, { request }) => {
        return Promise.resolve({
          analysis_id: `test-analysis-${request.task_type}`,
          task_type: request.task_type,
          success: true,
          result: { type: request.task_type === 'Explain' ? 'Explanation' : 'Optimization' }
        });
      });
      
      render(<AIActionsPanel {...defaultProps} />);
      
      // Start explain analysis
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      await user.click(explainButton);
      
      // Wait for completion
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /explain sql query/i })).toBeInTheDocument();
      });
      
      // Start optimize analysis
      const optimizeButton = screen.getByRole('button', { name: /optimize sql query/i });
      await user.click(optimizeButton);
      
      // Should have made two separate API calls with different task types
      expect(mockInvoke).toHaveBeenNthCalledWith(1, 'analyze_sql_query', {
        request: expect.objectContaining({ task_type: 'Explain' })
      });
      expect(mockInvoke).toHaveBeenNthCalledWith(2, 'analyze_sql_query', {
        request: expect.objectContaining({ task_type: 'Optimize' })
      });
    });
  });
});
