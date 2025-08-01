import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { 
  AutoCompletionItem, 
  SQLDialect, 
  DatabaseSchema, 
  TableInfo, 
  ColumnInfo 
} from '../types';

interface UseAutoCompletionProps {
  dialect: SQLDialect;
  connectionId?: string;
  enabled: boolean;
}

interface CompletionCache {
  [connectionId: string]: {
    schema: DatabaseSchema;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
  };
}

export function useAutoCompletion({ dialect, connectionId, enabled }: UseAutoCompletionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  
  // Cache for database schemas to avoid repeated API calls
  const cacheRef = useRef<CompletionCache>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  // SQL keywords by dialect
  const getDialectKeywords = useCallback((dialect: SQLDialect): string[] => {
    const commonKeywords = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER',
      'ON', 'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
      'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE',
      'ALTER', 'DROP', 'INDEX', 'VIEW', 'TRIGGER', 'PROCEDURE', 'FUNCTION',
      'IF', 'EXISTS', 'NOT', 'NULL', 'DEFAULT', 'PRIMARY', 'KEY', 'FOREIGN',
      'REFERENCES', 'UNIQUE', 'CHECK', 'CONSTRAINT', 'AUTO_INCREMENT',
      'AND', 'OR', 'IN', 'BETWEEN', 'LIKE', 'IS', 'AS', 'CASE', 'WHEN', 'THEN',
      'ELSE', 'END', 'UNION', 'ALL', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'
    ];

    const dialectSpecific = {
      postgresql: [
        'SERIAL', 'BIGSERIAL', 'UUID', 'JSONB', 'ARRAY', 'UNNEST', 'GENERATE_SERIES',
        'STRING_AGG', 'ARRAY_AGG', 'COALESCE', 'NULLIF', 'GREATEST', 'LEAST',
        'EXTRACT', 'DATE_TRUNC', 'NOW', 'CURRENT_TIMESTAMP', 'INTERVAL',
        'WITH', 'RECURSIVE', 'WINDOW', 'OVER', 'PARTITION', 'ROW_NUMBER', 'RANK',
        'DENSE_RANK', 'LEAD', 'LAG', 'FIRST_VALUE', 'LAST_VALUE'
      ],
      mysql: [
        'AUTO_INCREMENT', 'TINYINT', 'MEDIUMINT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE',
        'CHAR', 'VARCHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'BINARY', 'VARBINARY',
        'BLOB', 'MEDIUMBLOB', 'LONGBLOB', 'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'YEAR',
        'ENUM', 'SET', 'JSON', 'GEOMETRY', 'POINT', 'LINESTRING', 'POLYGON',
        'GROUP_CONCAT', 'FIND_IN_SET', 'INET_ATON', 'INET_NTOA', 'MD5', 'SHA1', 'SHA2'
      ],
      sqlite: [
        'INTEGER', 'REAL', 'TEXT', 'BLOB', 'NUMERIC', 'BOOLEAN',
        'AUTOINCREMENT', 'WITHOUT', 'ROWID', 'STRICT',
        'SQLITE_VERSION', 'RANDOM', 'ABS', 'ROUND', 'LENGTH', 'SUBSTR',
        'REPLACE', 'TRIM', 'UPPER', 'LOWER', 'DATETIME', 'DATE', 'TIME',
        'STRFTIME', 'JULIANDAY', 'UNIXEPOCH'
      ],
      mssql: [
        'NVARCHAR', 'NCHAR', 'NTEXT', 'UNIQUEIDENTIFIER', 'DATETIME2', 'DATETIMEOFFSET',
        'TIME', 'DATE', 'SMALLDATETIME', 'MONEY', 'SMALLMONEY', 'REAL', 'FLOAT',
        'TINYINT', 'SMALLINT', 'BIGINT', 'BIT', 'VARBINARY', 'IMAGE',
        'NEWID', 'GETDATE', 'GETUTCDATE', 'DATEDIFF', 'DATEADD', 'DATENAME', 'DATEPART',
        'CHARINDEX', 'PATINDEX', 'LEN', 'STUFF', 'REPLICATE', 'REVERSE'
      ],
      oracle: [
        'VARCHAR2', 'NVARCHAR2', 'CHAR', 'NCHAR', 'NUMBER', 'BINARY_FLOAT', 'BINARY_DOUBLE',
        'DATE', 'TIMESTAMP', 'INTERVAL', 'RAW', 'LONG', 'CLOB', 'NCLOB', 'BLOB', 'BFILE',
        'ROWID', 'UROWID', 'XMLTYPE', 'SDO_GEOMETRY',
        'SYSDATE', 'SYSTIMESTAMP', 'NVL', 'NVL2', 'DECODE', 'CASE', 'ROWNUM',
        'TO_CHAR', 'TO_NUMBER', 'TO_DATE', 'SUBSTR', 'INSTR', 'LENGTH', 'TRIM'
      ],
      generic: []
    };

    return [...commonKeywords, ...(dialectSpecific[dialect] || [])];
  }, []);

  // SQL functions by dialect
  const getDialectFunctions = useCallback((dialect: SQLDialect): AutoCompletionItem[] => {
    const functions = {
      postgresql: [
        { name: 'ARRAY_AGG', description: 'Aggregate values into an array' },
        { name: 'STRING_AGG', description: 'Concatenate values with separator' },
        { name: 'GENERATE_SERIES', description: 'Generate a series of values' },
        { name: 'UNNEST', description: 'Expand an array to a set of rows' },
        { name: 'COALESCE', description: 'Return first non-null value' },
        { name: 'NULLIF', description: 'Return null if values are equal' },
        { name: 'EXTRACT', description: 'Extract field from date/time' },
        { name: 'DATE_TRUNC', description: 'Truncate date to specified precision' },
      ],
      mysql: [
        { name: 'GROUP_CONCAT', description: 'Concatenate group values' },
        { name: 'FIND_IN_SET', description: 'Find string in comma-separated list' },
        { name: 'INET_ATON', description: 'Convert IP address to number' },
        { name: 'INET_NTOA', description: 'Convert number to IP address' },
        { name: 'MD5', description: 'Calculate MD5 hash' },
        { name: 'SHA1', description: 'Calculate SHA1 hash' },
        { name: 'CONCAT', description: 'Concatenate strings' },
        { name: 'SUBSTRING', description: 'Extract substring' },
      ],
      sqlite: [
        { name: 'SQLITE_VERSION', description: 'Get SQLite version' },
        { name: 'RANDOM', description: 'Generate random number' },
        { name: 'ABS', description: 'Absolute value' },
        { name: 'ROUND', description: 'Round number' },
        { name: 'LENGTH', description: 'String length' },
        { name: 'SUBSTR', description: 'Extract substring' },
        { name: 'REPLACE', description: 'Replace substring' },
        { name: 'TRIM', description: 'Remove whitespace' },
      ],
      mssql: [
        { name: 'NEWID', description: 'Generate new GUID' },
        { name: 'GETDATE', description: 'Get current date/time' },
        { name: 'DATEDIFF', description: 'Calculate date difference' },
        { name: 'DATEADD', description: 'Add interval to date' },
        { name: 'CHARINDEX', description: 'Find substring position' },
        { name: 'LEN', description: 'String length' },
        { name: 'STUFF', description: 'Replace substring' },
        { name: 'REPLICATE', description: 'Repeat string' },
      ],
      oracle: [
        { name: 'SYSDATE', description: 'Current date and time' },
        { name: 'NVL', description: 'Replace null with value' },
        { name: 'DECODE', description: 'Conditional expression' },
        { name: 'TO_CHAR', description: 'Convert to string' },
        { name: 'TO_NUMBER', description: 'Convert to number' },
        { name: 'TO_DATE', description: 'Convert to date' },
        { name: 'SUBSTR', description: 'Extract substring' },
        { name: 'INSTR', description: 'Find substring position' },
      ],
      generic: [
        { name: 'COUNT', description: 'Count rows' },
        { name: 'SUM', description: 'Sum values' },
        { name: 'AVG', description: 'Average values' },
        { name: 'MIN', description: 'Minimum value' },
        { name: 'MAX', description: 'Maximum value' },
        { name: 'UPPER', description: 'Convert to uppercase' },
        { name: 'LOWER', description: 'Convert to lowercase' },
        { name: 'TRIM', description: 'Remove whitespace' },
      ]
    };

    return (functions[dialect] || functions.generic).map(func => ({
      label: func.name,
      type: 'function' as const,
      detail: 'function',
      info: func.description,
      boost: 80,
    }));
  }, []);

  // Load database schema from backend
  const loadSchema = useCallback(async (connectionId: string): Promise<DatabaseSchema> => {
    // Check cache first
    const cached = cacheRef.current[connectionId];
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < cached.ttl) {
      return cached.schema;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    
    try {
      setIsLoading(true);
      setError(null);

      // Asynchronous call to backend to get database schema
      const schemaData = await invoke<{
        tables: any[];
        views: any[];
        functions: any[];
      }>('get_database_schema', { 
        connectionId,
        signal: abortControllerRef.current.signal 
      });

      const schema: DatabaseSchema = {
        tables: schemaData.tables.map((table: any) => ({
          name: table.name,
          schema: table.schema,
          columns: table.columns.map((col: any) => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable,
            defaultValue: col.default_value,
            comment: col.comment,
          })),
          primaryKeys: table.primary_keys || [],
          foreignKeys: table.foreign_keys || [],
        })),
        views: schemaData.views.map((view: any) => ({
          name: view.name,
          schema: view.schema,
          columns: view.columns.map((col: any) => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable,
            comment: col.comment,
          })),
        })),
        functions: schemaData.functions.map((func: any) => ({
          name: func.name,
          schema: func.schema,
          returnType: func.return_type,
          parameters: func.parameters || [],
          description: func.description,
        })),
        keywords: getDialectKeywords(dialect),
      };

      // Cache the schema
      cacheRef.current[connectionId] = {
        schema,
        timestamp: now,
        ttl: 5 * 60 * 1000, // 5 minutes
      };

      return schema;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        const errorMessage = error.message || 'Failed to load database schema';

        // Enhanced error handling with retry logic
        const retryCount = (error as any).retryCount || 0;
        if (retryCount < 2 && !error.message.includes('timeout')) {
          // Retry with exponential backoff for transient errors
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          setTimeout(() => {
            const retryError = new Error(errorMessage);
            (retryError as any).retryCount = retryCount + 1;
            loadSchema(connectionId).catch(() => {
              // Final retry failed, set error state
              setError(`${errorMessage} (after ${retryCount + 1} retries)`);
            });
          }, delay);
          return { tables: [], views: [], functions: [], keywords: getDialectKeywords(dialect) };
        }

        // Enhanced error categorization
        let userFriendlyMessage = errorMessage;
        if (error.message.includes('timeout')) {
          userFriendlyMessage = 'Database connection timeout. Please check your connection and try again.';
        } else if (error.message.includes('permission')) {
          userFriendlyMessage = 'Permission denied. Please check your database credentials.';
        } else if (error.message.includes('network')) {
          userFriendlyMessage = 'Network error. Please check your internet connection.';
        }

        setError(userFriendlyMessage);

        // Return fallback schema with keywords only
        return { tables: [], views: [], functions: [], keywords: getDialectKeywords(dialect) };
      }
      throw error;
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [dialect, getDialectKeywords]);

  // Generate completion items
  const generateCompletions = useCallback(async (
    context: string,
    position: number
  ): Promise<AutoCompletionItem[]> => {
    if (!enabled) return [];

    const completions: AutoCompletionItem[] = [];
    const startTime = performance.now();

    try {
      // Add SQL keywords
      const keywords = getDialectKeywords(dialect);
      keywords.forEach(keyword => {
        completions.push({
          label: keyword,
          type: 'keyword',
          detail: 'keyword',
          boost: 90,
        });
      });

      // Add SQL functions
      const functions = getDialectFunctions(dialect);
      completions.push(...functions);

      // Add database schema items if connected
      if (connectionId && schema) {
        // Add tables
        schema.tables.forEach(table => {
          completions.push({
            label: table.name,
            type: 'table',
            detail: 'table',
            info: `Table with ${table.columns.length} columns`,
            boost: 85,
            section: 'Tables',
          });

          // Add columns for this table
          table.columns.forEach(column => {
            completions.push({
              label: `${table.name}.${column.name}`,
              type: 'column',
              detail: column.type,
              info: column.comment || `Column of type ${column.type}`,
              boost: 75,
              section: 'Columns',
            });
          });
        });

        // Add views
        schema.views.forEach(view => {
          completions.push({
            label: view.name,
            type: 'table',
            detail: 'view',
            info: `View with ${view.columns.length} columns`,
            boost: 80,
            section: 'Views',
          });
        });

        // Add database functions
        schema.functions.forEach(func => {
          completions.push({
            label: func.name,
            type: 'function',
            detail: func.returnType,
            info: func.description || `Returns ${func.returnType}`,
            boost: 70,
            section: 'Database Functions',
          });
        });
      }

      // Performance tracking
      const completionTime = performance.now() - startTime;
      console.debug(`Auto-completion generated in ${completionTime.toFixed(2)}ms`);

      return completions;
    } catch (error) {
      console.error('Error generating completions:', error);
      return completions; // Return what we have so far
    }
  }, [enabled, dialect, connectionId, schema, getDialectKeywords, getDialectFunctions]);

  // Load schema when connection changes
  useEffect(() => {
    if (enabled && connectionId) {
      loadSchema(connectionId)
        .then(setSchema)
        .catch(error => {
          console.error('Failed to load schema:', error);
          setSchema(null);
        });
    } else {
      setSchema(null);
    }
  }, [enabled, connectionId, loadSchema]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    isLoading,
    error,
    schema,
    generateCompletions,
    clearCache: () => {
      cacheRef.current = {};
    },
  };
}
