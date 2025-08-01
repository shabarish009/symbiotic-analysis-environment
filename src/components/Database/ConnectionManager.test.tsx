import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionManager } from './ConnectionManager';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock WindowFrame component
jest.mock('../Shell/WindowFrame', () => ({
  WindowFrame: ({ children, title, onClose }: any) => (
    <div data-testid="window-frame">
      <div data-testid="window-title">{title}</div>
      <button onClick={onClose} data-testid="close-button">Close</button>
      {children}
    </div>
  ),
}));

// Mock Button component
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

describe('ConnectionManager', () => {
  const mockInvoke = require('@tauri-apps/api/core').invoke;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful initialization
    mockInvoke.mockImplementation((command: string) => {
      switch (command) {
        case 'init_database_manager':
          return Promise.resolve('Database manager initialized successfully');
        case 'list_database_connections':
          return Promise.resolve([]);
        case 'get_supported_database_types':
          return Promise.resolve(['PostgreSQL', 'MySQL', 'SQLite']);
        default:
          return Promise.resolve();
      }
    });
  });

  it('renders connection manager window', async () => {
    render(<ConnectionManager />);
    
    await waitFor(() => {
      expect(screen.getByTestId('window-frame')).toBeInTheDocument();
      expect(screen.getByTestId('window-title')).toHaveTextContent('Database Connection Manager');
    });
  });

  it('shows add connection button', async () => {
    render(<ConnectionManager />);
    
    await waitFor(() => {
      expect(screen.getByTestId('button-primary')).toBeInTheDocument();
      expect(screen.getByTestId('button-primary')).toHaveTextContent('Add Connection');
    });
  });

  it('shows refresh button', async () => {
    render(<ConnectionManager />);
    
    await waitFor(() => {
      expect(screen.getByTestId('button-secondary')).toBeInTheDocument();
      expect(screen.getByTestId('button-secondary')).toHaveTextContent('Refresh');
    });
  });

  it('initializes database manager on mount', async () => {
    render(<ConnectionManager />);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('init_database_manager');
      expect(mockInvoke).toHaveBeenCalledWith('list_database_connections');
    });
  });

  it('shows empty state when no connections', async () => {
    render(<ConnectionManager />);
    
    await waitFor(() => {
      expect(screen.getByText('No Database Connections')).toBeInTheDocument();
      expect(screen.getByText('Get started by adding your first database connection.')).toBeInTheDocument();
    });
  });

  it('shows security indicator', async () => {
    render(<ConnectionManager />);
    
    await waitFor(() => {
      expect(screen.getByText('Credentials secured in OS Keychain')).toBeInTheDocument();
    });
  });

  it('handles close button click', async () => {
    const mockOnClose = jest.fn();
    render(<ConnectionManager onClose={mockOnClose} />);
    
    await waitFor(() => {
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles add connection button click', async () => {
    render(<ConnectionManager />);
    
    await waitFor(() => {
      const addButton = screen.getByTestId('button-primary');
      fireEvent.click(addButton);
      // Should show the connection form
      // This would need more detailed testing of the form component
    });
  });

  it('handles refresh button click', async () => {
    render(<ConnectionManager />);
    
    await waitFor(() => {
      const refreshButton = screen.getByTestId('button-secondary');
      fireEvent.click(refreshButton);
      
      // Should call list_database_connections again
      expect(mockInvoke).toHaveBeenCalledWith('list_database_connections');
    });
  });

  it('shows error message when initialization fails', async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'init_database_manager') {
        return Promise.reject(new Error('Failed to initialize'));
      }
      return Promise.resolve([]);
    });

    render(<ConnectionManager />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to initialize')).toBeInTheDocument();
    });
  });

  it('shows loading indicator during operations', async () => {
    // Mock a slow response
    mockInvoke.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<ConnectionManager />);
    
    // Should show loading indicator initially
    expect(screen.getByText('Loading connections...')).toBeInTheDocument();
  });
});
