/**
 * Thought Process Panel Component
 * Main container for displaying AI thought process information
 */

import React, { useState, useEffect, ErrorBoundary } from 'react';
import { ThoughtProcessDisplayProps, QueryData, ThoughtProcess } from '../../../types/thoughtProcess';
import { ProgressIndicator } from './ProgressIndicator';
import { ModelParticipationView } from './ModelParticipationView';
import { ConsensusVisualization } from './ConsensusVisualization';
import { ConfidenceScoreDisplay } from './ConfidenceScoreDisplay';
import { ResolutionMethodIndicator } from './ResolutionMethodIndicator';
import { ExecutionMetricsDisplay } from './ExecutionMetricsDisplay';
import './ThoughtProcessPanel.css';

// IMPROVEMENT: Error Boundary Component for robust error handling
class ThoughtProcessErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ThoughtProcess Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="thought-process-error">
          <div className="error-icon">⚠️</div>
          <h4>Thought Process Unavailable</h4>
          <p>Unable to display AI reasoning information.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const ThoughtProcessPanelCore: React.FC<ThoughtProcessDisplayProps> = ({
  isVisible,
  onToggleVisibility,
  currentQuery,
  thoughtProcess
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const isExpanded = (section: string) => expandedSections.has(section);

  // IMPROVEMENT: Enhanced data validation with fallbacks
  const confidence = thoughtProcess?.consensus_thought?.consensus_score ?? 0;
  const agreementLevel = thoughtProcess?.consensus_thought?.agreement_level ?? 'weak';

  // IMPROVEMENT: Validate data integrity
  useEffect(() => {
    if (thoughtProcess && !thoughtProcess.consensus_thought && !currentQuery) {
      console.warn('ThoughtProcess data may be incomplete:', thoughtProcess);
    }
  }, [thoughtProcess, currentQuery]);

  return (
    <div className="thought-process-panel">
      <div className="thought-process-header">
        <div className="header-content">
          <div className="header-icon">🧠</div>
          <h3>AI Thought Process</h3>
          <div className="header-controls">
            <button 
              className="toggle-button"
              onClick={onToggleVisibility}
              title={isVisible ? 'Hide thought process' : 'Show thought process'}
            >
              {isVisible ? '▼' : '▶'}
            </button>
          </div>
        </div>
      </div>

      {isVisible && (
        <div className="thought-process-content">
          {/* Overview Section - Always visible when panel is open */}
          <div className="thought-section overview-section">
            <div className="section-header" onClick={() => toggleSection('overview')}>
              <span className="section-icon">📊</span>
              <span className="section-title">Overview</span>
              <span className="section-toggle">{isExpanded('overview') ? '▼' : '▶'}</span>
            </div>
            
            {isExpanded('overview') && (
              <div className="section-content">
                {currentQuery && (
                  <ProgressIndicator
                    currentStep={currentQuery.current_step}
                    progress={currentQuery.progress}
                    expectedSteps={currentQuery.expected_steps}
                  />
                )}
                
                <ConfidenceScoreDisplay
                  score={confidence}
                  agreementLevel={agreementLevel}
                  isLoading={!currentQuery?.completed}
                />
                
                {thoughtProcess?.consensus_thought && (
                  <div className="quick-stats">
                    <div className="stat-item">
                      <span className="stat-label">Models:</span>
                      <span className="stat-value">
                        {thoughtProcess.consensus_thought.participating_models.length}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Agreement:</span>
                      <span className={`stat-value agreement-${agreementLevel}`}>
                        {agreementLevel.charAt(0).toUpperCase() + agreementLevel.slice(1)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Model Participation Section */}
          <div className="thought-section">
            <div className="section-header" onClick={() => toggleSection('models')}>
              <span className="section-icon">🤖</span>
              <span className="section-title">Model Participation</span>
              <span className="section-toggle">{isExpanded('models') ? '▼' : '▶'}</span>
            </div>
            
            {isExpanded('models') && (
              <div className="section-content">
                <ModelParticipationView
                  models={thoughtProcess?.model_thoughts || []}
                  isLoading={!currentQuery?.completed}
                />
              </div>
            )}
          </div>

          {/* Consensus Analysis Section */}
          <div className="thought-section">
            <div className="section-header" onClick={() => toggleSection('consensus')}>
              <span className="section-icon">🎯</span>
              <span className="section-title">Consensus Analysis</span>
              <span className="section-toggle">{isExpanded('consensus') ? '▼' : '▶'}</span>
            </div>
            
            {isExpanded('consensus') && (
              <div className="section-content">
                <ConsensusVisualization
                  consensus={thoughtProcess?.consensus_thought || null}
                  isLoading={!currentQuery?.completed}
                />
              </div>
            )}
          </div>

          {/* Resolution Method Section - Only show if resolution was used */}
          {thoughtProcess?.resolution_thought && (
            <div className="thought-section">
              <div className="section-header" onClick={() => toggleSection('resolution')}>
                <span className="section-icon">⚖️</span>
                <span className="section-title">Conflict Resolution</span>
                <span className="section-toggle">{isExpanded('resolution') ? '▼' : '▶'}</span>
              </div>
              
              {isExpanded('resolution') && (
                <div className="section-content">
                  <ResolutionMethodIndicator
                    method={thoughtProcess.resolution_thought.resolution_method}
                    attempts={thoughtProcess.resolution_thought.attempts_made}
                    successReason={thoughtProcess.resolution_thought.success_reason}
                  />
                </div>
              )}
            </div>
          )}

          {/* Performance Metrics Section */}
          <div className="thought-section">
            <div className="section-header" onClick={() => toggleSection('metrics')}>
              <span className="section-icon">📈</span>
              <span className="section-title">Performance Metrics</span>
              <span className="section-toggle">{isExpanded('metrics') ? '▼' : '▶'}</span>
            </div>
            
            {isExpanded('metrics') && (
              <div className="section-content">
                <ExecutionMetricsDisplay
                  metrics={{
                    execution_time: currentQuery?.total_duration,
                    models_count: thoughtProcess?.model_thoughts?.length,
                    valid_responses: thoughtProcess?.model_thoughts?.filter(m => m.status === 'success').length
                  }}
                />
              </div>
            )}
          </div>

          {/* Decision Factors - Show key factors that influenced the decision */}
          {thoughtProcess?.consensus_thought?.decision_factors && thoughtProcess.consensus_thought.decision_factors.length > 0 && (
            <div className="thought-section">
              <div className="section-header" onClick={() => toggleSection('factors')}>
                <span className="section-icon">💡</span>
                <span className="section-title">Decision Factors</span>
                <span className="section-toggle">{isExpanded('factors') ? '▼' : '▶'}</span>
              </div>
              
              {isExpanded('factors') && (
                <div className="section-content">
                  <div className="decision-factors">
                    {thoughtProcess.consensus_thought.decision_factors.map((factor, index) => (
                      <div key={index} className="decision-factor">
                        <span className="factor-icon">✓</span>
                        <span className="factor-text">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!currentQuery && !thoughtProcess && (
            <div className="empty-state">
              <div className="empty-icon">🤔</div>
              <p>No active thought process</p>
              <small>The AI's reasoning will appear here during query processing</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// IMPROVEMENT: Export wrapped component with error boundary
export const ThoughtProcessPanel: React.FC<ThoughtProcessDisplayProps> = (props) => {
  return (
    <ThoughtProcessErrorBoundary>
      <ThoughtProcessPanelCore {...props} />
    </ThoughtProcessErrorBoundary>
  );
};
