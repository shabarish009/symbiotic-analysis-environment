/**
 * Learned Patterns View Component
 * Displays AI learned patterns with XP styling
 */

import React, { useState } from 'react';
import { LearnedPatternsViewProps, LearnedPattern, PatternType } from '../../types/memory';
import './LearnedPatternsView.css';

const LearnedPatternsView: React.FC<LearnedPatternsViewProps> = ({
  projectId,
  patterns,
  onPatternSelect,
  patternType
}) => {
  const [selectedPattern, setSelectedPattern] = useState<LearnedPattern | null>(null);
  const [filterType, setFilterType] = useState<PatternType | 'all'>('all');

  const handlePatternClick = (pattern: LearnedPattern) => {
    setSelectedPattern(pattern);
    onPatternSelect?.(pattern);
  };

  const getPatternIcon = (type: PatternType) => {
    switch (type) {
      case PatternType.QUERY_TEMPLATE:
        return '📝';
      case PatternType.USER_PREFERENCE:
        return '⚙️';
      case PatternType.SCHEMA_USAGE:
        return '🗃️';
      case PatternType.QUERY_SIMILARITY:
        return '🔍';
      case PatternType.SUCCESS_PATTERN:
        return '✅';
      default:
        return '🧩';
    }
  };

  const getPatternTypeName = (type: PatternType) => {
    switch (type) {
      case PatternType.QUERY_TEMPLATE:
        return 'Query Template';
      case PatternType.USER_PREFERENCE:
        return 'User Preference';
      case PatternType.SCHEMA_USAGE:
        return 'Schema Usage';
      case PatternType.QUERY_SIMILARITY:
        return 'Query Similarity';
      case PatternType.SUCCESS_PATTERN:
        return 'Success Pattern';
      default:
        return 'Unknown';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const filteredPatterns = patterns.filter(pattern => 
    filterType === 'all' || pattern.pattern_type === filterType
  );

  const sortedPatterns = [...filteredPatterns].sort((a, b) => {
    // Sort by confidence first, then by usage count
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return b.usage_count - a.usage_count;
  });

  if (patterns.length === 0) {
    return (
      <div className="learned-patterns-view">
        <div className="empty-state">
          <div className="empty-icon">🧩</div>
          <div className="empty-message">
            <strong>No Learned Patterns Found</strong>
            <p>As you use the system, the AI will learn patterns from your queries and preferences.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="learned-patterns-view">
      <div className="patterns-header">
        <h4>Learned Patterns ({filteredPatterns.length})</h4>
        <div className="filter-controls">
          <label>Filter by type:</label>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value={PatternType.QUERY_TEMPLATE}>Query Templates</option>
            <option value={PatternType.USER_PREFERENCE}>User Preferences</option>
            <option value={PatternType.SCHEMA_USAGE}>Schema Usage</option>
            <option value={PatternType.QUERY_SIMILARITY}>Query Similarity</option>
            <option value={PatternType.SUCCESS_PATTERN}>Success Patterns</option>
          </select>
        </div>
      </div>

      <div className="patterns-list">
        {sortedPatterns.map((pattern) => {
          const isSelected = selectedPattern?.id === pattern.id;
          
          return (
            <div 
              key={pattern.id || `${pattern.pattern_type}-${pattern.created_at}`} 
              className={`pattern-item ${isSelected ? 'selected' : ''}`}
              onClick={() => handlePatternClick(pattern)}
            >
              <div className="pattern-header">
                <div className="pattern-info">
                  <span className="pattern-icon">
                    {getPatternIcon(pattern.pattern_type)}
                  </span>
                  <span className="pattern-type">
                    {getPatternTypeName(pattern.pattern_type)}
                  </span>
                  <span className={`confidence-badge ${getConfidenceColor(pattern.confidence)}`}>
                    {(pattern.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="pattern-stats">
                  <span className="usage-count" title="Usage count">
                    🔄 {pattern.usage_count}
                  </span>
                  <span className="last-used" title="Last used">
                    🕒 {formatTimestamp(pattern.last_used)}
                  </span>
                </div>
              </div>

              <div className="pattern-preview">
                {pattern.pattern_type === PatternType.QUERY_TEMPLATE && (
                  <div className="template-preview">
                    <strong>Template:</strong> {pattern.pattern_data.template || 'No template'}
                  </div>
                )}
                
                {pattern.pattern_type === PatternType.USER_PREFERENCE && (
                  <div className="preference-preview">
                    <strong>Preferences:</strong>
                    {Object.entries(pattern.pattern_data).slice(0, 3).map(([key, value]) => (
                      <span key={key} className="preference-item">
                        {key}: {String(value)}
                      </span>
                    ))}
                  </div>
                )}
                
                {pattern.pattern_type === PatternType.SCHEMA_USAGE && (
                  <div className="schema-preview">
                    <strong>Tables:</strong> {pattern.pattern_data.tables_used?.join(', ') || 'None'}
                  </div>
                )}
                
                {pattern.pattern_type === PatternType.SUCCESS_PATTERN && (
                  <div className="success-preview">
                    <strong>Success factors:</strong> 
                    Query length: {pattern.pattern_data.query_length}, 
                    Keywords: {pattern.pattern_data.keyword_count}
                  </div>
                )}
              </div>

              {isSelected && (
                <div className="pattern-details">
                  <div className="pattern-data">
                    <h5>Pattern Data:</h5>
                    <pre className="pattern-json">
                      {JSON.stringify(pattern.pattern_data, null, 2)}
                    </pre>
                  </div>
                  
                  <div className="pattern-metadata">
                    <h5>Metadata:</h5>
                    <div className="metadata-grid">
                      <div className="metadata-item">
                        <span className="label">Created:</span>
                        <span className="value">{formatTimestamp(pattern.created_at)}</span>
                      </div>
                      <div className="metadata-item">
                        <span className="label">Last Used:</span>
                        <span className="value">{formatTimestamp(pattern.last_used)}</span>
                      </div>
                      <div className="metadata-item">
                        <span className="label">Usage Count:</span>
                        <span className="value">{pattern.usage_count}</span>
                      </div>
                      <div className="metadata-item">
                        <span className="label">Confidence:</span>
                        <span className="value">{(pattern.confidence * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    
                    {pattern.metadata && Object.keys(pattern.metadata).length > 0 && (
                      <div className="additional-metadata">
                        <h6>Additional Information:</h6>
                        <pre className="metadata-json">
                          {JSON.stringify(pattern.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
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

export default LearnedPatternsView;
