import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SQLAnalystApp } from './SQLAnalystApp';

// Mock child components
jest.mock('../Shell/WindowFrame', () => ({
  WindowFrame: ({ children, title, onClose }: any) => (
    <div data-testid="window-frame">
      <div data-testid="window-title">{title}</div>
      <button onClick={onClose} data-testid="close-button">Close</button>
      {children}
    </div>
  ),
}));

jest.mock('../UI/Button', () => ({
  Button: ({ children, onClick, disabled, icon, variant }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      data-testid={`button-${variant || 'default'}`}
      data-icon={icon}
    >
      {children}
    </button>
  ),
}));

jest.mock('../SQLEditor', () => ({
  SQLEditor: ({ value, onChange, onExecute, dialect, connectionId }: any) => (
    <div data-testid="sql-editor">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid="sql-textarea"
        data-dialect={dialect}
        data-connection-id={connectionId}
      />
      <button onClick={() => onExecute(value)} data-testid="execute-button">
        Execute
      </button>
    </div>
  ),
}));

jest.mock('../Database', () => ({
  ConnectionManager: ({ onClose }: any) => (
    <div data-testid="connection-manager">
      <button onClick={onClose} data-testid="connection-manager-close">
        Close Connection Manager
      </button>
    </div>
  ),
}));

jest.mock('../Database/hooks/useConnectionManager', () => ({
  useConnectionManager: () => ({
    connections: [
      {
        id: 'test-connection-1',
        name: 'Test PostgreSQL',
        database_type: 'PostgreSQL',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
      },
      {
        id: 'test-connection-2',
        name: 'Test MySQL',
        database_type: 'MySQL',
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        username: 'testuser',
      },
    ],
    isLoading: false,
    error: null,
    loadConnections: jest.fn(),
  }),
}));

