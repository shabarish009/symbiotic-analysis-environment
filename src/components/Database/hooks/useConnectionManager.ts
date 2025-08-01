import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  DatabaseConnection,
  ConnectionFormData,
  ConnectionTestResult,
  ConnectionSummary,
  ConnectionManagerState,
} from '../types';

export function useConnectionManager() {
  const [state, setState] = useState<ConnectionManagerState>({
    connections: [],
    selectedConnection: null,
    isLoading: false,
    error: null,
    showForm: false,
    editingConnection: null,
  });

  // Initialize database manager
  const initializeManager = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      await invoke('init_database_manager');
      await loadConnections();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      }));
    }
  }, []);

  // Load all connections
  const loadConnections = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const connections = await invoke<DatabaseConnection[]>('list_database_connections');
      setState(prev => ({
        ...prev,
        connections,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      }));
    }
  }, []);

  // Add new connection with input validation
  const addConnection = useCallback(async (formData: ConnectionFormData): Promise<string> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Client-side input validation and sanitization
      const sanitizedFormData = sanitizeConnectionFormData(formData);
      validateConnectionFormData(sanitizedFormData);

      const connectionId = await invoke<string>('add_database_connection', {
        name: sanitizedFormData.name,
        databaseType: sanitizedFormData.database_type,
        host: sanitizedFormData.host,
        port: sanitizedFormData.port,
        database: sanitizedFormData.database,
        username: sanitizedFormData.username,
        password: sanitizedFormData.password,
        sslEnabled: sanitizedFormData.ssl_enabled,
      });

      await loadConnections();
      setState(prev => ({ ...prev, showForm: false, isLoading: false }));

      return connectionId;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      }));
      throw error;
    }
  }, [loadConnections]);

  // Remove connection
  const removeConnection = useCallback(async (connectionId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      await invoke('remove_database_connection', { connectionId });
      await loadConnections();
      
      // Clear selection if the removed connection was selected
      setState(prev => ({
        ...prev,
        selectedConnection: prev.selectedConnection === connectionId ? null : prev.selectedConnection,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      }));
    }
  }, [loadConnections]);

  // Test connection
  const testConnection = useCallback(async (connectionId: string): Promise<ConnectionTestResult> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const result = await invoke<ConnectionTestResult>('test_database_connection', { connectionId });
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  // Get connection summary
  const getConnectionSummary = useCallback(async (connectionId: string): Promise<ConnectionSummary> => {
    try {
      const summary = await invoke<ConnectionSummary>('get_database_connection_summary', { connectionId });
      return summary;
    } catch (error) {
      throw error;
    }
  }, []);

  // UI state management
  const showAddForm = useCallback(() => {
    setState(prev => ({
      ...prev,
      showForm: true,
      editingConnection: null,
    }));
  }, []);

  const showEditForm = useCallback((connection: DatabaseConnection) => {
    setState(prev => ({
      ...prev,
      showForm: true,
      editingConnection: connection,
    }));
  }, []);

  const hideForm = useCallback(() => {
    setState(prev => ({
      ...prev,
      showForm: false,
      editingConnection: null,
    }));
  }, []);

  const selectConnection = useCallback((connectionId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedConnection: connectionId,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeManager();
  }, [initializeManager]);

  return {
    // State
    connections: state.connections,
    selectedConnection: state.selectedConnection,
    isLoading: state.isLoading,
    error: state.error,
    showForm: state.showForm,
    editingConnection: state.editingConnection,

    // Actions
    loadConnections,
    addConnection,
    removeConnection,
    testConnection,
    getConnectionSummary,

    // UI Actions
    showAddForm,
    showEditForm,
    hideForm,
    selectConnection,
    clearError,
  };
}

// Security: Input sanitization and validation functions
function sanitizeConnectionFormData(formData: ConnectionFormData): ConnectionFormData {
  return {
    ...formData,
    name: formData.name.trim().slice(0, 255),
    host: formData.host.trim().slice(0, 255),
    database: formData.database.trim().slice(0, 255),
    username: formData.username.trim().slice(0, 255),
    password: formData.password.slice(0, 1024), // Don't trim passwords
  };
}

function validateConnectionFormData(formData: ConnectionFormData): void {
  // Validate required fields
  if (!formData.name) {
    throw new Error('Connection name is required');
  }

  if (!formData.password) {
    throw new Error('Password is required');
  }

  // Security: Check for dangerous characters
  const dangerousChars = /[<>'";&\x00-\x1f\x7f]/;

  if (dangerousChars.test(formData.name)) {
    throw new Error('Connection name contains invalid characters');
  }

  if (dangerousChars.test(formData.host)) {
    throw new Error('Host contains invalid characters');
  }

  if (dangerousChars.test(formData.database)) {
    throw new Error('Database name contains invalid characters');
  }

  if (dangerousChars.test(formData.username)) {
    throw new Error('Username contains invalid characters');
  }

  // Validate port range
  if (formData.port < 1 || formData.port > 65535) {
    throw new Error('Port must be between 1 and 65535');
  }

  // Validate password strength (minimum requirements)
  if (formData.password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  if (formData.password.length > 1024) {
    throw new Error('Password is too long');
  }

  // Check for null bytes in password
  if (formData.password.includes('\0')) {
    throw new Error('Password contains invalid characters');
  }
}
