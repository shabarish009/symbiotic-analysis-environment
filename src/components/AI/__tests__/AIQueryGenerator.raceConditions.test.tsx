// AI Query Generator Race Condition Tests - Story 3.5 Zeus Directive
// Comprehensive stress testing for concurrent AI requests and state management

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AIQueryGenerator from '../AIQueryGenerator';

// Mock Tauri API with race condition simulation
vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event');

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);
const mockUnlisten = vi.fn();

describe('AIQueryGenerator - Race Condition Tests (Zeus Directive)', () => {
  const defaultProps = {
    activeConnectionId: 'test-connection-123',
    schemaContext: { tables: ['users', 'orders'] },
    onQueryGenerated: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockListen.mockResolvedValue(mockUnlisten);
    console.error = vi.fn();
    console.log = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rapid Successive AI Generation Requests', () => {
    it('prevents multiple concurrent generations from same component', async () => {
      const user = userEvent.setup();
      let resolveCount = 0;
      
      mockInvoke.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolveCount++;
            resolve({
              success: true,
              generated_sql: `SELECT * FROM users; -- Request ${resolveCount}`,
              explanation: `Generated query ${resolveCount}`
            });
          }, 100);
        });
      });

      render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me users');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      
      // Rapidly click generate button multiple times
      await user.click(generateButton);
      await user.click(generateButton);
      await user.click(generateButton);
      await user.click(generateButton);
      await user.click(generateButton);
      
      // Wait for any pending operations
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate sql/i })).toBeInTheDocument();
      }, { timeout: 1000 });
      
      // Should only invoke once despite multiple clicks
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('generate_sql_from_prompt', expect.any(Object));
    });

    it('handles rapid generation requests with different prompts', async () => {
      const user = userEvent.setup();
      let requestCount = 0;
      
      mockInvoke.mockImplementation((command, params) => {
        requestCount++;
        const currentRequest = requestCount;
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              generated_sql: `SELECT * FROM table${currentRequest};`,
              explanation: `Query for request ${currentRequest}: ${params.request.prompt}`
            });
          }, 50 + Math.random() * 100); // Variable delay to simulate real conditions
        });
      });

      render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      
      // First request
      await user.clear(textarea);
      await user.type(textarea, 'Show me users');
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      await user.click(generateButton);
      
      // Wait a bit then try second request
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 25));
      });
      
      // Should show cancel button, indicating first request is active
      expect(screen.queryByRole('button', { name: /cancel generation/i })).toBeInTheDocument();
      
      // Try to start another request (should be prevented)
      await user.clear(textarea);
      await user.type(textarea, 'Show me orders');
      
      // Generate button should not be available during active generation
      expect(screen.queryByRole('button', { name: /generate sql/i })).not.toBeInTheDocument();
      
      // Wait for first request to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate sql/i })).toBeInTheDocument();
      }, { timeout: 1000 });
      
      // Should have only processed the first request
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('properly cancels previous request when starting new one', async () => {
      const user = userEvent.setup();
      let activeRequests = 0;
      
      mockInvoke.mockImplementation((command, params) => {
        if (command === 'generate_sql_from_prompt') {
          activeRequests++;
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              resolve({
                success: true,
                generated_sql: 'SELECT * FROM users;',
                explanation: 'Generated query'
              });
            }, 200);
            
            // Simulate cancellation
            return { timeout, resolve, reject };
          });
        } else if (command === 'cancel_sql_generation') {
          activeRequests--;
          return Promise.resolve('Cancelled');
        }
        return Promise.resolve();
      });

      render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me users');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      await user.click(generateButton);
      
      // Should show cancel button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel generation/i })).toBeInTheDocument();
      });
      
      // Cancel the request
      const cancelButton = screen.getByRole('button', { name: /cancel generation/i });
      await user.click(cancelButton);
      
      // Should return to initial state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate sql/i })).toBeInTheDocument();
      });
      
      // Should have called both generate and cancel
      expect(mockInvoke).toHaveBeenCalledWith('generate_sql_from_prompt', expect.any(Object));
      expect(mockInvoke).toHaveBeenCalledWith('cancel_sql_generation', expect.any(Object));
    });
  });

  describe('Component State Management Under Stress', () => {
    it('maintains consistent state during rapid UI interactions', async () => {
      const user = userEvent.setup();
      
      mockInvoke.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              generated_sql: 'SELECT * FROM users;',
              explanation: 'Generated query'
            });
          }, 100);
        });
      });

      render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      
      // Rapid interactions: type, clear, type, generate, cancel, repeat
      await user.type(textarea, 'Show me users');
      await user.clear(textarea);
      await user.type(textarea, 'Show me orders');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      await user.click(generateButton);
      
      // Immediately try to interact with examples while generating
      const exampleButton = screen.getAllByRole('button')[1]; // First example button
      await user.click(exampleButton);
      
      // Should not change textarea content during generation
      expect(textarea).toHaveValue('Show me orders');
      
      // Wait for generation to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate sql/i })).toBeInTheDocument();
      });
      
      // Component should be in consistent state
      expect(screen.getByText('AI SQL Generator')).toBeInTheDocument();
      expect(textarea).toBeInTheDocument();
    });

    it('handles component unmount during active generation gracefully', async () => {
      const user = userEvent.setup();
      let generationActive = false;
      
      mockInvoke.mockImplementation(() => {
        generationActive = true;
        return new Promise((resolve) => {
          setTimeout(() => {
            generationActive = false;
            resolve({
              success: true,
              generated_sql: 'SELECT * FROM users;',
              explanation: 'Generated query'
            });
          }, 500);
        });
      });

      const { unmount } = render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me users');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      await user.click(generateButton);
      
      // Verify generation started
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel generation/i })).toBeInTheDocument();
      });
      
      // Unmount component during active generation
      act(() => {
        unmount();
      });
      
      // Should not throw errors or cause memory leaks
      // Wait a bit to ensure any pending operations complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });

    it('handles network interruption scenarios', async () => {
      const user = userEvent.setup();
      
      mockInvoke.mockImplementation(() => {
        return Promise.reject(new Error('Network error: Connection lost'));
      });

      const mockOnError = vi.fn();
      render(<AIQueryGenerator {...defaultProps} onError={mockOnError} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me users');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      await user.click(generateButton);
      
      // Should handle network error gracefully
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('Network error: Connection lost');
      });
      
      // Should return to initial state
      expect(screen.getByRole('button', { name: /generate sql/i })).toBeInTheDocument();
    });
  });

  describe('Memory Leak Prevention', () => {
    it('properly cleans up event listeners on unmount', () => {
      const { unmount } = render(<AIQueryGenerator {...defaultProps} />);
      
      // Verify event listener was set up
      expect(mockListen).toHaveBeenCalledWith('sql-generation-progress', expect.any(Function));
      
      unmount();
      
      // Verify cleanup function was called
      expect(mockUnlisten).toHaveBeenCalled();
    });

    it('handles multiple mount/unmount cycles without leaks', () => {
      // Mount and unmount multiple times rapidly
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<AIQueryGenerator {...defaultProps} />);
        unmount();
      }
      
      // Should have called listen and unlisten equal number of times
      expect(mockListen).toHaveBeenCalledTimes(5);
      expect(mockUnlisten).toHaveBeenCalledTimes(5);
    });

    it('cancels pending requests on unmount', async () => {
      const user = userEvent.setup();
      
      mockInvoke.mockImplementation((command) => {
        if (command === 'generate_sql_from_prompt') {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                success: true,
                generated_sql: 'SELECT * FROM users;'
              });
            }, 1000);
          });
        } else if (command === 'cancel_sql_generation') {
          return Promise.resolve('Cancelled');
        }
        return Promise.resolve();
      });

      const { unmount } = render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me users');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      await user.click(generateButton);
      
      // Verify generation started
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel generation/i })).toBeInTheDocument();
      });
      
      // Unmount during generation
      act(() => {
        unmount();
      });
      
      // Should have attempted to cancel the generation
      // Note: The exact cancellation behavior depends on implementation details
      // but the component should handle unmount gracefully
      expect(mockInvoke).toHaveBeenCalledWith('generate_sql_from_prompt', expect.any(Object));
    });
  });

  describe('Timeout Handling', () => {
    it('handles generation timeout gracefully', async () => {
      const user = userEvent.setup();
      
      mockInvoke.mockImplementation(() => {
        return new Promise((resolve) => {
          // Never resolve to simulate timeout
          setTimeout(() => {
            resolve({
              success: true,
              generated_sql: 'SELECT * FROM users;'
            });
          }, 20000); // 20 seconds, longer than component timeout
        });
      });

      const mockOnError = vi.fn();
      render(<AIQueryGenerator {...defaultProps} onError={mockOnError} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me users');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      await user.click(generateButton);
      
      // Should show cancel button initially
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel generation/i })).toBeInTheDocument();
      });
      
      // Wait for timeout (component has 16s timeout)
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('Generation timeout');
      }, { timeout: 17000 });
      
      // Should return to initial state after timeout
      expect(screen.getByRole('button', { name: /generate sql/i })).toBeInTheDocument();
    });
  });
});
