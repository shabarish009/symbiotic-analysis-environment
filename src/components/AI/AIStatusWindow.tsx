/**
 * AI Status Window Component
 * Displays real-time AI engine status with XP styling
 */

import React, { useEffect, useState } from 'react';
import { Dialog } from '../UI/Dialog/Dialog';
import { Button } from '../UI/Button/Button';
import { ThoughtProcessPanel } from './ThoughtProcess/ThoughtProcessPanel';
import { QueryData, ThoughtProcess } from '../../types/thoughtProcess';
import { invoke } from '@tauri-apps/api/tauri';
import './AIStatusWindow.css';

export interface AIEngineStatus {
  status: 'starting' | 'ready' | 'error' | 'stopped' | 'restarting';
  message?: string;
  timestamp?: number;
}

export interface AIStatusWindowProps {
  isOpen: boolean;
  status: AIEngineStatus;
  onRetry?: () => void;
  onClose?: () => void;
  onStartEngine?: () => void;
  onStopEngine?: () => void;
  // Thought process props
  currentQuery?: QueryData;
  thoughtProcess?: ThoughtProcess;
  thoughtProcessVisible?: boolean;
  onToggleThoughtProcess?: () => void;
}

export const AIStatusWindow: React.FC<AIStatusWindowProps> = ({
  isOpen,
  status,
  onRetry,
  onClose,
  onStartEngine,
  onStopEngine,
  currentQuery,
  thoughtProcess,
  thoughtProcessVisible = false,
  onToggleThoughtProcess,
}) => {
  const [dots, setDots] = useState('');

  // Animate loading dots for starting/restarting states
  useEffect(() => {
    if (status.status === 'starting' || status.status === 'restarting') {
      const interval = setInterval(() => {
        setDots(prev => {
          if (prev.length >= 3) return '';
          return prev + '.';
        });
      }, 500);

      return () => clearInterval(interval);
    } else {
      setDots('');
    }
  }, [status.status]);

  const getStatusIcon = () => {
    switch (status.status) {
      case 'starting':
      case 'restarting':
        return (
          <div className="ai-status-icon ai-status-icon--loading">
            <div className="ai-status-spinner" />
          </div>
        );
      case 'ready':
        return (
          <div className="ai-status-icon ai-status-icon--ready">
            ✓
          </div>
        );
      case 'error':
        return (
          <div className="ai-status-icon ai-status-icon--error">
            ✗
          </div>
        );
      case 'stopped':
        return (
          <div className="ai-status-icon ai-status-icon--stopped">
            ⏸
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'starting':
        return `Starting AI Engine${dots}`;
      case 'ready':
        return 'AI Engine Ready';
      case 'error':
        return 'AI Engine Error';
      case 'stopped':
        return 'AI Engine Stopped';
      case 'restarting':
        return `Restarting AI Engine${dots}`;
      default:
        return 'Unknown Status';
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'starting':
      case 'restarting':
        return '#0066cc';
      case 'ready':
        return '#008000';
      case 'error':
        return '#cc0000';
      case 'stopped':
        return '#808080';
      default:
        return '#000000';
    }
  };

  const shouldShowWindow = isOpen && status.status !== 'ready';

  return (
    <Dialog
      isOpen={shouldShowWindow}
      title="AI Engine Status"
      onClose={onClose}
      className="ai-status-window"
      data-testid="ai-status-window"
    >
      <div className="ai-status-content">
        <div className="ai-status-header">
          {getStatusIcon()}
          <div className="ai-status-text">
            <h3 style={{ color: getStatusColor() }}>
              {getStatusText()}
            </h3>
            {status.message && (
              <p className="ai-status-message">
                {status.message}
              </p>
            )}
            {status.timestamp && (
              <p className="ai-status-timestamp">
                Last updated: {new Date(status.timestamp * 1000).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <div className="ai-status-actions">
          {status.status === 'error' && onRetry && (
            <Button
              variant="primary"
              onClick={onRetry}
              data-testid="ai-status-retry-button"
            >
              Retry
            </Button>
          )}
          
          {status.status === 'stopped' && onStartEngine && (
            <Button
              variant="primary"
              onClick={onStartEngine}
              data-testid="ai-status-start-button"
            >
              Start AI Engine
            </Button>
          )}
          
          {(status.status === 'ready' || status.status === 'error') && onStopEngine && (
            <Button
              variant="secondary"
              onClick={onStopEngine}
              data-testid="ai-status-stop-button"
            >
              Stop AI Engine
            </Button>
          )}
          
          {onClose && (
            <Button
              variant="secondary"
              onClick={onClose}
              data-testid="ai-status-close-button"
            >
              Close
            </Button>
          )}
        </div>

        {/* Thought Process Panel - Show when AI is ready or processing */}
        {(status.status === 'ready' || currentQuery || thoughtProcess) && onToggleThoughtProcess && (
          <ThoughtProcessPanel
            isVisible={thoughtProcessVisible}
            onToggleVisibility={onToggleThoughtProcess}
            currentQuery={currentQuery}
            thoughtProcess={thoughtProcess}
          />
        )}
      </div>
    </Dialog>
  );
};

// Hook for managing AI engine status
export const useAIEngineStatus = () => {
  const [status, setStatus] = useState<AIEngineStatus>({
    status: 'stopped'
  });
  const [isLoading, setIsLoading] = useState(false);

  const startEngine = async () => {
    if (isLoading) {
      console.warn('AI Engine start already in progress');
      return;
    }

    setIsLoading(true);
    setStatus({ status: 'starting', message: 'Initializing AI engine...' });

    try {
      // Call Tauri command to start AI engine
      const result = await invoke('start_ai_engine') as string;
      console.log('AI Engine started:', result);

      // Poll for status updates
      pollStatus();
    } catch (error) {
      console.error('Failed to start AI engine:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus({
        status: 'error',
        message: `Failed to start: ${errorMessage}`,
        timestamp: Date.now() / 1000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopEngine = async () => {
    if (isLoading) {
      console.warn('AI Engine operation already in progress');
      return;
    }

    setIsLoading(true);

    try {
      const result = await invoke('stop_ai_engine') as string;
      console.log('AI Engine stopped:', result);

      setStatus({
        status: 'stopped',
        message: 'AI engine stopped',
        timestamp: Date.now() / 1000
      });
    } catch (error) {
      console.error('Failed to stop AI engine:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus({
        status: 'error',
        message: `Failed to stop: ${errorMessage}`,
        timestamp: Date.now() / 1000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const pollStatus = async () => {
    try {
      const statusJson = await invoke('get_ai_engine_status') as string;
      const engineStatus = JSON.parse(statusJson);
      
      setStatus({
        status: engineStatus.toLowerCase(),
        timestamp: Date.now() / 1000
      });
      
      // Continue polling if not in a final state
      if (!['ready', 'stopped', 'error'].includes(engineStatus.toLowerCase())) {
        setTimeout(pollStatus, 1000);
      }
    } catch (error) {
      console.error('Failed to get AI engine status:', error);
      setStatus({
        status: 'error',
        message: `Status check failed: ${error}`,
        timestamp: Date.now() / 1000
      });
    }
  };

  const retryStart = () => {
    startEngine();
  };

  return {
    status,
    isLoading,
    startEngine,
    stopEngine,
    retryStart,
  };
};
