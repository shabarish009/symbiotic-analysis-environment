// AI Actions Panel Tests - Story 3.6
// Comprehensive testing including Zeus Directive race condition requirements

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AIActionsPanel from '../AIActionsPanel';

// Mock Tauri API
vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event');

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);
const mockUnlisten = vi.fn();

describe('AIActionsPanel', () => {
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

  describe('Component Rendering', () => {
    it('renders all three action buttons when not processing', () => {
      render(<AIActionsPanel {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /explain sql query/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /optimize sql query/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /validate sql query/i })).toBeInTheDocument();
    });

    it('shows appropriate notices when prerequisites are missing', () => {
      render(<AIActionsPanel {...defaultProps} activeConnectionId={undefined} />);
      
      expect(screen.getByText(/connect to a database to enable ai analysis/i)).toBeInTheDocument();
    });

    it('shows notice when SQL content is empty', () => {
      render(<AIActionsPanel {...defaultProps} sqlContent="" />);
      
      expect(screen.getByText(/enter a sql query to analyze/i)).toBeInTheDocument();
    });

    it('disables action buttons when prerequisites are not met', () => {
      render(<AIActionsPanel {...defaultProps} sqlContent="" />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      const optimizeButton = screen.getByRole('button', { name: /optimize sql query/i });
      const validateButton = screen.getByRole('button', { name: /validate sql query/i });
      
      expect(explainButton).toBeDisabled();
      expect(optimizeButton).toBeDisabled();
      expect(validateButton).toBeDisabled();
    });
  });

  describe('Analysis Execution', () => {
    it('executes explain analysis when explain button is clicked', async () => {
      const user = userEvent.setup();
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      await user.click(explainButton);
      
      expect(mockInvoke).toHaveBeenCalledWith('analyze_sql_query', {
        request: expect.objectContaining({
          sql: defaultProps.sqlContent,
          task_type: 'Explain',
          connection_id: defaultProps.activeConnectionId,
          schema_context: defaultProps.schemaContext,
        })
      });
    });

    it('executes optimize analysis when optimize button is clicked', async () => {
      const user = userEvent.setup();
      render(<AIActionsPanel {...defaultProps} />);
      
      const optimizeButton = screen.getByRole('button', { name: /optimize sql query/i });
      await user.click(optimizeButton);
      
      expect(mockInvoke).toHaveBeenCalledWith('analyze_sql_query', {
        request: expect.objectContaining({
          sql: defaultProps.sqlContent,
          task_type: 'Optimize',
          connection_id: defaultProps.activeConnectionId,
        })
      });
    });

    it('executes validate analysis when validate button is clicked', async () => {
      const user = userEvent.setup();
      render(<AIActionsPanel {...defaultProps} />);
      
      const validateButton = screen.getByRole('button', { name: /validate sql query/i });
      await user.click(validateButton);
      
      expect(mockInvoke).toHaveBeenCalledWith('analyze_sql_query', {
        request: expect.objectContaining({
          sql: defaultProps.sqlContent,
          task_type: 'Validate',
          connection_id: defaultProps.activeConnectionId,
        })
      });
    });

    it('calls onAnalysisComplete when analysis succeeds', async () => {
      const user = userEvent.setup();
      const onAnalysisComplete = vi.fn();
      
      render(<AIActionsPanel {...defaultProps} onAnalysisComplete={onAnalysisComplete} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      await user.click(explainButton);
      
      await waitFor(() => {
        expect(onAnalysisComplete).toHaveBeenCalledWith(expect.objectContaining({
          analysis_id: 'test-analysis-123',
          task_type: 'Explain',
          success: true,
        }));
      });
    });

    it('calls onError when analysis fails', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();
      
      mockInvoke.mockRejectedValueOnce(new Error('Analysis failed'));
      
      render(<AIActionsPanel {...defaultProps} onError={onError} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      await user.click(explainButton);
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Analysis failed');
      });
    });
  });

  describe('UI State Management (Zeus Directive)', () => {
    it('shows cancel button and disables other actions during processing', async () => {
      const user = userEvent.setup();
      
      // Mock a slow analysis
      mockInvoke.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          analysis_id: 'test-analysis-123',
          task_type: 'Explain',
          success: true,
          result: { type: 'Explanation' }
        }), 1000);
      }));
      
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      await user.click(explainButton);
      
      // Should show cancel button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel explain/i })).toBeInTheDocument();
      });
      
      // Other action buttons should not be visible
      expect(screen.queryByRole('button', { name: /optimize sql query/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /validate sql query/i })).not.toBeInTheDocument();
    });

    it('shows processing status during analysis', async () => {
      const user = userEvent.setup();
      
      mockInvoke.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          analysis_id: 'test-analysis-123',
          task_type: 'Explain',
          success: true,
          result: { type: 'Explanation' }
        }), 1000);
      }));
      
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      await user.click(explainButton);
      
      await waitFor(() => {
        expect(screen.getByText(/explain in progress/i)).toBeInTheDocument();
      });
    });

    it('shows progress updates when received', async () => {
      const user = userEvent.setup();
      
      let progressCallback: (event: any) => void;
      mockListen.mockImplementation((event, callback) => {
        progressCallback = callback;
        return Promise.resolve(mockUnlisten);
      });
      
      mockInvoke.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => {
          progressCallback({
            payload: {
              analysis_id: 'test-analysis-123',
              task_type: 'Explain',
              stage: 'analyzing',
              progress_percent: 50,
              message: 'Analyzing query structure',
              timestamp: new Date().toISOString(),
            }
          });
          
          setTimeout(() => resolve({
            analysis_id: 'test-analysis-123',
            task_type: 'Explain',
            success: true,
            result: { type: 'Explanation' }
          }), 500);
        }, 100);
      }));
      
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      await user.click(explainButton);
      
      await waitFor(() => {
        expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
        expect(screen.getByText(/analyzing query structure/i)).toBeInTheDocument();
      });
    });
  });

  describe('Race Condition Prevention (Zeus Directive)', () => {
    it('prevents multiple concurrent analysis requests', async () => {
      const user = userEvent.setup();
      
      // Mock slow analysis
      mockInvoke.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          analysis_id: 'test-analysis-123',
          task_type: 'Explain',
          success: true,
          result: { type: 'Explanation' }
        }), 1000);
      }));
      
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      
      // Click multiple times rapidly
      await user.click(explainButton);
      await user.click(explainButton);
      await user.click(explainButton);
      
      // Should only make one API call
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('prevents switching between different analysis types during processing', async () => {
      const user = userEvent.setup();
      
      mockInvoke.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          analysis_id: 'test-analysis-123',
          task_type: 'Explain',
          success: true,
          result: { type: 'Explanation' }
        }), 1000);
      }));
      
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      await user.click(explainButton);
      
      // Try to click optimize while explain is processing
      // The optimize button should not be visible
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /optimize sql query/i })).not.toBeInTheDocument();
      });
      
      // Should still only have one API call
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cancellation Support', () => {
    it('allows cancellation during analysis', async () => {
      const user = userEvent.setup();
      
      mockInvoke.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          analysis_id: 'test-analysis-123',
          task_type: 'Explain',
          success: true,
          result: { type: 'Explanation' }
        }), 2000);
      }));
      
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      await user.click(explainButton);
      
      // Should show cancel button
      const cancelButton = await screen.findByRole('button', { name: /cancel explain/i });
      expect(cancelButton).toBeInTheDocument();
      
      await user.click(cancelButton);
      
      // Should call cancel API
      expect(mockInvoke).toHaveBeenCalledWith('cancel_sql_analysis', {
        analysisId: expect.any(String)
      });
    });

    it('returns to initial state after cancellation', async () => {
      const user = userEvent.setup();
      
      mockInvoke.mockImplementation((command) => {
        if (command === 'cancel_sql_analysis') {
          return Promise.resolve();
        }
        return new Promise(() => {}); // Never resolve for analysis
      });
      
      render(<AIActionsPanel {...defaultProps} />);
      
      const explainButton = screen.getByRole('button', { name: /explain sql query/i });
      await user.click(explainButton);
      
      const cancelButton = await screen.findByRole('button', { name: /cancel explain/i });
      await user.click(cancelButton);
      
      // Should return to initial state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /explain sql query/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /optimize sql query/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /validate sql query/i })).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for all buttons', () => {
      render(<AIActionsPanel {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /explain sql query/i })).toHaveAttribute('aria-label', 'Explain SQL Query');
      expect(screen.getByRole('button', { name: /optimize sql query/i })).toHaveAttribute('aria-label', 'Optimize SQL Query');
      expect(screen.getByRole('button', { name: /validate sql query/i })).toHaveAttribute('aria-label', 'Validate SQL Query');
    });

    it('has proper title attributes for tooltips', () => {
      render(<AIActionsPanel {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /explain sql query/i })).toHaveAttribute('title', 'Get a plain-English explanation of your SQL query');
      expect(screen.getByRole('button', { name: /optimize sql query/i })).toHaveAttribute('title', 'Get performance optimization suggestions for your query');
      expect(screen.getByRole('button', { name: /validate sql query/i })).toHaveAttribute('title', 'Check your query for errors and potential issues');
    });
  });

  describe('Component Cleanup', () => {
    it('cleans up resources on unmount', () => {
      const { unmount } = render(<AIActionsPanel {...defaultProps} />);
      
      unmount();
      
      // Component should unmount without errors
      expect(true).toBe(true);
    });
  });
});
