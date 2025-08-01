import React, { useState, useCallback, useEffect } from 'react';
import { WindowFrame } from '../Shell/WindowFrame';
import { Button } from '../UI/Button';
import { SQLEditor } from '../SQLEditor';
import { ConnectionManager } from '../Database';
import { ResultsGrid } from './ResultsGrid';
import AIQueryGenerator from '../AI/AIQueryGenerator';
import { AIActionsPanel, AnalysisResultPanel } from '../AI';
import { TemplateLibrary } from '../Templates';
import { useConnectionManager } from '../Database/hooks/useConnectionManager';
import { useQueryExecution } from './hooks/useQueryExecution';
import type { DatabaseConnection } from '../Database/types';
import type { SQLDialect } from '../SQLEditor/types';
import './SQLAnalystApp.css';

interface SQLAnalystAppProps {
  onClose?: () => void;
  isVisible?: boolean;
}

export const SQLAnalystApp: React.FC<SQLAnalystAppProps> = ({
  onClose,
  isVisible = true,
}) => {
  const [activeConnection, setActiveConnection] = useState<DatabaseConnection | null>(null);
  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [sqlContent, setSqlContent] = useState('-- Welcome to SQL Analyst\n-- Connect to a database to get started\n\nSELECT 1 as hello_world;');

  const {
    connections,
    isLoading: connectionsLoading,
    error: connectionError,
    loadConnections,
  } = useConnectionManager();

  const {
    executionState,
    executeQuery,
    cancelQuery,
    retryLastQuery,
  } = useQueryExecution();

  // Load connections on mount
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Auto-select first connection if available
  useEffect(() => {
    if (connections.length > 0 && !activeConnection) {
      setActiveConnection(connections[0]);
    }
  }, [connections, activeConnection]);

  const handleConnectionSelect = useCallback((connection: DatabaseConnection) => {
    setActiveConnection(connection);
    setShowConnectionManager(false);
  }, []);

  const handleInsertText = useCallback((text: string) => {
    // Insert text at current cursor position or append to end
    setSqlContent(prev => {
      // For now, just append the text with a space
      // In a more sophisticated implementation, we would track cursor position
      const trimmedPrev = prev.trim();
      if (trimmedPrev.length === 0) {
        return text;
      }

      // Check if we need to add a space or newline
      const lastChar = trimmedPrev[trimmedPrev.length - 1];
      const needsSpace = lastChar !== ' ' && lastChar !== '\n' && lastChar !== '\t';

      return trimmedPrev + (needsSpace ? ' ' : '') + text;
    });
  }, []);

  const handleShowConnectionManager = useCallback(() => {
    setShowConnectionManager(true);
  }, []);

  const handleCloseConnectionManager = useCallback(() => {
    setShowConnectionManager(false);
  }, []);

  const handleToggleAIPanel = useCallback(() => {
    setShowAIPanel(prev => !prev);
  }, []);

  const handleQueryGenerated = useCallback((sql: string, explanation?: string) => {
    // Insert generated SQL into the editor
    setSqlContent(sql);

    // Optionally show explanation in console or notification
    if (explanation) {
      console.log('AI Explanation:', explanation);
    }

    // Close AI panel after successful generation
    setShowAIPanel(false);
  }, []);

  const handleAIError = useCallback((error: string) => {
    console.error('AI Generation Error:', error);
    // Could show a toast notification here
  }, []);

  // Story 3.6: AI Analysis handlers
  const handleAnalysisComplete = useCallback((result: any) => {
    setAnalysisResult(result);
    setShowAnalysisPanel(true);
    console.log('Analysis completed:', result);
  }, []);

  const handleAnalysisError = useCallback((error: string) => {
    console.error('AI Analysis Error:', error);
    // Could show a toast notification here
  }, []);

  // Story 3.7: Template Library handlers
  const handleTemplateLoad = useCallback((template: any, content: string) => {
    setSqlContent(content);
    setShowTemplateLibrary(false);
  }, []);

  const handleSaveAsTemplate = useCallback(() => {
    if (!sqlContent.trim()) {
      alert('Please enter a SQL query to save as template.');
      return;
    }
    setShowTemplateLibrary(true);
  }, [sqlContent]);

  const handleQueryReplace = useCallback((newQuery: string) => {
    setSqlContent(newQuery);
    setShowAnalysisPanel(false);
  }, []);

  const handleApplyFix = useCallback((fix: any) => {
    // Apply the quick fix to the SQL content
    const updatedSQL = sqlContent.replace(fix.original_text, fix.replacement_text);
    setSqlContent(updatedSQL);
    console.log('Applied fix:', fix);
  }, [sqlContent]);

  const handleCloseAnalysisPanel = useCallback(() => {
    setShowAnalysisPanel(false);
    setAnalysisResult(null);
  }, []);

  const handleExecuteQuery = useCallback(async (query: string) => {
    if (!activeConnection) {
      // Enhanced user feedback with better UX
      const errorMessage = 'No database connection available. Please connect to a database first.';
      console.warn(errorMessage);

      // Create a more user-friendly notification instead of alert
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ffebee;
        border: 1px solid #f44336;
        color: #d32f2f;
        padding: 12px 16px;
        border-radius: 4px;
        font-family: 'Tahoma', sans-serif;
        font-size: 11px;
        z-index: 10000;
        box-shadow: 2px 2px 4px rgba(0,0,0,0.2);
      `;
      notification.textContent = errorMessage;
      document.body.appendChild(notification);

      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
      return;
    }

    // Enhanced query validation
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      console.warn('Empty query provided');
      return;
    }

    // Basic SQL injection prevention check (for demo purposes)
    const suspiciousPatterns = [
      /;\s*drop\s+table/i,
      /;\s*delete\s+from/i,
      /;\s*truncate/i,
    ];

    const hasSuspiciousContent = suspiciousPatterns.some(pattern => pattern.test(trimmedQuery));
    if (hasSuspiciousContent) {
      console.warn('Query contains potentially dangerous patterns');
    }

    // Execute query using the hook
    try {
      await executeQuery(trimmedQuery, activeConnection.id, {
        timeout: 300000, // 5 minutes
        enableProgress: true,
        enableCancellation: true,
      });
    } catch (error) {
      console.error('Query execution failed:', error);
    }
  }, [activeConnection, executeQuery]);

  const getDialectFromConnection = (connection: DatabaseConnection | null): SQLDialect => {
    if (!connection) return 'postgresql';
    
    switch (connection.database_type) {
      case 'PostgreSQL':
        return 'postgresql';
      case 'MySQL':
        return 'mysql';
      case 'SQLite':
        return 'sqlite';
      case 'SqlServer':
        return 'mssql';
      case 'Oracle':
        return 'oracle';
      default:
        return 'postgresql';
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <WindowFrame
      title="SQL Analyst"
      onClose={onClose}
      width={1200}
      height={800}
      resizable={true}
      className="sql-analyst-app"
    >
      <div className="sql-analyst-container">
        {/* Toolbar */}
        <div className="sql-analyst-toolbar">
          <div className="toolbar-section">
            <div className="connection-info">
              {activeConnection ? (
                <div className="active-connection">
                  <span className="connection-icon">🔗</span>
                  <span className="connection-name">{activeConnection.name}</span>
                  <span className="connection-type">({activeConnection.database_type})</span>
                </div>
              ) : (
                <div className="no-connection">
                  <span className="connection-icon">❌</span>
                  <span className="connection-text">No Connection</span>
                </div>
              )}
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={handleShowConnectionManager}
              disabled={connectionsLoading}
              icon="🔧"
            >
              Manage Connections
            </Button>
          </div>

          <div className="toolbar-section">
            <Button
              variant="primary"
              size="small"
              onClick={() => handleExecuteQuery(sqlContent)}
              disabled={!activeConnection || connectionsLoading}
              icon="▶️"
            >
              Execute Query
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setSqlContent('')}
              icon="🗑️"
            >
              Clear
            </Button>
            <Button
              variant={showAIPanel ? "primary" : "secondary"}
              size="small"
              onClick={handleToggleAIPanel}
              disabled={!activeConnection || connectionsLoading}
              icon="🤖"
            >
              AI Assistant
            </Button>
            <Button
              variant={showTemplateLibrary ? "primary" : "secondary"}
              size="small"
              onClick={() => setShowTemplateLibrary(!showTemplateLibrary)}
              icon="📄"
            >
              Templates
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={handleSaveAsTemplate}
              disabled={!sqlContent.trim()}
              icon="💾"
            >
              Save as Template
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {connectionError && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{connectionError}</span>
          </div>
        )}

        {/* AI Query Generator Panel */}
        {showAIPanel && (
          <div className="ai-panel">
            <AIQueryGenerator
              activeConnectionId={activeConnection?.id}
              schemaContext={null} // TODO: Pass schema context from schema explorer
              onQueryGenerated={handleQueryGenerated}
              onError={handleAIError}
              className="sql-analyst-ai-generator"
            />
          </div>
        )}

        {/* AI Actions Panel - Story 3.6 */}
        <div className="ai-actions-container">
          <AIActionsPanel
            sqlContent={sqlContent}
            activeConnectionId={activeConnection?.id}
            schemaContext={null} // TODO: Pass schema context from schema explorer
            onAnalysisComplete={handleAnalysisComplete}
            onError={handleAnalysisError}
            className="sql-analyst-ai-actions"
          />
        </div>

        {/* Analysis Results Panel - Story 3.6 */}
        {showAnalysisPanel && analysisResult && (
          <div className="analysis-results-container">
            <AnalysisResultPanel
              result={analysisResult}
              onQueryReplace={handleQueryReplace}
              onApplyFix={handleApplyFix}
              onClose={handleCloseAnalysisPanel}
              className="sql-analyst-analysis-results"
            />
          </div>
        )}

        {/* Template Library - Story 3.7 */}
        {showTemplateLibrary && (
          <div className="template-library-modal">
            <TemplateLibrary
              isVisible={showTemplateLibrary}
              onClose={() => setShowTemplateLibrary(false)}
              onTemplateLoad={handleTemplateLoad}
            />
          </div>
        )}

        {/* Main Content Area */}
        <div className="sql-analyst-content">
          {/* Main Panels */}
          <div className="main-panels">
            {/* SQL Editor */}
            <div className="editor-panel">
              <div className="panel-header">
                <h3>Query Editor</h3>
                <div className="editor-info">
                  <span className="dialect-info">
                    Dialect: {getDialectFromConnection(activeConnection)}
                  </span>
                </div>
              </div>
              <div className="editor-container">
                <SQLEditor
                  value={sqlContent}
                  onChange={setSqlContent}
                  dialect={getDialectFromConnection(activeConnection)}
                  connectionId={activeConnection?.id}
                  theme="xp"
                  showLineNumbers={true}
                  showFoldGutter={true}
                  enableAutoCompletion={true}
                  enableSyntaxValidation={true}
                  highlightActive={true}
                  highlightMatches={true}
                  searchEnabled={true}
                  readOnly={false}
                  placeholder="-- Enter your SQL query here..."
                  onExecute={handleExecuteQuery}
                  className="main-sql-editor"
                />
              </div>
            </div>

            {/* Results Panel */}
            <div className="results-panel">
              <ResultsGrid
                queryResults={executionState.currentExecution?.result || null}
                isLoading={executionState.isExecuting}
                error={executionState.currentExecution?.error || null}
                onCancelQuery={cancelQuery}
                onRetryQuery={retryLastQuery}
              />
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="sql-analyst-status">
          <div className="status-left">
            <span className="status-item">
              Lines: {sqlContent.split('\n').length}
            </span>
            <span className="status-item">
              Characters: {sqlContent.length}
            </span>
          </div>
          <div className="status-right">
            {activeConnection && (
              <span className="status-item connection-status">
                Connected to {activeConnection.database}
              </span>
            )}
            <span className="status-item">
              Ready
            </span>
          </div>
        </div>

        {/* Connection Manager Modal */}
        {showConnectionManager && (
          <div className="connection-manager-overlay">
            <div className="connection-manager-modal">
              <ConnectionManager
                onClose={handleCloseConnectionManager}
                isVisible={true}
              />
              <div className="connection-selector">
                <h4>Select Active Connection</h4>
                <div className="connection-list">
                  {connections.map((connection) => (
                    <div
                      key={connection.id}
                      className={`connection-item ${
                        activeConnection?.id === connection.id ? 'active' : ''
                      }`}
                      onClick={() => handleConnectionSelect(connection)}
                    >
                      <span className="connection-name">{connection.name}</span>
                      <span className="connection-type">{connection.database_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </WindowFrame>
  );
};
