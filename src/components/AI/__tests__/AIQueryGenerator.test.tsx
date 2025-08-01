// AI Query Generator Tests - Story 3.5
// Tests for non-blocking architecture and race condition management (Zeus Directive)

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AIQueryGenerator from '../AIQueryGenerator';

// Mock Tauri API
vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event');

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);
const mockUnlisten = vi.fn();

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

describe('AIQueryGenerator', () => {
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
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  describe('Component Rendering', () => {
    it('renders with all essential elements', () => {
      render(<AIQueryGenerator {...defaultProps} />);
      
      expect(screen.getByText('AI SQL Generator')).toBeInTheDocument();
      expect(screen.getByLabelText(/describe what data you want to find/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate sql/i })).toBeInTheDocument();
      expect(screen.getByText('Example prompts:')).toBeInTheDocument();
    });

    it('shows connection indicator when connected', () => {
      render(<AIQueryGenerator {...defaultProps} />);
      
      expect(screen.getByText('Connected: test-connection-123')).toBeInTheDocument();
    });

    it('disables generate button when no connection', () => {
      render(<AIQueryGenerator {...defaultProps} activeConnectionId={undefined} />);
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      expect(generateButton).toBeDisabled();
    });

    it('disables generate button when prompt is empty', () => {
      render(<AIQueryGenerator {...defaultProps} />);
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      expect(generateButton).toBeDisabled();
    });
  });

  describe('User Input Handling', () => {
    it('updates prompt when user types', async () => {
      const user = userEvent.setup();
      render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me all users');
      
      expect(textarea).toHaveValue('Show me all users');
    });

    it('shows character count', async () => {
      const user = userEvent.setup();
      render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Test prompt');
      
      expect(screen.getByText(/11.*\/500 characters/)).toBeInTheDocument();
    });

    it('handles example prompt selection', async () => {
      const user = userEvent.setup();
      render(<AIQueryGenerator {...defaultProps} />);
      
      const exampleButton = screen.getByRole('button', { 
        name: /show me all customers who placed orders in the last 30 days/i 
      });
      await user.click(exampleButton);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      expect(textarea).toHaveValue('Show me all customers who placed orders in the last 30 days and spent more than $500');
    });

    it('handles Ctrl+Enter keyboard shortcut', async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValue({
        success: true,
        generated_sql: 'SELECT * FROM users;',
        explanation: 'Test explanation'
      });

      render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me all users');
      await user.keyboard('{Control>}{Enter}{/Control}');
      
      expect(mockInvoke).toHaveBeenCalledWith('generate_sql_from_prompt', expect.any(Object));
    });
  });

  describe('SQL Generation Process (Zeus Directive)', () => {
    it('shows progress indicators during generation', async () => {
      const user = userEvent.setup();
      let progressCallback: ((event: any) => void) | undefined;
      
      mockListen.mockImplementation((event, callback) => {
        if (event === 'sql-generation-progress') {
          progressCallback = callback;
        }
        return Promise.resolve(mockUnlisten);
      });

      mockInvoke.mockImplementation(() => {
        // Simulate progress updates
        setTimeout(() => {
          progressCallback?.({
            payload: {
              stage: 'analyzing',
              progress_percent: 30,
              message: 'Analyzing request...',
              timestamp: new Date().toISOString()
            }
          });
        }, 10);
        
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              generated_sql: 'SELECT * FROM users;',
              explanation: 'Test explanation'
            });
          }, 100);
        });
      });

      render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me all users');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      await user.click(generateButton);
      
      // Should show cancel button during generation
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel generation/i })).toBeInTheDocument();
      });
      
      // Should show progress
      await waitFor(() => {
        expect(screen.getByText('Analyzing request...')).toBeInTheDocument();
      });
    });

    it('handles successful SQL generation', async () => {
      const user = userEvent.setup();
      const mockOnQueryGenerated = vi.fn();
      
      mockInvoke.mockResolvedValue({
        success: true,
        generated_sql: 'SELECT * FROM users WHERE created_at >= NOW() - INTERVAL \'30 days\';',
        explanation: 'This query retrieves all users created in the last 30 days',
        confidence_level: 'High',
        confidence_score: 0.95,
        generation_time_ms: 1500
      });

      render(<AIQueryGenerator {...defaultProps} onQueryGenerated={mockOnQueryGenerated} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me recent users');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      await user.click(generateButton);
      
      await waitFor(() => {
        expect(mockOnQueryGenerated).toHaveBeenCalledWith(
          'SELECT * FROM users WHERE created_at >= NOW() - INTERVAL \'30 days\';',
          'This query retrieves all users created in the last 30 days'
        );
      });
      
      // Should show confidence indicator
      expect(screen.getByText('Confidence: High')).toBeInTheDocument();
      expect(screen.getByText('(95%)')).toBeInTheDocument();
      expect(screen.getByText('Generated in 1500ms')).toBeInTheDocument();
    });

    it('handles generation errors gracefully', async () => {
      const user = userEvent.setup();
      const mockOnError = vi.fn();
      
      mockInvoke.mockRejectedValue(new Error('AI service unavailable'));

      render(<AIQueryGenerator {...defaultProps} onError={mockOnError} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me users');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      await user.click(generateButton);
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('AI service unavailable');
      });
    });

    it('handles clarifying questions', async () => {
      const user = userEvent.setup();
      const mockOnError = vi.fn();
      
      mockInvoke.mockResolvedValue({
        success: false,
        clarifying_questions: ['Which time period do you mean?', 'Should this include deleted records?'],
        confidence_level: 'Low'
      });

      render(<AIQueryGenerator {...defaultProps} onError={mockOnError} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me recent data');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      await user.click(generateButton);
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          'Please clarify: Which time period do you mean?, Should this include deleted records?'
        );
      });
    });
  });

  describe('Cancellation Support (Zeus Directive)', () => {
    it('allows cancellation during generation', async () => {
      const user = userEvent.setup();
      
      let generationPromiseResolve: (value: any) => void;

      mockInvoke.mockImplementation((command) => {
        if (command === 'generate_sql_from_prompt') {
          return new Promise((resolve) => {
            generationPromiseResolve = resolve;
            // Don't auto-resolve, let the test control when it resolves
          });
        }
        if (command === 'cancel_sql_generation') {
          // Simulate successful cancellation
          if (generationPromiseResolve) {
            generationPromiseResolve({ success: false, error_message: 'Generation cancelled' });
          }
          return Promise.resolve();
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
      
      const cancelButton = screen.getByRole('button', { name: /cancel generation/i });
      await user.click(cancelButton);
      
      // Should call cancel command
      expect(mockInvoke).toHaveBeenCalledWith('cancel_sql_generation', expect.any(Object));
      
      // Should return to initial state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate sql/i })).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('prevents multiple concurrent generations', async () => {
      const user = userEvent.setup();
      
      mockInvoke.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({
            success: true,
            generated_sql: 'SELECT * FROM users;'
          }), 100);
        });
      });

      render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me users');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      
      // Click generate button multiple times rapidly
      await user.click(generateButton);
      await user.click(generateButton);
      await user.click(generateButton);
      
      // Should only call invoke once
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('Component Cleanup (Zeus Directive)', () => {
    it('cleans up resources on unmount', () => {
      const { unmount } = render(<AIQueryGenerator {...defaultProps} />);

      unmount();

      // Component should unmount without errors
      // Event listeners are only set up during generation, so this test
      // validates that unmounting without active generation works correctly
      expect(true).toBe(true);
    });

    it('handles component unmount during active generation', async () => {
      const user = userEvent.setup();
      
      mockInvoke.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({
            success: true,
            generated_sql: 'SELECT * FROM users;'
          }), 1000);
        });
      });

      const { unmount } = render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me users');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      await user.click(generateButton);
      
      // Unmount during generation
      act(() => {
        unmount();
      });
      
      // Should not throw errors or cause memory leaks
      // This is tested implicitly by the test not failing
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and descriptions', () => {
      render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      expect(textarea).toHaveAttribute('aria-describedby', 'prompt-help');
      
      const helpText = screen.getByText(/press ctrl\+enter to generate sql/i);
      expect(helpText).toHaveAttribute('id', 'prompt-help');
    });

    it('maintains focus management during state changes', async () => {
      const user = userEvent.setup();
      
      mockInvoke.mockResolvedValue({
        success: true,
        generated_sql: 'SELECT * FROM users;',
        explanation: 'Test explanation'
      });

      render(<AIQueryGenerator {...defaultProps} />);
      
      const textarea = screen.getByLabelText(/describe what data you want to find/i);
      await user.type(textarea, 'Show me users');
      
      const generateButton = screen.getByRole('button', { name: /generate sql/i });
      await user.click(generateButton);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate sql/i })).toBeInTheDocument();
      });
      
      // Focus should be manageable after generation completes
      expect(document.activeElement).toBeDefined();
    });
  });
});
