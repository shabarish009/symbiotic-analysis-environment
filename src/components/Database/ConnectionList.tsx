import React from 'react';
import { Button } from '../UI/Button';
import type { DatabaseConnection, ConnectionStatus } from './types';
import './ConnectionList.css';

interface ConnectionListProps {
  connections: DatabaseConnection[];
  selectedConnection: string | null;
  onSelect: (connectionId: string | null) => void;
  onEdit: (connection: DatabaseConnection) => void;
  onDelete: (connectionId: string) => void;
  onTest: (connectionId: string) => void;
  isLoading?: boolean;
}

export const ConnectionList: React.FC<ConnectionListProps> = ({
  connections,
  selectedConnection,
  onSelect,
  onEdit,
  onDelete,
  onTest,
  isLoading = false,
}) => {
  const getStatusIcon = (status: ConnectionStatus): string => {
    if (typeof status === 'string') {
      switch (status) {
        case 'Connected':
          return '🟢';
        case 'Connecting':
        case 'Testing':
          return '🟡';
        case 'Disconnected':
          return '🔴';
        default:
          return '⚪';
      }
    } else if (status && typeof status === 'object' && 'Error' in status) {
      return '❌';
    }
    return '⚪';
  };

  const getStatusText = (status: ConnectionStatus): string => {
    if (typeof status === 'string') {
      return status;
    } else if (status && typeof status === 'object' && 'Error' in status) {
      return `Error: ${status.Error}`;
    }
    return 'Unknown';
  };

  const getDatabaseTypeIcon = (type: string): string => {
    switch (type) {
      case 'PostgreSQL':
        return '🐘';
      case 'MySQL':
        return '🐬';
      case 'SQLite':
        return '📁';
      case 'SqlServer':
        return '🏢';
      case 'Oracle':
        return '🏛️';
      default:
        return '💾';
    }
  };

  if (connections.length === 0) {
    return (
      <div className="connection-list-empty">
        <div className="empty-state">
          <div className="empty-icon">💾</div>
          <h3>No Database Connections</h3>
          <p>Get started by adding your first database connection.</p>
          <p>Your credentials will be securely stored in your system's keychain.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="connection-list">
      <div className="connection-list-header">
        <div className="list-title">
          <h3>Connections ({connections.length})</h3>
        </div>
        <div className="list-legend">
          <span className="legend-item">
            <span className="legend-icon">🟢</span>
            Connected
          </span>
          <span className="legend-item">
            <span className="legend-icon">🟡</span>
            Testing
          </span>
          <span className="legend-item">
            <span className="legend-icon">🔴</span>
            Disconnected
          </span>
          <span className="legend-item">
            <span className="legend-icon">❌</span>
            Error
          </span>
        </div>
      </div>

      <div className="connection-grid">
        {connections.map((connection) => (
          <div
            key={connection.id}
            className={`connection-card ${
              selectedConnection === connection.id ? 'selected' : ''
            }`}
            onClick={() => onSelect(connection.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(connection.id);
              }
            }}
          >
            <div className="connection-header">
              <div className="connection-info">
                <div className="connection-name">
                  <span className="db-type-icon">
                    {getDatabaseTypeIcon(connection.database_type)}
                  </span>
                  <span className="name-text">{connection.name}</span>
                </div>
                <div className="connection-details">
                  <span className="db-type">{connection.database_type}</span>
                  <span className="connection-host">
                    {connection.host}
                    {connection.port > 0 && `:${connection.port}`}
                  </span>
                </div>
              </div>
              <div className="connection-status">
                <span className="status-icon">
                  {getStatusIcon('Disconnected' as ConnectionStatus)}
                </span>
                <span className="status-text">
                  {getStatusText('Disconnected' as ConnectionStatus)}
                </span>
              </div>
            </div>

            <div className="connection-meta">
              <div className="meta-item">
                <span className="meta-label">Database:</span>
                <span className="meta-value">{connection.database}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">User:</span>
                <span className="meta-value">{connection.username}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">SSL:</span>
                <span className="meta-value">
                  {connection.ssl_enabled ? '✅ Enabled' : '❌ Disabled'}
                </span>
              </div>
            </div>

            <div className="connection-actions">
              <Button
                variant="secondary"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onTest(connection.id);
                }}
                disabled={isLoading}
                icon="🔍"
              >
                Test
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(connection);
                }}
                disabled={isLoading}
                icon="✏️"
              >
                Edit
              </Button>
              <Button
                variant="danger"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(connection.id);
                }}
                disabled={isLoading}
                icon="🗑️"
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
