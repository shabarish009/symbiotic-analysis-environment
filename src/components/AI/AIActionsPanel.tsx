// AI Actions Panel - Story 3.6
// Unified component managing all three AI analysis actions with consistent state management

import React, { useCallback } from 'react';
import { useAIAnalysis } from './hooks/useAIAnalysis';
import './AIActionsPanel.css';

// Types for AI Analysis Results (simplified - main types now in hook)
interface AIAnalysisResult {
  analysis_id: string;
  task_type: 'Explain' | 'Optimize' | 'Validate';
  success: boolean;
  result?: any;
  confidence_score?: number;
  execution_time_ms?: number;
  error_message?: string;
}

// Component Props
interface AIActionsPanelProps {
  sqlContent: string;
  activeConnectionId?: string;
  schemaContext?: any;
  onAnalysisComplete?: (result: AIAnalysisResult) => void;
  onError?: (error: string) => void;
  className?: string;
}

const AIActionsPanel: React.FC<AIActionsPanelProps> = ({
  sqlContent,
  activeConnectionId,
  schemaContext,
  onAnalysisComplete,
  onError,
  className = ''
}) => {
  // Use the dedicated AI analysis hook (Zeus Directive proactive refactoring)
  const {
    activeTask,
    isProcessing,
    progress,
    canCancel,
    analysisId,
    executeAnalysis,
    cancelAnalysis,
    canPerformAnalysis
  } = useAIAnalysis({
    activeConnectionId,
    schemaContext,
    onAnalysisComplete,
    onError
  });

  // Generic analysis handler for all three task types
  const handleAnalysis = useCallback(async (taskType: 'Explain' | 'Optimize' | 'Validate') => {
    await executeAnalysis(taskType, sqlContent);
  }, [executeAnalysis, sqlContent]);

  // Individual action handlers
  const handleExplain = useCallback(() => handleAnalysis('Explain'), [handleAnalysis]);
  const handleOptimize = useCallback(() => handleAnalysis('Optimize'), [handleAnalysis]);
  const handleValidate = useCallback(() => handleAnalysis('Validate'), [handleAnalysis]);

  // Cancel analysis handler
  const handleCancel = useCallback(async () => {
    await cancelAnalysis();
  }, [cancelAnalysis]);

  // Check if actions can be performed
  const canPerformAction = canPerformAnalysis(sqlContent);

  return (
    <div className={`ai-actions-panel ${className}`}>
      <div className="ai-actions-header">
        <h3>AI Analysis Tools</h3>
        {isProcessing && (
          <div className="analysis-status">
            <span className="status-indicator processing"></span>
            <span className="status-text">
              {activeTask} in progress...
            </span>
          </div>
        )}
      </div>

      <div className="ai-actions-buttons">
        {!isProcessing ? (
          <>
            <button
              className="ai-action-button explain-button"
              onClick={handleExplain}
              disabled={!canPerformAction}
              title="Get a plain-English explanation of your SQL query"
              aria-label="Explain SQL Query"
            >
              <span className="button-icon">📖</span>
              <span className="button-text">Explain Query</span>
            </button>

            <button
              className="ai-action-button optimize-button"
              onClick={handleOptimize}
              disabled={!canPerformAction}
              title="Get performance optimization suggestions for your query"
              aria-label="Optimize SQL Query"
            >
              <span className="button-icon">⚡</span>
              <span className="button-text">Optimize Query</span>
            </button>

            <button
              className="ai-action-button validate-button"
              onClick={handleValidate}
              disabled={!canPerformAction}
              title="Check your query for errors and potential issues"
              aria-label="Validate SQL Query"
            >
              <span className="button-icon">✓</span>
              <span className="button-text">Check for Errors</span>
            </button>
          </>
        ) : (
          <button
            className="ai-action-button cancel-button"
            onClick={handleCancel}
            disabled={!canCancel}
            title="Cancel the current analysis"
            aria-label="Cancel Analysis"
          >
            <span className="button-icon">✕</span>
            <span className="button-text">Cancel {activeTask}</span>
          </button>
        )}
      </div>

      {progress && (
        <div className="analysis-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress.progress_percent || 0}%` }}
            ></div>
          </div>
          <div className="progress-details">
            <span className="progress-stage">{progress.stage}</span>
            <span className="progress-message">{progress.message}</span>
          </div>
        </div>
      )}

      {!activeConnectionId && (
        <div className="ai-actions-notice">
          <span className="notice-icon">ℹ️</span>
          <span className="notice-text">Connect to a database to enable AI analysis</span>
        </div>
      )}

      {!sqlContent.trim() && activeConnectionId && (
        <div className="ai-actions-notice">
          <span className="notice-icon">ℹ️</span>
          <span className="notice-text">Enter a SQL query to analyze</span>
        </div>
      )}
    </div>
  );
};

export default AIActionsPanel;
