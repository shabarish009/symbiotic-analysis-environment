/**
 * Query History View Component
 * Displays query history with XP styling
 */

import React, { useState } from 'react';
import { QueryHistoryViewProps, QueryHistoryEntry } from '../../types/memory';
import './QueryHistoryView.css';

const QueryHistoryView: React.FC<QueryHistoryViewProps> = ({
  projectId,
  history,
  onQuerySelect,
  filters,
  onFiltersChange
}) => {
  const [selectedQuery, setSelectedQuery] = useState<QueryHistoryEntry | null>(null);
  const [sortBy, setSortBy] = useState<'timestamp' | 'success_score' | 'execution_time'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleQueryClick = (query: QueryHistoryEntry) => {
    setSelectedQuery(query);
    onQuerySelect?.(query);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatExecutionTime = (time: number) => {
    return `${(time * 1000).toFixed(0)}ms`;
  };

  const getSuccessScoreColor = (score: number) => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'warning';
    return 'error';
  };

  const getFeedbackIcon = (feedback?: number) => {
    if (feedback === 1) return '👍';
    if (feedback === -1) return '👎';
    return '➖';
  };

  const sortedHistory = [...history].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'timestamp':
        aValue = a.timestamp;
        bValue = b.timestamp;
        break;
      case 'success_score':
        aValue = a.success_score;
        bValue = b.success_score;
        break;
      case 'execution_time':
        aValue = a.execution_time;
        bValue = b.execution_time;
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'asc') {
      return aValue - bValue;
    } else {
      return bValue - aValue;
    }
  });

  if (history.length === 0) {
    return (
      <div className="query-history-view">
        <div className="empty-state">
          <div className="empty-icon">📜</div>
          <div className="empty-message">
            <strong>No Query History Found</strong>
            <p>Execute some queries to see your history here. The AI will learn from your patterns!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="query-history-view">
      <div className="history-header">
        <h4>Query History ({history.length})</h4>
        <div className="sort-controls">
          <label>Sort by:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="sort-select"
          >
            <option value="timestamp">Time</option>
            <option value="success_score">Success Score</option>
            <option value="execution_time">Execution Time</option>
          </select>
          <button 
            className="sort-order-button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className="history-list">
        {sortedHistory.map((query) => {
          const isSelected = selectedQuery?.id === query.id;
          
          return (
            <div 
              key={query.id || query.query_hash} 
              className={`history-item ${isSelected ? 'selected' : ''}`}
              onClick={() => handleQueryClick(query)}
            >
              <div className="query-header">
                <div className="query-preview">
                  <span className="query-icon">🔍</span>
                  <span className="query-text">
                    {query.query_text.length > 80 
                      ? `${query.query_text.substring(0, 80)}...` 
                      : query.query_text
                    }
                  </span>
                </div>
                <div className="query-metrics">
                  <span className={`success-score ${getSuccessScoreColor(query.success_score)}`}>
                    {(query.success_score * 100).toFixed(0)}%
                  </span>
                  <span className="execution-time">
                    {formatExecutionTime(query.execution_time)}
                  </span>
                  <span className="feedback-icon">
                    {getFeedbackIcon(query.user_feedback)}
                  </span>
                </div>
              </div>
              
              <div className="query-metadata">
                <span className="timestamp">
                  {formatTimestamp(query.timestamp)}
                </span>
                {query.context && Object.keys(query.context).length > 0 && (
                  <span className="context-indicator" title="Has context data">
                    📋
                  </span>
                )}
              </div>

              {isSelected && (
                <div className="query-details">
                  <div className="full-query">
                    <h5>Full Query:</h5>
                    <pre className="query-code">{query.query_text}</pre>
                  </div>
                  
                  {query.context && Object.keys(query.context).length > 0 && (
                    <div className="query-context">
                      <h5>Context:</h5>
                      <div className="context-items">
                        {Object.entries(query.context).map(([key, value]) => (
                          <div key={key} className="context-item">
                            <span className="context-key">{key}:</span>
                            <span className="context-value">
                              {typeof value === 'object' 
                                ? JSON.stringify(value, null, 2) 
                                : String(value)
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="consensus-info">
                    <h5>Consensus Result:</h5>
                    <div className="consensus-details">
                      <div className="consensus-item">
                        <span className="label">Status:</span>
                        <span className="value">{query.consensus_result.status || 'Unknown'}</span>
                      </div>
                      <div className="consensus-item">
                        <span className="label">Confidence:</span>
                        <span className="value">{(query.success_score * 100).toFixed(1)}%</span>
                      </div>
                      <div className="consensus-item">
                        <span className="label">Execution Time:</span>
                        <span className="value">{formatExecutionTime(query.execution_time)}</span>
                      </div>
                      {query.consensus_result.supporting_models && (
                        <div className="consensus-item">
                          <span className="label">Supporting Models:</span>
                          <span className="value">
                            {query.consensus_result.supporting_models.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QueryHistoryView;
