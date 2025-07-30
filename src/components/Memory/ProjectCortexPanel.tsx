/**
 * Project Cortex Panel
 * Main UI component for displaying AI memory system information
 */

import React, { useState, useEffect } from 'react';
import { useMemory } from '../../hooks/useMemory';
import { ProjectCortexPanelProps } from '../../types/memory';
import SchemaExplorer from './SchemaExplorer';
import QueryHistoryView from './QueryHistoryView';
import LearnedPatternsView from './LearnedPatternsView';
import MemoryInsights from './MemoryInsights';
import './ProjectCortexPanel.css';

const ProjectCortexPanel: React.FC<ProjectCortexPanelProps> = ({
  projectId,
  isVisible,
  onToggleVisibility,
  config
}) => {
  const [activeTab, setActiveTab] = useState<'schemas' | 'history' | 'patterns' | 'insights'>('schemas');
  const {
    context,
    stats,
    history,
    suggestions,
    loading,
    error,
    getStats,
    getHistory,
    getSuggestions
  } = useMemory(projectId);

  // Auto-refresh data when panel becomes visible
  useEffect(() => {
    if (isVisible && projectId) {
      getStats();
      if (activeTab === 'history') {
        getHistory();
      }
    }
  }, [isVisible, projectId, activeTab, getStats, getHistory]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    
    // Load data for the selected tab
    if (tab === 'history' && history.length === 0) {
      getHistory();
    }
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="cortex-loading">
          <div className="loading-spinner"></div>
          <span>Loading memory data...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="cortex-error">
          <div className="error-icon">⚠️</div>
          <div className="error-message">
            <strong>Memory Error:</strong> {error}
          </div>
          <button 
            className="retry-button"
            onClick={() => getStats()}
          >
            Retry
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'schemas':
        return (
          <SchemaExplorer
            projectId={projectId}
            schemas={context?.relevant_schemas || []}
            onSchemaSelect={(schema) => {
              console.log('Selected schema:', schema);
            }}
          />
        );
      
      case 'history':
        return (
          <QueryHistoryView
            projectId={projectId}
            history={history}
            onQuerySelect={(query) => {
              console.log('Selected query:', query);
            }}
          />
        );
      
      case 'patterns':
        return (
          <LearnedPatternsView
            projectId={projectId}
            patterns={context?.learned_patterns || []}
            onPatternSelect={(pattern) => {
              console.log('Selected pattern:', pattern);
            }}
          />
        );
      
      case 'insights':
        return (
          <MemoryInsights
            projectId={projectId}
            stats={stats}
            context={context}
          />
        );
      
      default:
        return <div>Unknown tab</div>;
    }
  };

  return (
    <div className="project-cortex-panel">
      <div className="cortex-header">
        <div className="cortex-title">
          <span className="cortex-icon">🧠</span>
          <h3>Project Cortex</h3>
          <div className="cortex-status">
            {stats && (
              <span className={`status-indicator ${stats.health_status}`}>
                {stats.health_status === 'success' ? '●' : '⚠'}
              </span>
            )}
          </div>
        </div>
        
        <div className="cortex-stats">
          {stats && (
            <>
              <div className="stat-item">
                <span className="stat-label">Schemas:</span>
                <span className="stat-value">{stats.schema_count}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Queries:</span>
                <span className="stat-value">{stats.query_count}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Patterns:</span>
                <span className="stat-value">{stats.pattern_count}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Cache:</span>
                <span className="stat-value">{(stats.cache_hit_rate * 100).toFixed(1)}%</span>
              </div>
            </>
          )}
        </div>
        
        <button 
          className="toggle-button"
          onClick={onToggleVisibility}
          title={isVisible ? 'Hide Memory' : 'Show Memory'}
        >
          {isVisible ? '▼' : '▶'}
        </button>
      </div>
      
      {isVisible && (
        <div className="cortex-content">
          <div className="cortex-tabs">
            <button 
              className={`tab-button ${activeTab === 'schemas' ? 'active' : ''}`}
              onClick={() => handleTabChange('schemas')}
            >
              <span className="tab-icon">🗃️</span>
              Database Schemas
            </button>
            <button 
              className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => handleTabChange('history')}
            >
              <span className="tab-icon">📜</span>
              Query History
            </button>
            <button 
              className={`tab-button ${activeTab === 'patterns' ? 'active' : ''}`}
              onClick={() => handleTabChange('patterns')}
            >
              <span className="tab-icon">🧩</span>
              Learned Patterns
            </button>
            <button 
              className={`tab-button ${activeTab === 'insights' ? 'active' : ''}`}
              onClick={() => handleTabChange('insights')}
            >
              <span className="tab-icon">📊</span>
              Memory Insights
            </button>
          </div>
          
          <div className="cortex-tab-content">
            {renderTabContent()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectCortexPanel;
