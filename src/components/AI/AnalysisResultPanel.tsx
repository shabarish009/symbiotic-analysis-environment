// Analysis Result Panel - Story 3.6
// Component for displaying AI analysis results with proper formatting

import React, { useState, useCallback } from 'react';
import './AnalysisResultPanel.css';

// Types for analysis results
interface ExplanationResult {
  type: 'Explanation';
  summary: string;
  detailed_steps: ExplanationStep[];
  data_sources: string[];
  operations: string[];
  expected_result_description: string;
}

interface OptimizationResult {
  type: 'Optimization';
  original_query: string;
  optimized_query?: string;
  optimizations: OptimizationSuggestion[];
  performance_impact?: PerformanceEstimate;
}

interface ValidationResult {
  type: 'Validation';
  is_valid: boolean;
  issues: ValidationIssue[];
  quick_fixes: QuickFix[];
  overall_score?: number;
}

interface ExplanationStep {
  step_number: number;
  operation: string;
  description: string;
  tables_involved: string[];
  columns_involved: string[];
}

interface OptimizationSuggestion {
  suggestion_id: string;
  category: string;
  description: string;
  impact_level: string;
  before_snippet?: string;
  after_snippet?: string;
  reasoning: string;
}

interface PerformanceEstimate {
  estimated_improvement_percent?: number;
  execution_time_before?: string;
  execution_time_after?: string;
  resource_usage_impact?: string;
}

interface ValidationIssue {
  issue_id: string;
  severity: string;
  category: string;
  message: string;
  line_number?: number;
  column_number?: number;
  suggestion?: string;
}

interface QuickFix {
  fix_id: string;
  description: string;
  original_text: string;
  replacement_text: string;
  confidence: number;
}

interface AIAnalysisResult {
  analysis_id: string;
  task_type: 'Explain' | 'Optimize' | 'Validate';
  success: boolean;
  result?: ExplanationResult | OptimizationResult | ValidationResult;
  confidence_score?: number;
  execution_time_ms?: number;
  error_message?: string;
}

interface AnalysisResultPanelProps {
  result: AIAnalysisResult;
  onQueryReplace?: (newQuery: string) => void;
  onApplyFix?: (fix: QuickFix) => void;
  onClose?: () => void;
  className?: string;
}

