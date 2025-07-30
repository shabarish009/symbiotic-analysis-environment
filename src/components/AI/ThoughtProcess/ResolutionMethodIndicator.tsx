/**
 * Resolution Method Indicator Component
 * Shows information about conflict resolution when models disagree
 */

import React from 'react';
import { ResolutionMethodIndicatorProps } from '../../../types/thoughtProcess';
import './ResolutionMethodIndicator.css';

export const ResolutionMethodIndicator: React.FC<ResolutionMethodIndicatorProps> = ({
  method,
  attempts,
  successReason
}) => {
  const getMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'majority_consensus': return '🗳️';
      case 'weighted_consensus': return '⚖️';
      case 'highest_confidence': return '🎯';
      case 'best_quality': return '⭐';
      case 'hybrid_synthesis': return '🔄';
      default: return '🔧';
    }
  };

  const getMethodDescription = (method: string) => {
    switch (method.toLowerCase()) {
      case 'majority_consensus':
        return 'Selected the response that most models agreed upon';
      case 'weighted_consensus':
        return 'Chose response based on model weights and confidence scores';
      case 'highest_confidence':
        return 'Selected the response from the most confident model';
      case 'best_quality':
        return 'Chose the response with the highest content quality score';
      case 'hybrid_synthesis':
        return 'Combined elements from multiple responses to create the best answer';
      default:
        return 'Applied a specialized resolution strategy';
    }
  };

  const getAttemptIcon = (attempt: string, wasSuccessful: boolean) => {
    if (wasSuccessful) return '✅';
    return '❌';
  };

  const formatMethodName = (method: string) => {
    return method
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="resolution-method-indicator">
      <div className="resolution-header">
        <div className="method-info">
          <div className="method-icon">{getMethodIcon(method)}</div>
          <div className="method-details">
            <div className="method-name">{formatMethodName(method)}</div>
            <div className="method-description">{getMethodDescription(method)}</div>
          </div>
        </div>
        <div className="resolution-status">
          <span className="status-icon">✅</span>
          <span className="status-text">Resolved</span>
        </div>
      </div>

      <div className="resolution-explanation">
        <h5>Why This Method Was Used</h5>
        <div className="explanation-content">
          <div className="explanation-icon">💡</div>
          <div className="explanation-text">{successReason}</div>
        </div>
      </div>

      {attempts.length > 0 && (
        <div className="resolution-attempts">
          <h5>Resolution Process</h5>
          <div className="attempts-list">
            {attempts.map((attempt, index) => {
              const wasSuccessful = attempt === method;
              return (
                <div key={index} className={`attempt-item ${wasSuccessful ? 'successful' : 'failed'}`}>
                  <div className="attempt-status">
                    {getAttemptIcon(attempt, wasSuccessful)}
                  </div>
                  <div className="attempt-details">
                    <div className="attempt-name">{formatMethodName(attempt)}</div>
                    <div className="attempt-result">
                      {wasSuccessful ? 'Successfully resolved the conflict' : 'Did not achieve consensus'}
                    </div>
                  </div>
                  <div className="attempt-order">
                    Step {index + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="resolution-impact">
        <h5>Impact on Confidence</h5>
        <div className="impact-items">
          <div className="impact-item">
            <span className="impact-icon">🔍</span>
            <span className="impact-text">
              Conflict resolution was needed, which may slightly reduce overall confidence
            </span>
          </div>
          <div className="impact-item">
            <span className="impact-icon">⚖️</span>
            <span className="impact-text">
              The chosen method ({formatMethodName(method)}) provides the most reliable result
            </span>
          </div>
          <div className="impact-item">
            <span className="impact-icon">✅</span>
            <span className="impact-text">
              Resolution was successful, indicating the AI can still provide a trustworthy answer
            </span>
          </div>
        </div>
      </div>

      <div className="resolution-advice">
        <div className="advice-header">
          <span className="advice-icon">💭</span>
          <span className="advice-title">What This Means for You</span>
        </div>
        <div className="advice-content">
          {method === 'majority_consensus' && (
            <p>Most AI models agreed on this response, making it highly reliable despite initial disagreement.</p>
          )}
          {method === 'weighted_consensus' && (
            <p>The response was chosen based on model reliability and confidence, providing a balanced answer.</p>
          )}
          {method === 'highest_confidence' && (
            <p>The most confident model's response was selected. Consider the specific context of your question.</p>
          )}
          {method === 'best_quality' && (
            <p>The highest quality response was chosen based on content analysis and structure.</p>
          )}
          {method === 'hybrid_synthesis' && (
            <p>Elements from multiple responses were combined to provide the most comprehensive answer.</p>
          )}
          {!['majority_consensus', 'weighted_consensus', 'highest_confidence', 'best_quality', 'hybrid_synthesis'].includes(method) && (
            <p>A specialized resolution method was used to provide the best possible answer.</p>
          )}
        </div>
      </div>
    </div>
  );
};
