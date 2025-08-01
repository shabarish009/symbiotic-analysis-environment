import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './LearningProgress.css';

interface LearningProgressProps {
  projectId: string;
  sessionId?: string;
  className?: string;
}

interface LearningStats {
  total_corrections: number;
  corrections_by_type: Record<string, number>;
  average_confidence: number;
  patterns_learned: number;
  success_rate: number;
  user_satisfaction: number;
  learning_velocity: number;
  accuracy_trend: number[];
}

interface LearningTrends {
  trend: string;
  correction_velocity: number;
  confidence_trend: string;
  feedback_trend: string;
  total_corrections: number;
  avg_confidence: number;
}

interface SessionImpact {
  corrections_count: number;
  patterns_learned: number;
  accuracy_improvement: number;
  confidence_improvement: number;
  user_satisfaction: number;
  learning_effectiveness: number;
}

const LearningProgress: React.FC<LearningProgressProps> = ({
  projectId,
  sessionId,
  className = ''
}) => {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [trends, setTrends] = useState<LearningTrends | null>(null);
  const [sessionImpact, setSessionImpact] = useState<SessionImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchLearningProgress = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await invoke('ai_engine_request', {
        method: 'correction.progress',
        params: { project_id: projectId }
      });

      if (result.success) {
        setStats(result.statistics);
        setTrends(result.learning_trends);
        setLastUpdated(new Date());
      } else {
        setError(result.error || 'Failed to fetch learning progress');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchSessionImpact = useCallback(async () => {
    if (!sessionId) return;

    try {
      const result = await invoke('ai_engine_request', {
        method: 'correction.impact',
        params: { 
          session_id: sessionId,
          project_id: projectId 
        }
      });

      if (result.success) {
        setSessionImpact({
          corrections_count: result.corrections_count,
          patterns_learned: result.patterns_learned,
          accuracy_improvement: result.accuracy_improvement,
          confidence_improvement: result.confidence_improvement,
          user_satisfaction: result.user_satisfaction,
          learning_effectiveness: result.learning_effectiveness
        });
      }
    } catch (err) {
      console.error('Error fetching session impact:', err);
    }
  }, [sessionId, projectId]);

  useEffect(() => {
    fetchLearningProgress();
    fetchSessionImpact();
  }, [fetchLearningProgress, fetchSessionImpact]);

  const formatPercentage = (value: number): string => {
    return `${Math.round(value * 100)}%`;
  };

  const formatNumber = (value: number): string => {
    return value.toFixed(2);
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      case 'stable': return '➡️';
      case 'positive': return '😊';
      case 'negative': return '😞';
      case 'neutral': return '😐';
      default: return '❓';
    }
  };

  const getTrendColor = (trend: string): string => {
    switch (trend) {
      case 'improving':
      case 'positive': return '#008000';
      case 'declining':
      case 'negative': return '#800000';
      case 'stable':
      case 'neutral': return '#808080';
      default: return '#000080';
    }
  };

  if (loading) {
    return (
      <div className={`learning-progress loading ${className}`}>
        <div className="loading-content">
          <span className="loading-spinner">⏳</span>
          <span>Loading learning progress...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`learning-progress error ${className}`}>
        <div className="error-content">
          <span className="error-icon">❌</span>
          <span>Error: {error}</span>
          <button className="retry-btn" onClick={fetchLearningProgress}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`learning-progress ${className}`}>
      <div className="progress-header">
        <h3 className="progress-title">🧠 AI Learning Progress</h3>
        {lastUpdated && (
          <span className="last-updated">
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {sessionImpact && (
        <div className="session-impact">
          <h4 className="section-title">📊 Current Session Impact</h4>
          <div className="impact-grid">
            <div className="impact-item">
              <span className="impact-label">Corrections Made:</span>
              <span className="impact-value">{sessionImpact.corrections_count}</span>
            </div>
            <div className="impact-item">
              <span className="impact-label">Patterns Learned:</span>
              <span className="impact-value">{sessionImpact.patterns_learned}</span>
            </div>
            <div className="impact-item">
              <span className="impact-label">Accuracy Improvement:</span>
              <span className="impact-value positive">
                +{formatPercentage(sessionImpact.accuracy_improvement)}
              </span>
            </div>
            <div className="impact-item">
              <span className="impact-label">Confidence Boost:</span>
              <span className="impact-value positive">
                +{formatPercentage(sessionImpact.confidence_improvement)}
              </span>
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div className="overall-stats">
          <h4 className="section-title">📈 Overall Learning Statistics</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Total Corrections:</span>
              <span className="stat-value">{stats.total_corrections}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Patterns Learned:</span>
              <span className="stat-value">{stats.patterns_learned}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Success Rate:</span>
              <span className="stat-value">{formatPercentage(stats.success_rate)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">User Satisfaction:</span>
              <span className="stat-value">{formatPercentage(stats.user_satisfaction)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Learning Velocity:</span>
              <span className="stat-value">{formatNumber(stats.learning_velocity)} patterns/correction</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Average Confidence:</span>
              <span className="stat-value">{formatPercentage(stats.average_confidence)}</span>
            </div>
          </div>
        </div>
      )}

      {trends && (
        <div className="learning-trends">
          <h4 className="section-title">🔄 Learning Trends</h4>
          <div className="trends-grid">
            <div className="trend-item">
              <span className="trend-label">Overall Trend:</span>
              <span className="trend-value">
                {getTrendIcon(trends.trend)} {trends.trend.replace('_', ' ')}
              </span>
            </div>
            <div className="trend-item">
              <span className="trend-label">Confidence Trend:</span>
              <span 
                className="trend-value"
                style={{ color: getTrendColor(trends.confidence_trend) }}
              >
                {getTrendIcon(trends.confidence_trend)} {trends.confidence_trend}
              </span>
            </div>
            <div className="trend-item">
              <span className="trend-label">Feedback Trend:</span>
              <span 
                className="trend-value"
                style={{ color: getTrendColor(trends.feedback_trend) }}
              >
                {getTrendIcon(trends.feedback_trend)} {trends.feedback_trend}
              </span>
            </div>
            <div className="trend-item">
              <span className="trend-label">Correction Velocity:</span>
              <span className="trend-value">
                {formatNumber(trends.correction_velocity)} corrections/day
              </span>
            </div>
          </div>
        </div>
      )}

      {stats && stats.corrections_by_type && Object.keys(stats.corrections_by_type).length > 0 && (
        <div className="correction-types">
          <h4 className="section-title">📝 Correction Types</h4>
          <div className="types-list">
            {Object.entries(stats.corrections_by_type).map(([type, count]) => (
              <div key={type} className="type-item">
                <span className="type-label">{type.replace('_', ' ')}:</span>
                <span className="type-count">{count}</span>
                <div className="type-bar">
                  <div 
                    className="type-fill"
                    style={{ 
                      width: `${(count / Math.max(...Object.values(stats.corrections_by_type))) * 100}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="progress-actions">
        <button 
          className="refresh-btn"
          onClick={fetchLearningProgress}
          disabled={loading}
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};

export default LearningProgress;