const AnalysisResultPanel: React.FC<AnalysisResultPanelProps> = ({
  result,
  onQueryReplace,
  onApplyFix,
  onClose,
  className = ''
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
      console.log('Copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  }, []);

  const renderExplanationResult = (explanation: ExplanationResult) => (
    <div className="explanation-result">
      <div className="result-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('summary')}
          role="button"
          tabIndex={0}
          aria-expanded={expandedSections.has('summary')}
        >
          <span className="section-icon">{expandedSections.has('summary') ? '▼' : '▶'}</span>
          <h4>Query Summary</h4>
        </div>
        {expandedSections.has('summary') && (
          <div className="section-content">
            <p className="summary-text">{explanation.summary}</p>
            <div className="metadata">
              <div className="metadata-item">
                <strong>Data Sources:</strong> {explanation.data_sources.join(', ')}
              </div>
              <div className="metadata-item">
                <strong>Operations:</strong> {explanation.operations.join(', ')}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="result-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('steps')}
          role="button"
          tabIndex={0}
          aria-expanded={expandedSections.has('steps')}
        >
          <span className="section-icon">{expandedSections.has('steps') ? '▼' : '▶'}</span>
          <h4>Step-by-Step Breakdown</h4>
        </div>
        {expandedSections.has('steps') && (
          <div className="section-content">
            <div className="steps-list">
              {explanation.detailed_steps.map((step) => (
                <div key={step.step_number} className="explanation-step">
                  <div className="step-header">
                    <span className="step-number">{step.step_number}</span>
                    <span className="step-operation">{step.operation}</span>
                  </div>
                  <p className="step-description">{step.description}</p>
                  {(step.tables_involved.length > 0 || step.columns_involved.length > 0) && (
                    <div className="step-details">
                      {step.tables_involved.length > 0 && (
                        <span className="detail-item">
                          <strong>Tables:</strong> {step.tables_involved.join(', ')}
                        </span>
                      )}
                      {step.columns_involved.length > 0 && (
                        <span className="detail-item">
                          <strong>Columns:</strong> {step.columns_involved.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="result-section">
        <div className="section-content">
          <div className="expected-result">
            <h5>Expected Result:</h5>
            <p>{explanation.expected_result_description}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOptimizationResult = (optimization: OptimizationResult) => (
    <div className="optimization-result">
      {optimization.performance_impact && (
        <div className="result-section">
          <div className="section-content">
            <div className="performance-summary">
              <h4>Performance Impact</h4>
              {optimization.performance_impact.estimated_improvement_percent && (
                <div className="improvement-stat">
                  <span className="stat-value">
                    {optimization.performance_impact.estimated_improvement_percent}%
                  </span>
                  <span className="stat-label">Estimated Improvement</span>
                </div>
              )}
              {optimization.performance_impact.execution_time_before && (
                <div className="timing-comparison">
                  <div className="timing-item">
                    <strong>Before:</strong> {optimization.performance_impact.execution_time_before}
                  </div>
                  <div className="timing-item">
                    <strong>After:</strong> {optimization.performance_impact.execution_time_after}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="result-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('optimizations')}
          role="button"
          tabIndex={0}
          aria-expanded={expandedSections.has('optimizations')}
        >
          <span className="section-icon">{expandedSections.has('optimizations') ? '▼' : '▶'}</span>
          <h4>Optimization Suggestions</h4>
        </div>
        {expandedSections.has('optimizations') && (
          <div className="section-content">
            <div className="optimizations-list">
              {optimization.optimizations.map((suggestion) => (
                <div key={suggestion.suggestion_id} className="optimization-suggestion">
                  <div className="suggestion-header">
                    <span className={`impact-badge ${suggestion.impact_level.toLowerCase()}`}>
                      {suggestion.impact_level} Impact
                    </span>
                    <span className="suggestion-category">{suggestion.category}</span>
                  </div>
                  <p className="suggestion-description">{suggestion.description}</p>
                  <p className="suggestion-reasoning">{suggestion.reasoning}</p>
                  {suggestion.before_snippet && suggestion.after_snippet && (
                    <div className="code-comparison">
                      <div className="code-before">
                        <h6>Before:</h6>
                        <code>{suggestion.before_snippet}</code>
                      </div>
                      <div className="code-after">
                        <h6>After:</h6>
                        <code>{suggestion.after_snippet}</code>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {optimization.optimized_query && (
        <div className="result-section">
          <div className="section-content">
            <div className="optimized-query">
              <h4>Optimized Query</h4>
              <div className="query-container">
                <pre className="query-code">{optimization.optimized_query}</pre>
                <div className="query-actions">
                  <button 
                    className="action-button copy-button"
                    onClick={() => copyToClipboard(optimization.optimized_query!)}
                    title="Copy optimized query to clipboard"
                  >
                    Copy
                  </button>
                  <button 
                    className="action-button replace-button"
                    onClick={() => onQueryReplace?.(optimization.optimized_query!)}
                    title="Replace current query with optimized version"
                  >
                    Replace Query
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderValidationResult = (validation: ValidationResult) => (
    <div className="validation-result">
      <div className="result-section">
        <div className="section-content">
          <div className="validation-summary">
            <div className={`validation-status ${validation.is_valid ? 'valid' : 'invalid'}`}>
              <span className="status-icon">{validation.is_valid ? '✓' : '⚠'}</span>
              <span className="status-text">
                {validation.is_valid ? 'Query is valid' : 'Issues found in query'}
              </span>
              {validation.overall_score && (
                <span className="overall-score">
                  Score: {Math.round(validation.overall_score * 100)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {validation.issues.length > 0 && (
        <div className="result-section">
          <div 
            className="section-header"
            onClick={() => toggleSection('issues')}
            role="button"
            tabIndex={0}
            aria-expanded={expandedSections.has('issues')}
          >
            <span className="section-icon">{expandedSections.has('issues') ? '▼' : '▶'}</span>
            <h4>Issues Found ({validation.issues.length})</h4>
          </div>
          {expandedSections.has('issues') && (
            <div className="section-content">
              <div className="issues-list">
                {validation.issues.map((issue) => (
                  <div key={issue.issue_id} className={`validation-issue ${issue.severity}`}>
                    <div className="issue-header">
                      <span className={`severity-badge ${issue.severity}`}>
                        {issue.severity.toUpperCase()}
                      </span>
                      <span className="issue-category">{issue.category}</span>
                      {issue.line_number && (
                        <span className="issue-location">
                          Line {issue.line_number}
                          {issue.column_number && `:${issue.column_number}`}
                        </span>
                      )}
                    </div>
                    <p className="issue-message">{issue.message}</p>
                    {issue.suggestion && (
                      <p className="issue-suggestion">
                        <strong>Suggestion:</strong> {issue.suggestion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {validation.quick_fixes.length > 0 && (
        <div className="result-section">
          <div 
            className="section-header"
            onClick={() => toggleSection('fixes')}
            role="button"
            tabIndex={0}
            aria-expanded={expandedSections.has('fixes')}
          >
            <span className="section-icon">{expandedSections.has('fixes') ? '▼' : '▶'}</span>
            <h4>Quick Fixes ({validation.quick_fixes.length})</h4>
          </div>
          {expandedSections.has('fixes') && (
            <div className="section-content">
              <div className="fixes-list">
                {validation.quick_fixes.map((fix) => (
                  <div key={fix.fix_id} className="quick-fix">
                    <div className="fix-header">
                      <span className="fix-description">{fix.description}</span>
                      <span className="fix-confidence">
                        {Math.round(fix.confidence * 100)}% confidence
                      </span>
                    </div>
                    <div className="fix-preview">
                      <div className="fix-before">
                        <strong>Replace:</strong> <code>{fix.original_text}</code>
                      </div>
                      <div className="fix-after">
                        <strong>With:</strong> <code>{fix.replacement_text}</code>
                      </div>
                    </div>
                    <button 
                      className="action-button apply-fix-button"
                      onClick={() => onApplyFix?.(fix)}
                      title="Apply this fix to your query"
                    >
                      Apply Fix
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (!result.success) {
    return (
      <div className={`analysis-result-panel error ${className}`}>
        <div className="result-header">
          <h3>{result.task_type} Analysis Failed</h3>
          {onClose && (
            <button className="close-button" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>
        <div className="error-content">
          <p className="error-message">{result.error_message || 'Analysis failed'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`analysis-result-panel ${result.task_type.toLowerCase()} ${className}`}>
      <div className="result-header">
        <h3>{result.task_type} Analysis Results</h3>
        <div className="result-metadata">
          {result.confidence_score && (
            <span className="confidence-score">
              Confidence: {Math.round(result.confidence_score * 100)}%
            </span>
          )}
          {result.execution_time_ms && (
            <span className="execution-time">
              {result.execution_time_ms}ms
            </span>
          )}
        </div>
        {onClose && (
          <button className="close-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}
      </div>

      <div className="result-content">
        {result.result?.type === 'Explanation' && renderExplanationResult(result.result as ExplanationResult)}
        {result.result?.type === 'Optimization' && renderOptimizationResult(result.result as OptimizationResult)}
        {result.result?.type === 'Validation' && renderValidationResult(result.result as ValidationResult)}
      </div>
    </div>
  );
};

export default AnalysisResultPanel;
