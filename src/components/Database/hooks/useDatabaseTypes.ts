import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { DatabaseType, DatabaseTypeInfo } from '../types';

// Static database type information
const DATABASE_TYPE_INFO: Record<DatabaseType, DatabaseTypeInfo> = {
  PostgreSQL: {
    type: 'PostgreSQL',
    displayName: 'PostgreSQL',
    defaultPort: 5432,
    description: 'Advanced open-source relational database',
    features: ['ACID Transactions', 'JSON Support', 'Full-text Search', 'Extensions'],
    icon: '🐘',
  },
  MySQL: {
    type: 'MySQL',
    displayName: 'MySQL',
    defaultPort: 3306,
    description: 'Popular open-source relational database',
    features: ['High Performance', 'Replication', 'Partitioning', 'Full-text Search'],
    icon: '🐬',
  },
  SQLite: {
    type: 'SQLite',
    displayName: 'SQLite',
    defaultPort: 0,
    description: 'Lightweight file-based database',
    features: ['Zero Configuration', 'Serverless', 'Cross-platform', 'ACID Transactions'],
    icon: '📁',
  },
  SqlServer: {
    type: 'SqlServer',
    displayName: 'SQL Server',
    defaultPort: 1433,
    description: 'Microsoft SQL Server database',
    features: ['Enterprise Features', 'Windows Authentication', 'T-SQL', 'Integration Services'],
    icon: '🏢',
  },
  Oracle: {
    type: 'Oracle',
    displayName: 'Oracle Database',
    defaultPort: 1521,
    description: 'Enterprise-grade relational database',
    features: ['Advanced Security', 'Partitioning', 'RAC', 'Advanced Analytics'],
    icon: '🏛️',
  },
};

export function useDatabaseTypes() {
  const [supportedTypes, setSupportedTypes] = useState<DatabaseType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load supported database types from backend
  const loadSupportedTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const types = await invoke<string[]>('get_supported_database_types');
      setSupportedTypes(types as DatabaseType[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get information for a specific database type
  const getTypeInfo = useCallback((type: DatabaseType): DatabaseTypeInfo => {
    return DATABASE_TYPE_INFO[type];
  }, []);

  // Get information for all supported types
  const getSupportedTypeInfo = useCallback((): DatabaseTypeInfo[] => {
    return supportedTypes.map(type => DATABASE_TYPE_INFO[type]);
  }, [supportedTypes]);

  // Get default port for a database type
  const getDefaultPort = useCallback((type: DatabaseType): number => {
    return DATABASE_TYPE_INFO[type].defaultPort;
  }, []);

  // Check if a database type is supported
  const isTypeSupported = useCallback((type: DatabaseType): boolean => {
    return supportedTypes.includes(type);
  }, [supportedTypes]);

  // Get connection string template for a database type
  const getConnectionTemplate = useCallback((type: DatabaseType) => {
    switch (type) {
      case 'PostgreSQL':
        return {
          host: 'localhost',
          port: 5432,
          database: 'postgres',
          username: 'postgres',
          ssl_enabled: true,
        };
      case 'MySQL':
        return {
          host: 'localhost',
          port: 3306,
          database: 'mysql',
          username: 'root',
          ssl_enabled: true,
        };
      case 'SQLite':
        return {
          host: '',
          port: 0,
          database: './database.db',
          username: '',
          ssl_enabled: false,
        };
      case 'SqlServer':
        return {
          host: 'localhost',
          port: 1433,
          database: 'master',
          username: 'sa',
          ssl_enabled: true,
        };
      case 'Oracle':
        return {
          host: 'localhost',
          port: 1521,
          database: 'XE',
          username: 'system',
          ssl_enabled: true,
        };
      default:
        return {
          host: 'localhost',
          port: 5432,
          database: '',
          username: '',
          ssl_enabled: true,
        };
    }
  }, []);

  // Validate connection parameters for a database type
  const validateConnectionParams = useCallback((type: DatabaseType, params: any) => {
    const errors: Record<string, string> = {};

    switch (type) {
      case 'SQLite':
        if (!params.database || params.database.trim() === '') {
          errors.database = 'Database file path is required';
        }
        break;
      
      case 'PostgreSQL':
      case 'MySQL':
      case 'SqlServer':
      case 'Oracle':
        if (!params.host || params.host.trim() === '') {
          errors.host = 'Host is required';
        }
        if (!params.database || params.database.trim() === '') {
          errors.database = 'Database name is required';
        }
        if (!params.username || params.username.trim() === '') {
          errors.username = 'Username is required';
        }
        if (params.port <= 0 || params.port > 65535) {
          errors.port = 'Port must be between 1 and 65535';
        }
        break;
    }

    return errors;
  }, []);

  // Initialize on mount
  useEffect(() => {
    loadSupportedTypes();
  }, [loadSupportedTypes]);

  return {
    // State
    supportedTypes,
    isLoading,
    error,

    // Data
    allTypeInfo: DATABASE_TYPE_INFO,
    supportedTypeInfo: getSupportedTypeInfo(),

    // Actions
    loadSupportedTypes,
    getTypeInfo,
    getSupportedTypeInfo,
    getDefaultPort,
    isTypeSupported,
    getConnectionTemplate,
    validateConnectionParams,
  };
}
