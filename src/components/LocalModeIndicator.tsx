import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './LocalModeIndicator.css';

interface LocalModeStatus {
  mode: 'local' | 'cloud' | 'error';
  local_available: boolean;
  privacy_guaranteed: boolean;
  cost_free: boolean;
  active_local_model?: string;
  fallback_enabled: boolean;
  system_health: string;
}

interface LocalModeIndicatorProps {
  className?: string;
  showDetails?: boolean;
  onModeChange?: (mode: 'local' | 'cloud') => void;
}

const LocalModeIndicator: React.FC<LocalModeIndicatorProps> = ({
  className = '',
  showDetails = false,
  onModeChange
}) => {
  const [status, setStatus] = useState<LocalModeStatus>({
    mode: 'cloud',
    local_available: false,
    privacy_guaranteed: false,
    cost_free: false,
    fallback_enabled: true,
    system_health: 'unknown'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    fetchStatus();
    
    // Set up periodic status updates
    const interval = setInterval(fetchStatus, 10000); // Update every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      setError(null);
      
      const response = await invoke('ai_engine_request', {
        method: 'local_llm.get_processing_mode',
        params: {}
      });

      if (response.success) {
        setStatus(response.data);
      } else {
        setError(response.error || 'Failed to get local mode status');
      }
    } catch (err) {
      console.error('Error fetching local mode status:', err);
      setError('Network error: Unable to fetch status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeToggle = async () => {
    if (!status.local_available && status.mode === 'cloud') {
      setError('Local mode not available - no models loaded');
      return;
    }

    try {
      setIsLoading(true);
      const newMode = status.mode === 'local' ? 'cloud' : 'local';
      
      const response = await invoke('ai_engine_request', {
        method: `local_llm.switch_to_${newMode}_mode`,
        params: {}
      });

      if (response.success) {
        await fetchStatus(); // Refresh status
        onModeChange?.(newMode);
      } else {
        setError(response.error || `Failed to switch to ${newMode} mode`);
      }
    } catch (err) {
      console.error('Error switching mode:', err);
      setError('Failed to switch processing mode');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (isLoading) return '⏳';
    if (error) return '⚠️';
    
    switch (status.mode) {
      case 'local':
        return status.privacy_guaranteed ? '🔒' : '🏠';
      case 'cloud':
        return '☁️';
      default:
        return '❓';
    }
  };

  const getStatusText = () => {
    if (isLoading) return 'Checking...';
    if (error) return 'Error';
    
    switch (status.mode) {
      case 'local':
        return 'Local Mode';
      case 'cloud':
        return 'Cloud Mode';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    if (isLoading) return 'status-loading';
    if (error) return 'status-error';
    
    switch (status.mode) {
      case 'local':
        return status.privacy_guaranteed ? 'status-local-secure' : 'status-local';
      case 'cloud':
        return 'status-cloud';
      default:
        return 'status-unknown';
    }
  };

  const getTooltipContent = () => {
    if (error) {
      return `Error: ${error}`;
    }

    const lines = [
      `Mode: ${status.mode.toUpperCase()}`,
      `Privacy: ${status.privacy_guaranteed ? 'Guaranteed' : 'Not Guaranteed'}`,
      `Cost: ${status.cost_free ? 'Free' : 'API Costs Apply'}`
    ];

    if (status.active_local_model) {
      lines.push(`Model: ${status.active_local_model}`);
    }

    if (status.fallback_enabled) {
      lines.push('Fallback: Enabled');
    }

    return lines.join('\n');
  };

  return (
    <div className={`local-mode-indicator ${className}`}>
      <div 
        className={`mode-status ${getStatusColor()}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={handleModeToggle}
        role="button"
        tabIndex={0}
        aria-label={`Current mode: ${getStatusText()}. Click to toggle.`}
        title={getTooltipContent()}
      >
        <span className="status-icon" aria-hidden="true">
          {getStatusIcon()}
        </span>
        <span className="status-text">
          {getStatusText()}
        </span>
        
        {status.privacy_guaranteed && (
          <span className="privacy-badge" aria-label="Privacy guaranteed">
            🛡️
          </span>
        )}
        
        {status.cost_free && (
          <span className="cost-free-badge" aria-label="Cost free">
            💰
          </span>
        )}
      </div>

      {showDetails && (
        <div className="mode-details">
          <div className="detail-row">
            <span className="detail-label">Processing:</span>
            <span className="detail-value">{status.mode}</span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Privacy:</span>
            <span className={`detail-value ${status.privacy_guaranteed ? 'positive' : 'negative'}`}>
              {status.privacy_guaranteed ? 'Guaranteed' : 'Not Guaranteed'}
            </span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Cost:</span>
            <span className={`detail-value ${status.cost_free ? 'positive' : 'negative'}`}>
              {status.cost_free ? 'Free' : 'API Costs'}
            </span>
          </div>
          
          {status.active_local_model && (
            <div className="detail-row">
              <span className="detail-label">Model:</span>
              <span className="detail-value">{status.active_local_model}</span>
            </div>
          )}
          
          <div className="detail-row">
            <span className="detail-label">Local Available:</span>
            <span className={`detail-value ${status.local_available ? 'positive' : 'negative'}`}>
              {status.local_available ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      )}

      {showTooltip && !showDetails && (
        <div className="mode-tooltip" role="tooltip">
          {getTooltipContent().split('\n').map((line, index) => (
            <div key={index} className="tooltip-line">{line}</div>
          ))}
        </div>
      )}

      {error && (
        <div className="error-message" role="alert">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
          <button 
            className="retry-button"
            onClick={fetchStatus}
            aria-label="Retry fetching status"
          >
            🔄
          </button>
        </div>
      )}
    </div>
  );
};

export default LocalModeIndicator;
