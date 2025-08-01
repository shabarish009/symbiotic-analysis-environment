// AI Query Generator Component - Story 3.5
// Generates SQL from natural language prompts with non-blocking architecture

import React, { useState, useCallback, useRef } from 'react';
import { useAIGenerator } from './hooks/useAIGenerator';
import './AIQueryGenerator.css';

// Component Props Interface

interface AIQueryGeneratorProps {
  activeConnectionId?: string;
  schemaContext?: any;
  onQueryGenerated: (sql: string, explanation?: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

const AIQueryGenerator: React.FC<AIQueryGeneratorProps> = ({
  activeConnectionId,
  schemaContext,
  onQueryGenerated,
  onError,
  className = ''
}) => {
  // Local state for prompt input
  const [prompt, setPrompt] = useState('');

  // Component-level lock for race condition prevention
  const componentLockRef = useRef(false);

  // Use the robust AI generation hook
  const {
    isGenerating,
    progress,
    lastResponse,
    generationId,
    generateSQL,
    cancelGeneration,
    canGenerate
  } = useAIGenerator({
    activeConnectionId,
    schemaContext,
    onQueryGenerated,
    onError
  });

  // Example prompts for user guidance
  const examplePrompts = [
    "Show me all customers who placed orders in the last 30 days and spent more than $500",
    "Find users who registered in the last 30 days and have made at least 3 purchases",
    "Get the top 10 products by sales revenue this month",
    "List all employees hired in 2024 with their department and salary information"
  ];

  // Handle SQL generation with aggressive race condition prevention
  const handleGenerateSQL = useCallback(async () => {
    // CRITICAL: Synchronous lock check at component level
    if (componentLockRef.current) {
      console.warn('Component-level lock active, ignoring click');
      return;
    }

    // Immediate validation
    if (isGenerating || !canGenerate(prompt)) {
      return;
    }

    // Acquire component-level lock immediately
    componentLockRef.current = true;

    try {
      await generateSQL(prompt);
    } finally {
      // Always release lock
      componentLockRef.current = false;
    }
  }, [generateSQL, prompt, isGenerating, canGenerate]);

  // Handle cancellation using the robust hook
  const handleCancelGeneration = useCallback(async () => {
    await cancelGeneration();
  }, [cancelGeneration]);

  // Handle example prompt selection
  const handleExampleClick = useCallback((example: string) => {
    if (!isGenerating) {
      setPrompt(example);
    }
  }, [isGenerating]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter' && canGenerate(prompt)) {
      e.preventDefault();
      handleGenerateSQL();
    }
  }, [handleGenerateSQL, canGenerate, prompt]);

  return (
    <div className={`ai-query-generator ${className}`}>
      <div className="ai-query-generator__header">
        <h3>AI SQL Generator</h3>
        {activeConnectionId && (
          <span className="connection-indicator">
            Connected: {activeConnectionId}
          </span>
        )}
      </div>

      <div className="ai-query-generator__input-section">
        <label htmlFor="sql-prompt" className="ai-query-generator__label">
          Describe what data you want to find:
        </label>
        <textarea
          id="sql-prompt"
          className="ai-query-generator__textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what data you want to find..."
          rows={4}
          maxLength={500}
          disabled={isGenerating}
          aria-describedby="prompt-help"
        />
        <div id="prompt-help" className="ai-query-generator__help">
          Press Ctrl+Enter to generate SQL • {prompt.length}/500 characters
        </div>
      </div>

      <div className="ai-query-generator__examples">
        <h4>Example prompts:</h4>
        <div className="example-prompts">
          {examplePrompts.map((example, index) => (
            <button
              key={index}
              className="example-prompt"
              onClick={() => handleExampleClick(example)}
              disabled={isGenerating}
              type="button"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="ai-query-generator__actions">
        {!isGenerating ? (
          <button
            className="generate-button primary"
            onClick={handleGenerateSQL}
            disabled={!canGenerate(prompt)}
            type="button"
          >
            Generate SQL
          </button>
        ) : (
          <button
            className="cancel-button secondary"
            onClick={handleCancelGeneration}
            type="button"
          >
            Cancel Generation
          </button>
        )}
      </div>

      {/* Progress indicator (Zeus Directive requirement) */}
      {progress && (
        <div className="ai-query-generator__progress">
          <div className="progress-header">
            <span className="progress-stage">{progress.stage}</span>
            {progress.progress_percent && (
              <span className="progress-percent">{progress.progress_percent}%</span>
            )}
          </div>
          <div className="progress-message">{progress.message}</div>
          {progress.progress_percent && (
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress.progress_percent}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Response information */}
      {lastResponse && !isGenerating && (
        <div className="ai-query-generator__response">
          {lastResponse.confidence_level && (
            <div className={`confidence-indicator ${lastResponse.confidence_level.toLowerCase()}`}>
              Confidence: {lastResponse.confidence_level}
              {lastResponse.confidence_score && (
                <span className="confidence-score">
                  ({Math.round(lastResponse.confidence_score * 100)}%)
                </span>
              )}
            </div>
          )}
          
          {lastResponse.warnings && lastResponse.warnings.length > 0 && (
            <div className="warnings">
              <h5>Warnings:</h5>
              <ul>
                {lastResponse.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          
          {lastResponse.generation_time_ms && (
            <div className="generation-time">
              Generated in {lastResponse.generation_time_ms}ms
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIQueryGenerator;
