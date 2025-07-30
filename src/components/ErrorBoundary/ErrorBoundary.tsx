/**
 * XP-styled Error Boundary Component
 * Provides graceful error handling with authentic XP error dialog styling
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Dialog } from '../UI/Dialog';
import { Button } from '../UI/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClose = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Dialog
          isOpen={true}
          title="Application Error"
          onClose={this.handleClose}
          data-testid="error-boundary-dialog"
        >
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ marginBottom: '16px' }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle
                  cx="16"
                  cy="16"
                  r="15"
                  fill="#FF6B6B"
                  stroke="#CC0000"
                  strokeWidth="2"
                />
                <path
                  d="M16 8v8M16 20h.01"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '12px' }}>
              An unexpected error has occurred
            </h3>
            <p
              style={{
                margin: '0 0 16px 0',
                fontSize: '10.67px',
                color: '#666',
              }}
            >
              The application encountered an error and needs to be restarted.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{ textAlign: 'left', marginBottom: '16px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '10.67px' }}>
                  Error Details
                </summary>
                <pre
                  style={{
                    fontSize: '9px',
                    background: '#f5f5f5',
                    padding: '8px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontFamily: 'Lucida Console, monospace',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div
              style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}
            >
              <Button onClick={this.handleReload} variant="primary">
                Restart Application
              </Button>
              <Button onClick={this.handleClose}>Continue</Button>
            </div>
          </div>
        </Dialog>
      );
    }

    return this.props.children;
  }
}
