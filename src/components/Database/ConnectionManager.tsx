import React from 'react';
import { WindowFrame } from '../Shell/WindowFrame';
import { Button } from '../UI/Button';
import { ConnectionList } from './ConnectionList';
import { ConnectionForm } from './ConnectionForm';
import { ConnectionTestDialog } from './ConnectionTestDialog';
import { useConnectionManager } from './hooks/useConnectionManager';
import './ConnectionManager.css';

interface ConnectionManagerProps {
  onClose?: () => void;
  isVisible?: boolean;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  onClose,
  isVisible = true,
}) => {
  const {
    connections,
    selectedConnection,
    isLoading,
    error,
    showForm,
    editingConnection,
    loadConnections,
    addConnection,
    removeConnection,
    testConnection,
    showAddForm,
    showEditForm,
    hideForm,
    selectConnection,
    clearError,
  } = useConnectionManager();

  const [showTestDialog, setShowTestDialog] = React.useState(false);
  const [testingConnectionId, setTestingConnectionId] = React.useState<string | null>(null);

  const handleTestConnection = async (connectionId: string) => {
    setTestingConnectionId(connectionId);
    setShowTestDialog(true);
  };

  const handleCloseTestDialog = () => {
    setShowTestDialog(false);
    setTestingConnectionId(null);
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      await addConnection(formData);
    } catch (error) {
      // Error is handled by the hook
      console.error('Failed to add connection:', error);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (window.confirm('Are you sure you want to delete this connection? This action cannot be undone.')) {
      await removeConnection(connectionId);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <WindowFrame
      title="Database Connection Manager"
      onClose={onClose}
      width={800}
      height={600}
      resizable={true}
      className="connection-manager-window"
    >
      <div className="connection-manager">
        {/* Header */}
        <div className="connection-manager-header">
          <div className="header-title">
            <h2>Database Connections</h2>
            <p>Manage your database connections securely</p>
          </div>
          <div className="header-actions">
            <Button
              variant="primary"
              onClick={showAddForm}
              disabled={isLoading}
              icon="+"
            >
              Add Connection
            </Button>
            <Button
              variant="secondary"
              onClick={loadConnections}
              disabled={isLoading}
              icon="🔄"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-banner">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span className="error-message">{error}</span>
              <Button
                variant="text"
                onClick={clearError}
                className="error-close"
              >
                ✕
              </Button>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="loading-indicator">
            <div className="loading-spinner"></div>
            <span>Loading connections...</span>
          </div>
        )}

        {/* Main Content */}
        <div className="connection-manager-content">
          {showForm ? (
            <ConnectionForm
              connection={editingConnection}
              onSubmit={handleFormSubmit}
              onCancel={hideForm}
              isLoading={isLoading}
            />
          ) : (
            <ConnectionList
              connections={connections}
              selectedConnection={selectedConnection}
              onSelect={selectConnection}
              onEdit={showEditForm}
              onDelete={handleDeleteConnection}
              onTest={handleTestConnection}
              isLoading={isLoading}
            />
          )}
        </div>

        {/* Status Bar */}
        <div className="connection-manager-status">
          <div className="status-info">
            <span className="connection-count">
              {connections.length} connection{connections.length !== 1 ? 's' : ''}
            </span>
            {selectedConnection && (
              <span className="selected-connection">
                Selected: {connections.find(c => c.id === selectedConnection)?.name}
              </span>
            )}
          </div>
          <div className="security-indicator">
            <span className="security-icon">🔒</span>
            <span className="security-text">Credentials secured in OS Keychain</span>
          </div>
        </div>

        {/* Test Connection Dialog */}
        {showTestDialog && testingConnectionId && (
          <ConnectionTestDialog
            connectionId={testingConnectionId}
            onClose={handleCloseTestDialog}
            testConnection={testConnection}
          />
        )}
      </div>
    </WindowFrame>
  );
};