describe('SQLAnalystApp', () => {
  const defaultProps = {
    onClose: jest.fn(),
    isVisible: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('renders SQL Analyst application', () => {
      render(<SQLAnalystApp {...defaultProps} />);
      
      expect(screen.getByTestId('window-frame')).toBeInTheDocument();
      expect(screen.getByTestId('window-title')).toHaveTextContent('SQL Analyst');
    });

    it('shows connection information in toolbar', () => {
      render(<SQLAnalystApp {...defaultProps} />);
      
      expect(screen.getByText('Test PostgreSQL')).toBeInTheDocument();
      expect(screen.getByText('(PostgreSQL)')).toBeInTheDocument();
    });

    it('displays SQL editor with correct dialect', () => {
      render(<SQLAnalystApp {...defaultProps} />);
      
      const sqlEditor = screen.getByTestId('sql-editor');
      expect(sqlEditor).toBeInTheDocument();
      
      const textarea = screen.getByTestId('sql-textarea');
      expect(textarea).toHaveAttribute('data-dialect', 'postgresql');
      expect(textarea).toHaveAttribute('data-connection-id', 'test-connection-1');
    });

    it('shows results panel placeholder', () => {
      render(<SQLAnalystApp {...defaultProps} />);
      
      expect(screen.getByText('Query Results')).toBeInTheDocument();
      expect(screen.getByText('Execute a query to see results here.')).toBeInTheDocument();
      expect(screen.getByText(/Coming in Story 3.3/)).toBeInTheDocument();
    });
  });

  describe('Connection Management', () => {
    it('opens connection manager when manage connections button is clicked', async () => {
      render(<SQLAnalystApp {...defaultProps} />);
      
      const manageButton = screen.getByTestId('button-secondary');
      fireEvent.click(manageButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-manager')).toBeInTheDocument();
      });
    });

    it('closes connection manager when close button is clicked', async () => {
      render(<SQLAnalystApp {...defaultProps} />);
      
      // Open connection manager
      const manageButton = screen.getByTestId('button-secondary');
      fireEvent.click(manageButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-manager')).toBeInTheDocument();
      });
      
      // Close connection manager
      const closeButton = screen.getByTestId('connection-manager-close');
      fireEvent.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('connection-manager')).not.toBeInTheDocument();
      });
    });

    it('allows selecting different connections', async () => {
      render(<SQLAnalystApp {...defaultProps} />);
      
      // Open connection manager
      const manageButton = screen.getByTestId('button-secondary');
      fireEvent.click(manageButton);
      
      await waitFor(() => {
        const mysqlConnection = screen.getByText('Test MySQL');
        fireEvent.click(mysqlConnection);
      });
      
      // Check that dialect changed
      const textarea = screen.getByTestId('sql-textarea');
      expect(textarea).toHaveAttribute('data-dialect', 'mysql');
      expect(textarea).toHaveAttribute('data-connection-id', 'test-connection-2');
    });
  });

  describe('Query Execution', () => {
    it('executes query when execute button is clicked', async () => {
      // Mock window.alert to avoid actual alerts in tests
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      render(<SQLAnalystApp {...defaultProps} />);
      
      const executeButton = screen.getByTestId('button-primary');
      fireEvent.click(executeButton);
      
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('Query execution will be implemented in Story 3.3!')
      );
      
      alertSpy.mockRestore();
    });

    it('prevents execution when no connection is active', async () => {
      // Mock useConnectionManager to return no connections
      const mockUseConnectionManager = require('../Database/hooks/useConnectionManager').useConnectionManager;
      mockUseConnectionManager.mockReturnValue({
        connections: [],
        isLoading: false,
        error: null,
        loadConnections: jest.fn(),
      });
      
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      render(<SQLAnalystApp {...defaultProps} />);
      
      const executeButton = screen.getByTestId('button-primary');
      fireEvent.click(executeButton);
      
      expect(alertSpy).toHaveBeenCalledWith('Please connect to a database first');
      
      alertSpy.mockRestore();
    });

    it('executes query from SQL editor', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      render(<SQLAnalystApp {...defaultProps} />);
      
      const executeButton = screen.getByTestId('execute-button');
      fireEvent.click(executeButton);
      
      expect(alertSpy).toHaveBeenCalled();
      
      alertSpy.mockRestore();
    });
  });

  describe('Editor Content Management', () => {
    it('updates SQL content when editor changes', async () => {
      render(<SQLAnalystApp {...defaultProps} />);
      
      const textarea = screen.getByTestId('sql-textarea');
      
      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'SELECT * FROM users;');
      
      expect(textarea).toHaveValue('SELECT * FROM users;');
    });

    it('clears editor content when clear button is clicked', async () => {
      render(<SQLAnalystApp {...defaultProps} />);
      
      const textarea = screen.getByTestId('sql-textarea');
      const clearButton = screen.getByText('Clear');
      
      // Add some content first
      await userEvent.type(textarea, 'SELECT * FROM users;');
      expect(textarea).toHaveValue(expect.stringContaining('SELECT * FROM users;'));
      
      // Clear the content
      fireEvent.click(clearButton);
      
      expect(textarea).toHaveValue('');
    });
  });

  describe('Status Bar', () => {
    it('displays line and character count', () => {
      render(<SQLAnalystApp {...defaultProps} />);
      
      expect(screen.getByText(/Lines:/)).toBeInTheDocument();
      expect(screen.getByText(/Characters:/)).toBeInTheDocument();
    });

    it('shows connection status', () => {
      render(<SQLAnalystApp {...defaultProps} />);
      
      expect(screen.getByText('Connected to testdb')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays connection errors', () => {
      // Mock useConnectionManager to return an error
      const mockUseConnectionManager = require('../Database/hooks/useConnectionManager').useConnectionManager;
      mockUseConnectionManager.mockReturnValue({
        connections: [],
        isLoading: false,
        error: 'Failed to load connections',
        loadConnections: jest.fn(),
      });
      
      render(<SQLAnalystApp {...defaultProps} />);
      
      expect(screen.getByText('Failed to load connections')).toBeInTheDocument();
    });

    it('handles missing connections gracefully', () => {
      // Mock useConnectionManager to return no connections
      const mockUseConnectionManager = require('../Database/hooks/useConnectionManager').useConnectionManager;
      mockUseConnectionManager.mockReturnValue({
        connections: [],
        isLoading: false,
        error: null,
        loadConnections: jest.fn(),
      });
      
      render(<SQLAnalystApp {...defaultProps} />);
      
      expect(screen.getByText('No Connection')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('supports keyboard navigation', () => {
      render(<SQLAnalystApp {...defaultProps} />);
      
      const executeButton = screen.getByTestId('button-primary');
      const manageButton = screen.getByTestId('button-secondary');
      
      // Test that buttons can receive focus
      executeButton.focus();
      expect(document.activeElement).toBe(executeButton);
      
      manageButton.focus();
      expect(document.activeElement).toBe(manageButton);
    });

    it('provides proper ARIA labels and roles', () => {
      render(<SQLAnalystApp {...defaultProps} />);
      
      // Check for proper semantic structure
      expect(screen.getByRole('button', { name: /execute query/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /manage connections/i })).toBeInTheDocument();
    });
  });

  describe('Window Management', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = jest.fn();
      render(<SQLAnalystApp {...defaultProps} onClose={onClose} />);
      
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalled();
    });

    it('does not render when not visible', () => {
      render(<SQLAnalystApp {...defaultProps} isVisible={false} />);
      
      expect(screen.queryByTestId('window-frame')).not.toBeInTheDocument();
    });
  });
});
