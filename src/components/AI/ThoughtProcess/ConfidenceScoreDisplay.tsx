/**
 * Confidence Score Display Component
 * Shows the AI's confidence level with visual indicators
 */

import React from 'react';
import { ConfidenceScoreDisplayProps, AGREEMENT_COLORS } from '../../../types/thoughtProcess';
import './ConfidenceScoreDisplay.css';

export const ConfidenceScoreDisplay: React.FC<ConfidenceScoreDisplayProps> = ({
  score,
  agreementLevel,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="confidence-score-loading">
        <div className="loading-spinner"></div>
        <p>Calculating confidence...</p>
      </div>
    );
  }

  const getConfidenceIcon = (score: number) => {
    if (score >= 0.8) return '🎯';
    if (score >= 0.6) return '👍';
    if (score >= 0.4) return '🤷';
    return '⚠️';
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 0.9) return 'Very High Confidence';
    if (score >= 0.8) return 'High Confidence';
    if (score >= 0.6) return 'Moderate Confidence';
    if (score >= 0.4) return 'Low Confidence';
    return 'Very Low Confidence';
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return '#28a745'; // Green
    if (score >= 0.6) return '#17a2b8'; // Blue
    if (score >= 0.4) return '#ffc107'; // Yellow
    return '#dc3545'; // Red
  };

  const getConfidenceDescription = (score: number, agreementLevel: string) => {
    if (score >= 0.8 && agreementLevel === 'strong') {
      return 'The AI is very confident in this response. Multiple models strongly agree.';
    }
    if (score >= 0.6 && agreementLevel === 'moderate') {
      return 'The AI has good confidence in this response. Models show reasonable agreement.';
    }
    if (score >= 0.4) {
      return 'The AI has moderate confidence. Consider the context and verify if needed.';
    }
    return 'The AI has low confidence in this response. Consider rephrasing your question or seeking additional sources.';
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  const confidenceColor = getConfidenceColor(score);
  const agreementColor = AGREEMENT_COLORS[agreementLevel];

  return (
    <div className="confidence-score-display">
      <div className="confidence-header">
        <div className="confidence-main">
          <div className="confidence-icon">{getConfidenceIcon(score)}</div>
          <div className="confidence-details">
            <div className="confidence-score" style={{ color: confidenceColor }}>
              {formatPercentage(score)}
            </div>
            <div className="confidence-label">{getConfidenceLabel(score)}</div>
          </div>
        </div>
        
        <div className="agreement-indicator">
          <div 
            className="agreement-badge"
            style={{ backgroundColor: agreementColor }}
          >
            {agreementLevel.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="confidence-visual">
        <div className="confidence-bar-container">
          <div className="confidence-bar">
            <div 
              className="confidence-fill"
              style={{ 
                width: `${score * 100}%`,
                backgroundColor: confidenceColor
              }}
            />
          </div>
          <div className="confidence-markers">
            <div className="marker" style={{ left: '20%' }}>
              <div className="marker-line"></div>
              <div className="marker-label">Low</div>
            </div>
            <div className="marker" style={{ left: '60%' }}>
              <div className="marker-line"></div>
              <div className="marker-label">Good</div>
            </div>
            <div className="marker" style={{ left: '80%' }}>
              <div className="marker-line"></div>
              <div className="marker-label">High</div>
            </div>
          </div>
        </div>
      </div>

      <div className="confidence-description">
        <p>{getConfidenceDescription(score, agreementLevel)}</p>
      </div>

      <div className="confidence-breakdown">
        <div className="breakdown-item">
          <span className="breakdown-label">Consensus Score:</span>
          <span className="breakdown-value" style={{ color: confidenceColor }}>
            {formatPercentage(score)}
          </span>
        </div>
        <div className="breakdown-item">
          <span className="breakdown-label">Agreement Level:</span>
          <span className="breakdown-value" style={{ color: agreementColor }}>
            {agreementLevel.charAt(0).toUpperCase() + agreementLevel.slice(1)}
          </span>
        </div>
      </div>

      {/* Trust indicators */}
      <div className="trust-indicators">
        <div className="trust-header">Trust Indicators:</div>
        <div className="trust-items">
          {score >= 0.8 && (
            <div className="trust-item positive">
              <span className="trust-icon">✅</span>
              <span className="trust-text">High model agreement</span>
            </div>
          )}
          
          {agreementLevel === 'strong' && (
            <div className="trust-item positive">
              <span className="trust-icon">🎯</span>
              <span className="trust-text">Strong consensus reached</span>
            </div>
          )}
          
          {score >= 0.6 && score < 0.8 && (
            <div className="trust-item moderate">
              <span className="trust-icon">👍</span>
              <span className="trust-text">Good confidence level</span>
            </div>
          )}
          
          {score < 0.6 && (
            <div className="trust-item warning">
              <span className="trust-icon">⚠️</span>
              <span className="trust-text">Consider verification</span>
            </div>
          )}
          
          {agreementLevel === 'weak' && (
            <div className="trust-item warning">
              <span className="trust-icon">🤔</span>
              <span className="trust-text">Models show disagreement</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
