// useAIAnalysis Hook - Story 3.6 QA Refactoring
// Dedicated state management hook for AI analysis operations
// Zeus Directive: Proactive refactoring for improved reliability, performance, and testability

import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Types for AI Analysis
interface AIAnalysisRequest {
  sql: string;
  task_type: 'Explain' | 'Optimize' | 'Validate';
  connection_id: string;
  schema_context?: any;
  analysis_options?: AIAnalysisOptions;
}

interface AIAnalysisOptions {
  timeout_seconds?: number;
  include_confidence?: boolean;
  detailed_explanation?: boolean;
  performance_estimates?: boolean;
  severity_filtering?: string[];
}

interface AIAnalysisResult {
  analysis_id: string;
  task_type: 'Explain' | 'Optimize' | 'Validate';
  success: boolean;
  result?: AnalysisResultData;
  confidence_score?: number;
  execution_time_ms?: number;
  error_message?: string;
}

interface AnalysisResultData {
  type: 'Explanation' | 'Optimization' | 'Validation';
  [key: string]: any;
}

interface AIAnalysisProgress {
  analysis_id: string;
  task_type: 'Explain' | 'Optimize' | 'Validate';
  stage: string;
  progress_percent?: number;
  message: string;
  timestamp: string;
}

interface UseAIAnalysisOptions {
  activeConnectionId?: string;
  schemaContext?: any;
  onAnalysisComplete?: (result: AIAnalysisResult) => void;
  onError?: (error: string) => void;
}

interface UseAIAnalysisReturn {
  // State
  activeTask: 'Explain' | 'Optimize' | 'Validate' | null;
  isProcessing: boolean;
  progress: AIAnalysisProgress | null;
  canCancel: boolean;
  analysisId: string | null;
  
  // Actions
  executeAnalysis: (taskType: 'Explain' | 'Optimize' | 'Validate', sqlContent: string) => Promise<void>;
  cancelAnalysis: () => Promise<void>;
  
  // Utilities
  canPerformAnalysis: (sqlContent: string) => boolean;
  cleanup: () => void;
}

