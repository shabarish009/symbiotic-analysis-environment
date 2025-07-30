/**
 * Execution Metrics Display Component
 * Shows performance metrics and timing information
 */

import React from 'react';
import { ExecutionMetricsDisplayProps } from '../../../types/thoughtProcess';
import './ExecutionMetricsDisplay.css';

export const ExecutionMetricsDisplay: React.FC<ExecutionMetricsDisplayProps> = ({
  metrics
}) => {
  const formatTime = (seconds?: number) => {
    if (seconds === undefined) return 'N/A';
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    return `${seconds.toFixed(2)}s`;
  };

  const getPerformanceRating = (time?: number) => {
    if (time === undefined) return { rating: 'unknown', color: '#6c757d', icon: '❓' };
    if (time < 2) return { rating: 'excellent', color: '#28a745', icon: '🚀' };
    if (time < 4) return { rating: 'good', color: '#17a2b8', icon: '👍' };
    if (time < 6) return { rating: 'fair', color: '#ffc107', icon: '⏱️' };
    return { rating: 'slow', color: '#dc3545', icon: '🐌' };
  };

  const getSuccessRate = () => {
    if (!metrics.models_count || !metrics.valid_responses) return 0;
    return (metrics.valid_responses / metrics.models_count) * 100;
  };

  const performance = getPerformanceRating(metrics.execution_time);
  const successRate = getSuccessRate();

  return (
    <div className="execution-metrics-display">
      <div className="metrics-header">
        <h4>Performance Metrics</h4>
        <div className="overall-rating">
          <span className="rating-icon">{performance.icon}</span>
          <span className="rating-text" style={{ color: performance.color }}>
            {performance.rating.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="metrics-grid">
        {/* Execution Time */}
        <div className="metric-card primary">
          <div className="metric-icon">⏱️</div>
          <div className="metric-content">
            <div className="metric-value" style={{ color: performance.color }}>
              {formatTime(metrics.execution_time)}
            </div>
            <div className="metric-label">Total Execution Time</div>
            <div className="metric-description">
              Time from query start to final result
            </div>
          </div>
        </div>

        {/* Models Count */}
        <div className="metric-card">
          <div className="metric-icon">🤖</div>
          <div className="metric-content">
            <div className="metric-value">
              {metrics.models_count || 0}
            </div>
            <div className="metric-label">Models Used</div>
            <div className="metric-description">
              AI models that processed your query
            </div>
          </div>
        </div>

        {/* Valid Responses */}
        <div className="metric-card">
          <div className="metric-icon">✅</div>
          <div className="metric-content">
            <div className="metric-value">
              {metrics.valid_responses || 0}
            </div>
            <div className="metric-label">Valid Responses</div>
            <div className="metric-description">
              Models that provided successful responses
            </div>
          </div>
        </div>

        {/* Success Rate */}
        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <div className="metric-value" style={{ 
              color: successRate >= 80 ? '#28a745' : successRate >= 60 ? '#ffc107' : '#dc3545' 
            }}>
              {Math.round(successRate)}%
            </div>
            <div className="metric-label">Success Rate</div>
            <div className="metric-description">
              Percentage of models that succeeded
            </div>
          </div>
        </div>
      </div>

      {/* Performance Breakdown */}
      <div className="performance-breakdown">
        <h5>Performance Analysis</h5>
        <div className="breakdown-items">
          <div className="breakdown-item">
            <div className="breakdown-label">Response Time:</div>
            <div className="breakdown-content">
              <div className="breakdown-bar">
                <div 
                  className="breakdown-fill"
                  style={{ 
                    width: `${Math.min((metrics.execution_time || 0) / 10 * 100, 100)}%`,
                    backgroundColor: performance.color
                  }}
                />
              </div>
              <div className="breakdown-text">
                {formatTime(metrics.execution_time)} 
                {metrics.execution_time && metrics.execution_time < 5 && ' (Fast)'}
                {metrics.execution_time && metrics.execution_time >= 5 && metrics.execution_time < 8 && ' (Normal)'}
                {metrics.execution_time && metrics.execution_time >= 8 && ' (Slow)'}
              </div>
            </div>
          </div>

          <div className="breakdown-item">
            <div className="breakdown-label">Model Reliability:</div>
            <div className="breakdown-content">
              <div className="breakdown-bar">
                <div 
                  className="breakdown-fill"
                  style={{ 
                    width: `${successRate}%`,
                    backgroundColor: successRate >= 80 ? '#28a745' : successRate >= 60 ? '#ffc107' : '#dc3545'
                  }}
                />
              </div>
              <div className="breakdown-text">
                {metrics.valid_responses || 0} of {metrics.models_count || 0} models succeeded
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Tips */}
      <div className="performance-tips">
        <h5>Performance Insights</h5>
        <div className="tips-list">
          {metrics.execution_time && metrics.execution_time < 3 && (
            <div className="tip-item positive">
              <span className="tip-icon">🚀</span>
              <span className="tip-text">Excellent response time! The AI processed your query very quickly.</span>
            </div>
          )}
          
          {metrics.execution_time && metrics.execution_time >= 6 && (
            <div className="tip-item warning">
              <span className="tip-icon">⏱️</span>
              <span className="tip-text">Response took longer than usual. Complex queries may require more processing time.</span>
            </div>
          )}
          
          {successRate >= 90 && (
            <div className="tip-item positive">
              <span className="tip-icon">✅</span>
              <span className="tip-text">Excellent model reliability! All or most models provided valid responses.</span>
            </div>
          )}
          
          {successRate < 70 && (
            <div className="tip-item warning">
              <span className="tip-icon">⚠️</span>
              <span className="tip-text">Some models had difficulty with this query. Consider rephrasing for better results.</span>
            </div>
          )}
          
          {metrics.models_count && metrics.models_count >= 3 && (
            <div className="tip-item info">
              <span className="tip-icon">🤖</span>
              <span className="tip-text">Multiple models were used to ensure reliable consensus and reduce hallucinations.</span>
            </div>
          )}
        </div>
      </div>

      {/* Comparison with typical performance */}
      <div className="performance-comparison">
        <h5>Compared to Typical Performance</h5>
        <div className="comparison-items">
          <div className="comparison-item">
            <span className="comparison-label">Speed:</span>
            <span className="comparison-value">
              {metrics.execution_time && metrics.execution_time < 3 ? 'Faster than average' :
               metrics.execution_time && metrics.execution_time < 6 ? 'Average' : 'Slower than average'}
            </span>
          </div>
          <div className="comparison-item">
            <span className="comparison-label">Reliability:</span>
            <span className="comparison-value">
              {successRate >= 85 ? 'Above average' :
               successRate >= 70 ? 'Average' : 'Below average'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
