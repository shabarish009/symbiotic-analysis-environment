import React, { useState, useEffect } from 'react';
import { Button } from '../UI/Button';
import { Dialog } from '../UI/Dialog';
import type { ConnectionTestResult } from './types';
import './ConnectionTestDialog.css';

interface ConnectionTestDialogProps {
  connectionId: string;
  onClose: () => void;
  testConnection: (connectionId: string) => Promise<ConnectionTestResult>;
}

export const ConnectionTestDialog: React.FC<ConnectionTestDialogProps> = ({
  connectionId,
  onClose,
  testConnection,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    setIsLoading(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await testConnection(connectionId);
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-start test when dialog opens
  useEffect(() => {
    handleTest();
  }, [connectionId]);

  const formatResponseTime = (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    } else {
      return `${(ms / 1000).toFixed(2)}s`;
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <Dialog
      title="Test Database Connection"
      onClose={onClose}
      width={500}
      height={400}
      className="connection-test-dialog"
    >
      <div className="test-dialog-content">
        {/* Loading State */}
        {isLoading && (
          <div className="test-loading">
            <div className="loading-spinner"></div>
            <div className="loading-text">
              <h3>Testing Connection...</h3>
              <p>Please wait while we verify the database connection.</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="test-error">
            <div className="error-icon">❌</div>
            <div className="error-content">
              <h3>Connection Test Failed</h3>
              <p className="error-message">{error}</p>
              <div className="error-suggestions">
                <h4>Common Solutions:</h4>
                <ul>
                  <li>Verify the host and port are correct</li>
                  <li>Check that the database server is running</li>
                  <li>Ensure your credentials are valid</li>
                  <li>Confirm network connectivity</li>
                  <li>Check firewall settings</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Success/Failure Result */}
        {testResult && !isLoading && (
          <div className={`test-result ${testResult.success ? 'success' : 'failure'}`}>
            <div className="result-header">
              <div className="result-icon">
                {testResult.success ? '✅' : '❌'}
              </div>
              <div className="result-title">
                <h3>
                  {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
                </h3>
                <p className="result-message">{testResult.message}</p>
              </div>
            </div>

            <div className="result-details">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Response Time:</span>
                  <span className="detail-value">
                    {formatResponseTime(testResult.response_time_ms)}
                  </span>
                </div>
                
                <div className="detail-item">
                  <span className="detail-label">Timestamp:</span>
                  <span className="detail-value">
                    {formatTimestamp(testResult.timestamp)}
                  </span>
                </div>

                {testResult.server_version && (
                  <div className="detail-item">
                    <span className="detail-label">Server Version:</span>
                    <span className="detail-value server-version">
                      {testResult.server_version}
                    </span>
                  </div>
                )}
              </div>

              {testResult.success && (
                <div className="success-info">
                  <div className="info-icon">ℹ️</div>
                  <div className="info-text">
                    The connection has been verified successfully. You can now use this 
                    connection to query your database.
                  </div>
                </div>
              )}

              {!testResult.success && (
                <div className="failure-info">
                  <div className="info-icon">⚠️</div>
                  <div className="info-text">
                    The connection test failed. Please check your connection settings 
                    and try again.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dialog Actions */}
        <div className="test-dialog-actions">
          {!isLoading && (
            <Button
              variant="secondary"
              onClick={handleTest}
              icon="🔄"
            >
              Test Again
            </Button>
          )}
          <Button
            variant="primary"
            onClick={onClose}
            disabled={isLoading}
          >
            {isLoading ? 'Testing...' : 'Close'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