export function useAIAnalysis(options: UseAIAnalysisOptions): UseAIAnalysisReturn {
  const { activeConnectionId, schemaContext, onAnalysisComplete, onError } = options;
  
  // State management
  const [activeTask, setActiveTask] = useState<'Explain' | 'Optimize' | 'Validate' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<AIAnalysisProgress | null>(null);
  const [canCancel, setCanCancel] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  
  // Refs for race condition prevention and cleanup
  const componentLockRef = useRef(false);
  const progressUnlistenRef = useRef<(() => void) | null>(null);
  const currentAnalysisIdRef = useRef<string | null>(null);
  const lastExecutionTimeRef = useRef<number>(0);
  
  // Comprehensive cleanup function
  const cleanup = useCallback(() => {
    // Clean up event listeners
    if (progressUnlistenRef.current) {
      progressUnlistenRef.current();
      progressUnlistenRef.current = null;
    }
    
    // Reset all state and locks
    componentLockRef.current = false;
    currentAnalysisIdRef.current = null;
    setActiveTask(null);
    setIsProcessing(false);
    setProgress(null);
    setCanCancel(false);
    setAnalysisId(null);
  }, []);
  
  // Component unmount cleanup
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  // Utility function to check if analysis can be performed
  const canPerformAnalysis = useCallback((sqlContent: string): boolean => {
    if (!sqlContent.trim()) return false;
    if (!activeConnectionId) return false;
    if (componentLockRef.current) return false; // Use only ref-based check for immediate response
    return true;
  }, [activeConnectionId]);
  
  // Main analysis execution function with robust race condition prevention
  const executeAnalysis = useCallback(async (
    taskType: 'Explain' | 'Optimize' | 'Validate',
    sqlContent: string
  ): Promise<void> => {
    // Pre-flight validation
    if (!sqlContent.trim()) {
      onError?.('Please enter a SQL query to analyze.');
      return;
    }

    if (!activeConnectionId) {
      onError?.('Please connect to a database first.');
      return;
    }

    // CRITICAL: Race condition prevention using synchronous lock + debounce
    const now = Date.now();
    if (componentLockRef.current || (now - lastExecutionTimeRef.current < 500)) {
      console.warn(`${taskType} analysis already in progress or too soon, ignoring request`);
      return;
    }

    // Acquire synchronous lock IMMEDIATELY to prevent race conditions
    componentLockRef.current = true;
    lastExecutionTimeRef.current = now;

    // Create new analysis ID at the top level for proper scope
    const newAnalysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    currentAnalysisIdRef.current = newAnalysisId;

    try {
      // Set processing state
      setActiveTask(taskType);
      setIsProcessing(true);
      setProgress(null);
      setCanCancel(true);
      setAnalysisId(newAnalysisId);
      
      // Set up progress listener
      const unlisten = await listen<AIAnalysisProgress>('ai-analysis-progress', (event) => {
        // Only process events for the current analysis
        if (currentAnalysisIdRef.current === newAnalysisId) {
          setProgress(event.payload);
        }
      });
      progressUnlistenRef.current = unlisten;
      
      // Prepare analysis request
      const request: AIAnalysisRequest = {
        sql: sqlContent.trim(),
        task_type: taskType,
        connection_id: activeConnectionId,
        schema_context: schemaContext,
        analysis_options: {
          timeout_seconds: 30,
          include_confidence: true,
          detailed_explanation: true,
          performance_estimates: taskType === 'Optimize',
          severity_filtering: taskType === 'Validate' ? ['error', 'warning', 'info'] : undefined,
        },
      };
      
      // Execute analysis with timeout and cancellation support
      const result = await Promise.race([
        invoke<AIAnalysisResult>('analyze_sql_query', { request }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Analysis timeout')), 35000);
        })
      ]);
      
      // Check if this analysis is still current
      if (currentAnalysisIdRef.current !== newAnalysisId) {
        console.log('Analysis result discarded - newer analysis in progress');
        return;
      }
      
      // Process successful response
      if (result.success) {
        onAnalysisComplete?.(result);
      } else {
        onError?.(result.error_message || `${taskType} analysis failed`);
      }
      
    } catch (error) {
      // Check if analysis was cancelled
      if (error instanceof Error && error.message === 'Analysis cancelled') {
        console.log('Analysis cancelled by user');
        return;
      }
      
      // Check if this is still the current analysis
      if (currentAnalysisIdRef.current !== newAnalysisId) {
        return;
      }
      
      console.error(`${taskType} analysis error:`, error);
      onError?.(error instanceof Error ? error.message : `${taskType} analysis failed`);
      
    } finally {
      // Always clean up if this is still the current analysis
      if (currentAnalysisIdRef.current === newAnalysisId) {
        cleanup();
      }
    }
  }, [activeConnectionId, schemaContext, onAnalysisComplete, onError, isProcessing, cleanup]);
  
  // Cancel analysis function
  const cancelAnalysis = useCallback(async (): Promise<void> => {
    if (!currentAnalysisIdRef.current || !canCancel) {
      return;
    }
    
    try {
      // Call backend cancellation
      await invoke('cancel_sql_analysis', { 
        analysisId: currentAnalysisIdRef.current 
      });
    } catch (error) {
      console.error('Failed to cancel analysis:', error);
    } finally {
      // Always cleanup regardless of backend response
      cleanup();
    }
  }, [canCancel, cleanup]);
  
  return {
    // State
    activeTask,
    isProcessing,
    progress,
    canCancel,
    analysisId,
    
    // Actions
    executeAnalysis,
    cancelAnalysis,
    
    // Utilities
    canPerformAnalysis,
    cleanup
  };
}
