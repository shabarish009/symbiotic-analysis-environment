// useAIGenerator Hook - Story 3.5 QA Refactoring
// Robust state management for AI SQL generation with race condition prevention

import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Types
interface SQLGenerationRequest {
  prompt: string;
  connection_id: string;
  schema_context?: any;
  generation_options?: SQLGenerationOptions;
}

interface SQLGenerationOptions {
  timeout_seconds?: number;
  include_explanation?: boolean;
  validate_syntax?: boolean;
  optimize_performance?: boolean;
  confidence_threshold?: number;
}

interface SQLGenerationResponse {
  success: boolean;
  generated_sql?: string;
  explanation?: string;
  confidence_level?: string;
  confidence_score?: number;
  warnings?: string[];
  clarifying_questions?: string[];
  error_message?: string;
  generation_time_ms?: number;
}

interface SQLGenerationProgress {
  stage: string;
  progress_percent?: number;
  message: string;
  timestamp: string;
}

interface UseAIGeneratorOptions {
  activeConnectionId?: string;
  schemaContext?: any;
  onQueryGenerated?: (sql: string, explanation?: string) => void;
  onError?: (error: string) => void;
}

interface UseAIGeneratorReturn {
  // State
  isGenerating: boolean;
  progress: SQLGenerationProgress | null;
  lastResponse: SQLGenerationResponse | null;
  generationId: string | null;
  
  // Actions
  generateSQL: (prompt: string) => Promise<void>;
  cancelGeneration: () => Promise<void>;
  
  // Utilities
  canGenerate: (prompt: string) => boolean;
  cleanup: () => void;
}

export function useAIGenerator(options: UseAIGeneratorOptions): UseAIGeneratorReturn {
  const { activeConnectionId, schemaContext, onQueryGenerated, onError } = options;
  
  // State management
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<SQLGenerationProgress | null>(null);
  const [lastResponse, setLastResponse] = useState<SQLGenerationResponse | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  
  // Refs for race condition prevention and cleanup
  const isGeneratingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressUnlistenRef = useRef<(() => void) | null>(null);
  const currentGenerationIdRef = useRef<string | null>(null);
  const lockRef = useRef(false); // Synchronous lock for race condition prevention
  
  // Cleanup function with comprehensive resource management
  const cleanup = useCallback(() => {
    // Cancel any active requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clean up event listeners
    if (progressUnlistenRef.current) {
      progressUnlistenRef.current();
      progressUnlistenRef.current = null;
    }

    // Reset all state and locks
    lockRef.current = false;
    isGeneratingRef.current = false;
    currentGenerationIdRef.current = null;
    setIsGenerating(false);
    setProgress(null);
    setGenerationId(null);
  }, []);
  
  // Component unmount cleanup
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  // Utility function to check if generation can proceed
  const canGenerate = useCallback((promptToCheck: string): boolean => {
    if (!promptToCheck.trim()) return false;
    if (!activeConnectionId) return false;
    if (lockRef.current || isGeneratingRef.current) return false;
    return true;
  }, [activeConnectionId]);
  
  // Main SQL generation function with robust race condition prevention
  const generateSQL = useCallback(async (promptToGenerate: string): Promise<void> => {
    // Pre-flight validation
    if (!promptToGenerate.trim()) {
      onError?.('Please enter a description of what data you want to find.');
      return;
    }

    if (!activeConnectionId) {
      onError?.('Please connect to a database first.');
      return;
    }

    // CRITICAL: Race condition prevention using synchronous lock
    if (lockRef.current || isGeneratingRef.current) {
      console.warn('Generation already in progress, ignoring duplicate request');
      return;
    }

    // Acquire synchronous lock IMMEDIATELY to prevent race conditions
    lockRef.current = true;

    // Set generating state and create generation ID
    isGeneratingRef.current = true;
    const newGenerationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    currentGenerationIdRef.current = newGenerationId;
    
    try {
      // Set UI state
      setIsGenerating(true);
      setProgress(null);
      setLastResponse(null);
      setGenerationId(newGenerationId);

      // Create new AbortController
      abortControllerRef.current = new AbortController();
      
      // Set up progress listener
      const unlisten = await listen<SQLGenerationProgress>('sql-generation-progress', (event) => {
        // Only process events for the current generation
        if (currentGenerationIdRef.current === newGenerationId) {
          setProgress(event.payload);
        }
      });
      progressUnlistenRef.current = unlisten;
      
      // Prepare generation request
      const request: SQLGenerationRequest = {
        prompt: promptToGenerate.trim(),
        connection_id: activeConnectionId,
        schema_context: schemaContext,
        generation_options: {
          timeout_seconds: 15,
          include_explanation: true,
          validate_syntax: true,
          optimize_performance: false,
          confidence_threshold: 0.7
        }
      };
      
      // Execute generation with timeout and cancellation support
      const response = await Promise.race([
        invoke<SQLGenerationResponse>('generate_sql_from_prompt', { request }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Generation timeout')), 16000);
        }),
        new Promise<never>((_, reject) => {
          abortControllerRef.current?.signal.addEventListener('abort', () => {
            reject(new Error('Generation cancelled'));
          });
        })
      ]);
      
      // Check if this generation is still current
      if (currentGenerationIdRef.current !== newGenerationId) {
        console.log('Generation result discarded - newer generation in progress');
        return;
      }
      
      // Process successful response
      setLastResponse(response);
      
      if (response.success && response.generated_sql) {
        onQueryGenerated?.(response.generated_sql, response.explanation);
      } else if (response.clarifying_questions && response.clarifying_questions.length > 0) {
        onError?.(`Please clarify: ${response.clarifying_questions.join(', ')}`);
      } else {
        onError?.(response.error_message || 'Failed to generate SQL query');
      }
      
    } catch (error) {
      // Check if generation was cancelled
      if (error instanceof Error && error.message === 'Generation cancelled') {
        console.log('Generation cancelled by user');
        return;
      }
      
      // Check if this is still the current generation
      if (currentGenerationIdRef.current !== newGenerationId) {
        return;
      }
      
      console.error('SQL generation error:', error);
      onError?.(error instanceof Error ? error.message : 'An unexpected error occurred');
      
    } finally {
      // Always clean up if this is still the current generation
      if (currentGenerationIdRef.current === newGenerationId) {
        cleanup();
      }
    }
  }, [activeConnectionId, schemaContext, onQueryGenerated, onError, cleanup]);
  
  // Cancel generation function
  const cancelGeneration = useCallback(async (): Promise<void> => {
    if (!isGeneratingRef.current || !currentGenerationIdRef.current) {
      return;
    }
    
    try {
      // Call backend cancellation
      await invoke('cancel_sql_generation', { 
        generationId: currentGenerationIdRef.current 
      });
    } catch (error) {
      console.error('Failed to cancel generation:', error);
    } finally {
      // Always cleanup regardless of backend response
      cleanup();
    }
  }, [cleanup]);
  
  return {
    // State
    isGenerating,
    progress,
    lastResponse,
    generationId,
    
    // Actions
    generateSQL,
    cancelGeneration,
    
    // Utilities
    canGenerate,
    cleanup
  };
}
