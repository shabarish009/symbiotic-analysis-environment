/**
 * Model Participation View Component
 * Shows individual model contributions to the consensus process
 */

import React, { useMemo } from 'react';
import { ModelParticipationViewProps, STATUS_COLORS, validateModelThought } from '../../../types/thoughtProcess';
import './ModelParticipationView.css';

export const ModelParticipationView: React.FC<ModelParticipationViewProps> = ({
  models,
  isLoading = false
}) => {
  // IMPROVEMENT: Data validation and memoization for performance
  const validatedModels = useMemo(() => {
    return models.filter(model => {
      const isValid = validateModelThought(model);
      if (!isValid) {
        console.warn('Invalid model thought data:', model);
      }
      return isValid;
    });
  }, [models]);

  // IMPROVEMENT: Memoized statistics calculation
  const modelStats = useMemo(() => {
    const total = validatedModels.length;
    const successful = validatedModels.filter(m => m.status === 'success').length;
    const failed = total - successful;

    return { total, successful, failed };
  }, [validatedModels]);

  if (isLoading && validatedModels.length === 0) {
    return (
      <div className="model-participation-loading">
        <div className="loading-spinner"></div>
        <p>Models are processing your query...</p>
      </div>
    );
  }

  if (validatedModels.length === 0) {
    return (
      <div className="model-participation-empty">
        <p>No valid model data available</p>
        {models.length > 0 && (
          <small>Some model data was invalid and filtered out</small>
        )}
      </div>
    );
  }

  const getModelIcon = (modelId: string) => {
    if (modelId.includes('analytical')) return '🔬';
    if (modelId.includes('creative')) return '🎨';
    if (modelId.includes('conservative')) return '🛡️';
    return '🤖';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'timeout': return '⏱️';
      case 'error': return '❌';
      case 'invalid_response': return '⚠️';
      default: return '❓';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#28a745'; // Green
    if (confidence >= 0.6) return '#ffc107'; // Yellow
    return '#dc3545'; // Red
  };

  const formatExecutionTime = (time: number) => {
    return `${time.toFixed(2)}s`;
  };

  return (
    <div className="model-participation-view">
      <div className="models-summary">
        <div className="summary-item">
          <span className="summary-label">Total Models:</span>
          <span className="summary-value">{modelStats.total}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Successful:</span>
          <span className="summary-value success">
            {modelStats.successful}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Failed:</span>
          <span className="summary-value error">
            {modelStats.failed}
          </span>
        </div>
      </div>

      <div className="models-list">
        {validatedModels.map((model, index) => (
          <div key={model.model_id} className={`model-card ${model.status}`}>
            <div className="model-header">
              <div className="model-info">
                <span className="model-icon">{getModelIcon(model.model_id)}</span>
                <div className="model-details">
                  <div className="model-name">{model.model_id.replace('_', ' ').toUpperCase()}</div>
                  <div className="model-status">
                    <span className="status-icon">{getStatusIcon(model.status)}</span>
                    <span className="status-text">{model.status.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
              
              <div className="model-metrics">
                <div className="confidence-score">
                  <div className="confidence-label">Confidence</div>
                  <div 
                    className="confidence-value"
                    style={{ color: getConfidenceColor(model.confidence) }}
                  >
                    {Math.round(model.confidence * 100)}%
                  </div>
                </div>
                <div className="execution-time">
                  <div className="time-label">Time</div>
                  <div className="time-value">{formatExecutionTime(model.execution_time)}</div>
                </div>
              </div>
            </div>

            {model.status === 'success' && (
              <div className="model-content">
                <div className="response-preview">
                  <div className="preview-label">Response Preview:</div>
                  <div className="preview-text">{model.response_preview}</div>
                </div>

                {model.reasoning_indicators.length > 0 && (
                  <div className="reasoning-indicators">
                    <div className="indicators-label">Key Insights:</div>
                    <div className="indicators-list">
                      {model.reasoning_indicators.map((indicator, idx) => (
                        <span key={idx} className="indicator-tag">
                          {indicator}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="model-scores">
                  <div className="score-item">
                    <span className="score-label">Content Quality:</span>
                    <div className="score-bar">
                      <div 
                        className="score-fill"
                        style={{ 
                          width: `${model.content_score * 100}%`,
                          backgroundColor: getConfidenceColor(model.content_score)
                        }}
                      />
                    </div>
                    <span className="score-value">{Math.round(model.content_score * 100)}%</span>
                  </div>

                  {Object.keys(model.similarity_scores).length > 0 && (
                    <div className="similarity-scores">
                      <div className="similarity-label">Agreement with other models:</div>
                      {Object.entries(model.similarity_scores).map(([otherId, score]) => (
                        <div key={otherId} className="similarity-item">
                          <span className="other-model">{otherId.replace('_', ' ')}</span>
                          <div className="similarity-bar">
                            <div 
                              className="similarity-fill"
                              style={{ 
                                width: `${score * 100}%`,
                                backgroundColor: getConfidenceColor(score)
                              }}
                            />
                          </div>
                          <span className="similarity-value">{Math.round(score * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {model.status !== 'success' && (
              <div className="model-error">
                <div className="error-message">
                  {model.status === 'timeout' && 'Model response timed out'}
                  {model.status === 'error' && 'Model encountered an error'}
                  {model.status === 'invalid_response' && 'Model provided invalid response'}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
