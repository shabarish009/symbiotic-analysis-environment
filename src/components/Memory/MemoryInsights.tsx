/**
 * Memory Insights Component
 * Displays memory system analytics and insights with XP styling
 */

import React from 'react';
import { MemoryInsightsProps, MemoryStatus } from '../../types/memory';
import './MemoryInsights.css';

const MemoryInsights: React.FC<MemoryInsightsProps> = ({
  projectId,
  stats,
  context
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

  const getHealthStatusColor = (status: MemoryStatus) => {
    switch (status) {
      case MemoryStatus.SUCCESS:
        return 'success';
      case MemoryStatus.FAILED:
      case MemoryStatus.CORRUPTED:
        return 'error';
      case MemoryStatus.PARTIAL:
      case MemoryStatus.RECOVERING:
        return 'warning';
      default:
        return 'unknown';
    }
  };

  const getHealthStatusText = (status: MemoryStatus) => {
    switch (status) {
      case MemoryStatus.SUCCESS:
        return 'Healthy';
      case MemoryStatus.FAILED:
        return 'Failed';
      case MemoryStatus.CORRUPTED:
        return 'Corrupted';
      case MemoryStatus.PARTIAL:
        return 'Partial';
      case MemoryStatus.RECOVERING:
        return 'Recovering';
      default:
        return 'Unknown';
    }
  };

  const calculateLearningProgress = () => {
    if (!stats) return 0;
    
    // Simple heuristic: more data = better learning
    const schemaScore = Math.min(stats.schema_count / 10, 1) * 25;
    const queryScore = Math.min(stats.query_count / 100, 1) * 35;
    const patternScore = Math.min(stats.pattern_count / 50, 1) * 40;
    
    return Math.round(schemaScore + queryScore + patternScore);
  };

  const getPerformanceRating = () => {
    if (!stats) return 'Unknown';
    
    const avgTime = stats.avg_retrieval_time;
    const cacheRate = stats.cache_hit_rate;
    
    if (avgTime < 0.05 && cacheRate > 0.8) return 'Excellent';
    if (avgTime < 0.1 && cacheRate > 0.6) return 'Good';
    if (avgTime < 0.2 && cacheRate > 0.4) return 'Fair';
    return 'Needs Improvement';
  };

  if (!stats) {
    return (
      <div className="memory-insights">
        <div className="loading-state">
          <div className="loading-icon">📊</div>
          <div className="loading-message">Loading memory insights...</div>
        </div>
      </div>
    );
  }

  const learningProgress = calculateLearningProgress();
  const performanceRating = getPerformanceRating();

  return (
    <div className="memory-insights">
      <div className="insights-header">
        <h4>Memory System Insights</h4>
        <div className="project-info">
          Project: <strong>{projectId}</strong>
        </div>
      </div>

      <div className="insights-grid">
        {/* System Health */}
        <div className="insight-card">
          <div className="card-header">
            <span className="card-icon">🏥</span>
            <h5>System Health</h5>
          </div>
          <div className="card-content">
            <div className={`health-status ${getHealthStatusColor(stats.health_status)}`}>
              <span className="status-indicator">●</span>
              <span className="status-text">{getHealthStatusText(stats.health_status)}</span>
            </div>
            <div className="health-details">
              <div className="detail-item">
                <span className="label">Database Size:</span>
                <span className="value">{formatBytes(stats.database_size_mb * 1024 * 1024)}</span>
              </div>
              <div className="detail-item">
                <span className="label">Last Cleanup:</span>
                <span className="value">
                  {stats.last_cleanup ? new Date(stats.last_cleanup * 1000).toLocaleDateString() : 'Never'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Learning Progress */}
        <div className="insight-card">
          <div className="card-header">
            <span className="card-icon">🧠</span>
            <h5>Learning Progress</h5>
          </div>
          <div className="card-content">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${learningProgress}%` }}
              ></div>
              <span className="progress-text">{learningProgress}%</span>
            </div>
            <div className="learning-breakdown">
              <div className="breakdown-item">
                <span className="label">Schemas:</span>
                <span className="value">{stats.schema_count}</span>
              </div>
              <div className="breakdown-item">
                <span className="label">Queries:</span>
                <span className="value">{stats.query_count}</span>
              </div>
              <div className="breakdown-item">
                <span className="label">Patterns:</span>
                <span className="value">{stats.pattern_count}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="insight-card">
          <div className="card-header">
            <span className="card-icon">⚡</span>
            <h5>Performance</h5>
          </div>
          <div className="card-content">
            <div className={`performance-rating rating-${performanceRating.toLowerCase().replace(' ', '-')}`}>
              {performanceRating}
            </div>
            <div className="performance-metrics">
              <div className="metric-item">
                <span className="label">Avg Retrieval:</span>
                <span className="value">{formatDuration(stats.avg_retrieval_time)}</span>
              </div>
              <div className="metric-item">
                <span className="label">Cache Hit Rate:</span>
                <span className="value">{(stats.cache_hit_rate * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Context Quality */}
        {context && (
          <div className="insight-card">
            <div className="card-header">
              <span className="card-icon">🎯</span>
              <h5>Context Quality</h5>
            </div>
            <div className="card-content">
              <div className="context-score">
                <div className="score-circle">
                  <span className="score-value">{(context.context_score * 100).toFixed(0)}</span>
                  <span className="score-unit">%</span>
                </div>
              </div>
              <div className="context-breakdown">
                <div className="breakdown-item">
                  <span className="label">Relevant Schemas:</span>
                  <span className="value">{context.relevant_schemas.length}</span>
                </div>
                <div className="breakdown-item">
                  <span className="label">Similar Queries:</span>
                  <span className="value">{context.similar_queries.length}</span>
                </div>
                <div className="breakdown-item">
                  <span className="label">Learned Patterns:</span>
                  <span className="value">{context.learned_patterns.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Usage Statistics */}
        <div className="insight-card full-width">
          <div className="card-header">
            <span className="card-icon">📈</span>
            <h5>Usage Statistics</h5>
          </div>
          <div className="card-content">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{stats.project_count}</div>
                <div className="stat-label">Projects</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.schema_count}</div>
                <div className="stat-label">Database Schemas</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.query_count}</div>
                <div className="stat-label">Queries Stored</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.pattern_count}</div>
                <div className="stat-label">Patterns Learned</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{(stats.cache_hit_rate * 100).toFixed(0)}%</div>
                <div className="stat-label">Cache Efficiency</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatBytes(stats.database_size_mb * 1024 * 1024)}</div>
                <div className="stat-label">Memory Usage</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="insight-card full-width">
          <div className="card-header">
            <span className="card-icon">💡</span>
            <h5>Recommendations</h5>
          </div>
          <div className="card-content">
            <div className="recommendations-list">
              {stats.query_count < 10 && (
                <div className="recommendation">
                  <span className="rec-icon">🔍</span>
                  <span className="rec-text">
                    Execute more queries to help the AI learn your patterns and preferences.
                  </span>
                </div>
              )}
              
              {stats.schema_count === 0 && (
                <div className="recommendation">
                  <span className="rec-icon">🗃️</span>
                  <span className="rec-text">
                    Connect to a database to enable schema-aware query suggestions.
                  </span>
                </div>
              )}
              
              {stats.cache_hit_rate < 0.5 && (
                <div className="recommendation">
                  <span className="rec-icon">⚡</span>
                  <span className="rec-text">
                    Query patterns are diverse. Consider organizing similar queries for better caching.
                  </span>
                </div>
              )}
              
              {stats.avg_retrieval_time > 0.1 && (
                <div className="recommendation">
                  <span className="rec-icon">🚀</span>
                  <span className="rec-text">
                    Memory retrieval is slower than optimal. Consider database cleanup or optimization.
                  </span>
                </div>
              )}
              
              {learningProgress > 80 && (
                <div className="recommendation success">
                  <span className="rec-icon">🎉</span>
                  <span className="rec-text">
                    Excellent! Your AI has learned substantial patterns and can provide great assistance.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemoryInsights;
