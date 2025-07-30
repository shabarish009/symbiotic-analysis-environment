/**
 * Memory System Hook
 * React hook for interacting with Project Cortex memory system
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  MemoryContext,
  MemoryStats,
  QueryHistoryEntry,
  SchemaSuggestion,
  SchemaInfo,
  MemoryHook,
  QueryHistoryFilters
} from '../types/memory';

export function useMemory(projectId: string): MemoryHook {
  const [context, setContext] = useState<MemoryContext | null>(null);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
  const [suggestions, setSuggestions] = useState<SchemaSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // RACE CONDITION FIX: Track active requests
  const activeRequests = useRef(new Set<string>());
  const abortControllers = useRef(new Map<string, AbortController>());

  const executeRequest = useCallback(async <T>(
    requestId: string,
    requestFn: () => Promise<T>
  ): Promise<T | null> => {
    // Cancel previous request of same type
    if (activeRequests.current.has(requestId)) {
      const controller = abortControllers.current.get(requestId);
      controller?.abort();
    }

    // Setup new request
    const controller = new AbortController();
    activeRequests.current.add(requestId);
    abortControllers.current.set(requestId, controller);

    try {
      const result = await requestFn();
      return result;
    } finally {
      activeRequests.current.delete(requestId);
      abortControllers.current.delete(requestId);
    }
  }, []);

  const handleError = useCallback((err: any, operation: string) => {
    const errorMessage = typeof err === 'string' ? err : err?.message || `Failed to ${operation}`;
    setError(errorMessage);
    console.error(`Memory operation failed (${operation}):`, err);
  }, []);

  const getContext = useCallback(async (query: string) => {
    if (!projectId || !query.trim()) return;

    setLoading(true);
    setError(null);

    const result = await executeRequest(`context-${projectId}`, async () => {
      const response = await invoke<any>('get_memory_context', {
        query: query.trim(),
        projectId
      });

      if (response.success && response.context) {
        return response.context;
      } else {
        throw new Error(response.error || 'Failed to get memory context');
      }
    });

    if (result) {
      setContext(result);
    }
    setLoading(false);
  }, [projectId, executeRequest]);

  const getStats = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await invoke<any>('get_memory_statistics', {
        projectId
      });

      if (response.success && response.statistics) {
        setStats(response.statistics);
      } else {
        throw new Error(response.error || 'Failed to get memory statistics');
      }
    } catch (err) {
      handleError(err, 'get statistics');
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  const getHistory = useCallback(async (limit: number = 50, filters?: QueryHistoryFilters) => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await invoke<any>('get_query_history', {
        projectId,
        limit
      });

      if (response.success && response.history) {
        setHistory(response.history);
      } else {
        throw new Error(response.error || 'Failed to get query history');
      }
    } catch (err) {
      handleError(err, 'get history');
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  const getSuggestions = useCallback(async (partialQuery: string) => {
    if (!projectId || !partialQuery.trim()) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await invoke<any>('get_schema_suggestions', {
        projectId,
        partialQuery: partialQuery.trim()
      });

      if (response.success && response.suggestions) {
        setSuggestions(response.suggestions);
      } else {
        throw new Error(response.error || 'Failed to get schema suggestions');
      }
    } catch (err) {
      handleError(err, 'get suggestions');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError]);

  const createProject = useCallback(async (name: string, metadata?: Record<string, any>) => {
    if (!projectId || !name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await invoke<any>('create_memory_project', {
        projectId,
        name: name.trim(),
        metadata: metadata || {}
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to create project');
      }

      // Refresh stats after creating project
      await getStats();
    } catch (err) {
      handleError(err, 'create project');
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError, getStats]);

  const storeSchema = useCallback(async (schemaInfo: SchemaInfo) => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await invoke<any>('store_schema_info', {
        projectId,
        schemaInfo
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to store schema info');
      }

      // Refresh stats after storing schema
      await getStats();
    } catch (err) {
      handleError(err, 'store schema');
    } finally {
      setLoading(false);
    }
  }, [projectId, handleError, getStats]);

  // Auto-load stats when projectId changes
  useEffect(() => {
    if (projectId) {
      getStats();
    }
  }, [projectId, getStats]);

  return {
    context,
    stats,
    history,
    suggestions,
    loading,
    error,
    getContext,
    getStats,
    getHistory,
    getSuggestions,
    createProject,
    storeSchema
  };
}

// Specialized hooks for specific use cases
export function useMemoryContext(projectId: string, query: string) {
  const [context, setContext] = useState<MemoryContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !query.trim()) {
      setContext(null);
      return;
    }

    const fetchContext = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await invoke<any>('get_memory_context', {
          query: query.trim(),
          projectId
        });

        if (response.success && response.context) {
          setContext(response.context);
        } else {
          throw new Error(response.error || 'Failed to get memory context');
        }
      } catch (err) {
        const errorMessage = typeof err === 'string' ? err : err?.message || 'Failed to get context';
        setError(errorMessage);
        console.error('Memory context fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the request
    const timeoutId = setTimeout(fetchContext, 300);
    return () => clearTimeout(timeoutId);
  }, [projectId, query]);

  return { context, loading, error };
}

export function useMemoryStats(projectId?: string) {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await invoke<any>('get_memory_statistics', {
        projectId
      });

      if (response.success && response.statistics) {
        setStats(response.statistics);
      } else {
        throw new Error(response.error || 'Failed to get memory statistics');
      }
    } catch (err) {
      const errorMessage = typeof err === 'string' ? err : err?.message || 'Failed to get statistics';
      setError(errorMessage);
      console.error('Memory stats fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}

export function useSchemaSuggestions(projectId: string, partialQuery: string, debounceMs: number = 300) {
  const [suggestions, setSuggestions] = useState<SchemaSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !partialQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await invoke<any>('get_schema_suggestions', {
          projectId,
          partialQuery: partialQuery.trim()
        });

        if (response.success && response.suggestions) {
          setSuggestions(response.suggestions);
        } else {
          throw new Error(response.error || 'Failed to get schema suggestions');
        }
      } catch (err) {
        const errorMessage = typeof err === 'string' ? err : err?.message || 'Failed to get suggestions';
        setError(errorMessage);
        setSuggestions([]);
        console.error('Schema suggestions fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the request
    const timeoutId = setTimeout(fetchSuggestions, debounceMs);
    return () => clearTimeout(timeoutId);
  }, [projectId, partialQuery, debounceMs]);

  return { suggestions, loading, error };
}
