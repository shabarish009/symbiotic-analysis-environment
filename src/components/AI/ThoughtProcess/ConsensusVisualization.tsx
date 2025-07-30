/**
 * Consensus Visualization Component
 * Shows visual representation of model agreement and consensus analysis
 */

import React from 'react';
import { ConsensusVisualizationProps, AGREEMENT_COLORS } from '../../../types/thoughtProcess';
import './ConsensusVisualization.css';

export const ConsensusVisualization: React.FC<ConsensusVisualizationProps> = ({
  consensus,
  isLoading = false
}) => {
  if (isLoading && !consensus) {
    return (
      <div className="consensus-loading">
        <div className="loading-spinner"></div>
        <p>Calculating consensus...</p>
      </div>
    );
  }

  if (!consensus) {
    return (
      <div className="consensus-empty">
        <p>No consensus data available</p>
      </div>
    );
  }

  const getAgreementIcon = (level: string) => {
    switch (level) {
      case 'strong': return '🎯';
      case 'moderate': return '⚖️';
      case 'weak': return '🤔';
      default: return '❓';
    }
  };

  const getThresholdIcon = (met: boolean) => {
    return met ? '✅' : '⚠️';
  };

  const formatScore = (score: number) => {
    return `${Math.round(score * 100)}%`;
  };

  // Create agreement matrix visualization
  const renderAgreementMatrix = () => {
    const models = consensus.participating_models;
    if (models.length < 2) return null;

    return (
      <div className="agreement-matrix">
        <h5>Model Agreement Matrix</h5>
        <div className="matrix-container">
          <div className="matrix-grid">
            {/* Header row */}
            <div className="matrix-cell header"></div>
            {models.map(model => (
              <div key={model} className="matrix-cell header">
                {model.replace('_', ' ').substring(0, 8)}
              </div>
            ))}
            
            {/* Data rows */}
            {models.map(rowModel => (
              <React.Fragment key={rowModel}>
                <div className="matrix-cell header">
                  {rowModel.replace('_', ' ').substring(0, 8)}
                </div>
                {models.map(colModel => {
                  if (rowModel === colModel) {
                    return <div key={colModel} className="matrix-cell self">100%</div>;
                  }
                  
                  const similarity = consensus.similarity_matrix[rowModel]?.[colModel] || 0;
                  const color = similarity >= 0.7 ? '#28a745' : similarity >= 0.4 ? '#ffc107' : '#dc3545';
                  
                  return (
                    <div 
                      key={colModel} 
                      className="matrix-cell data"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {formatScore(similarity)}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="consensus-visualization">
      {/* Main Consensus Score */}
      <div className="consensus-score-section">
        <div className="score-display">
          <div className="score-icon">{getAgreementIcon(consensus.agreement_level)}</div>
          <div className="score-details">
            <div className="score-value" style={{ color: AGREEMENT_COLORS[consensus.agreement_level] }}>
              {formatScore(consensus.consensus_score)}
            </div>
            <div className="score-label">Consensus Score</div>
          </div>
          <div className="agreement-level">
            <div className="level-badge" style={{ backgroundColor: AGREEMENT_COLORS[consensus.agreement_level] }}>
              {consensus.agreement_level.toUpperCase()} AGREEMENT
            </div>
          </div>
        </div>

        <div className="threshold-info">
          <span className="threshold-icon">{getThresholdIcon(consensus.threshold_met)}</span>
          <span className="threshold-text">
            {consensus.threshold_met ? 'Consensus threshold met' : 'Consensus threshold not met'}
          </span>
        </div>
      </div>

      {/* Participating Models */}
      <div className="participating-models">
        <h5>Participating Models ({consensus.participating_models.length})</h5>
        <div className="models-grid">
          {consensus.participating_models.map((model, index) => (
            <div key={model} className="model-chip">
              <span className="model-number">{index + 1}</span>
              <span className="model-name">{model.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Decision Factors */}
      {consensus.decision_factors.length > 0 && (
        <div className="decision-factors">
          <h5>Key Decision Factors</h5>
          <div className="factors-list">
            {consensus.decision_factors.map((factor, index) => (
              <div key={index} className="factor-item">
                <span className="factor-bullet">•</span>
                <span className="factor-text">{factor}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agreement Matrix */}
      {renderAgreementMatrix()}

      {/* Consensus Interpretation */}
      <div className="consensus-interpretation">
        <h5>What This Means</h5>
        <div className="interpretation-content">
          {consensus.agreement_level === 'strong' && (
            <div className="interpretation-item positive">
              <span className="interpretation-icon">✅</span>
              <span className="interpretation-text">
                The AI models strongly agree on this response. You can have high confidence in the answer.
              </span>
            </div>
          )}
          
          {consensus.agreement_level === 'moderate' && (
            <div className="interpretation-item moderate">
              <span className="interpretation-icon">⚖️</span>
              <span className="interpretation-text">
                The AI models show moderate agreement. The answer is likely reliable, but consider the context.
              </span>
            </div>
          )}
          
          {consensus.agreement_level === 'weak' && (
            <div className="interpretation-item warning">
              <span className="interpretation-icon">⚠️</span>
              <span className="interpretation-text">
                The AI models disagree significantly. Consider asking for clarification or rephrasing your question.
              </span>
            </div>
          )}

          <div className="interpretation-item info">
            <span className="interpretation-icon">💡</span>
            <span className="interpretation-text">
              Consensus score of {formatScore(consensus.consensus_score)} indicates{' '}
              {consensus.consensus_score >= 0.8 ? 'very high' : 
               consensus.consensus_score >= 0.6 ? 'good' : 'limited'} agreement between models.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
