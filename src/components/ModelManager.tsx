import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import './ModelManager.css';
import './ModelManager.css';

interface ModelInfo {
  name: string;
  display_name: string;
  description: string;
  model_type: string;
  file_size_mb: number;
  memory_requirement_mb: number;
  parameter_count: string;
  quality_score: number;
  recommended_for: string[];
  status: 'not_downloaded' | 'downloading' | 'downloaded' | 'loading' | 'loaded' | 'error';
  is_available?: boolean;
  error_message?: string;
}

interface DownloadProgress {
  model_name: string;
  progress_percent: number;
  download_speed_mbps: number;
  eta_seconds: number;
  status: string;
  error_message?: string;
}

interface ModelManagerProps {
  className?: string;
  onModelChange?: (modelName: string) => void;
}

const ModelManager: React.FC<ModelManagerProps> = ({
  className = '',
  onModelChange
}) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModels();
    fetchSystemStatus();
    
    // Set up periodic updates
    const interval = setInterval(() => {
      fetchModels();
      updateDownloadProgress();
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchModels = async () => {
    try {
      const response = await invoke('ai_engine_request', {
        method: 'local_llm.get_available_models',
        params: {}
      });

      if (response.success) {
        setModels(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch models');
      }
    } catch (err) {
      console.error('Error fetching models:', err);
      setError('Network error: Unable to fetch models');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const response = await invoke('ai_engine_request', {
        method: 'local_llm.get_system_status',
        params: {}
      });

      if (response.success) {
        setActiveModel(response.data.active_model);
      }
    } catch (err) {
      console.error('Error fetching system status:', err);
    }
  };

  const updateDownloadProgress = async () => {
    // Update progress for downloading models
    const downloadingModels = models.filter(m => m.status === 'downloading');
    
    for (const model of downloadingModels) {
      try {
        const response = await invoke('ai_engine_request', {
          method: 'local_llm.get_download_progress',
          params: { model_name: model.name }
        });

        if (response.success && response.data) {
          setDownloadProgress(prev => ({
            ...prev,
            [model.name]: response.data
          }));
        }
      } catch (err) {
        console.error(`Error fetching progress for ${model.name}:`, err);
      }
    }
  };

  // Input validation helper
  const validateModelName = (modelName: string): boolean => {
    if (!modelName || typeof modelName !== 'string') {
      setError('Invalid model name');
      return false;
    }

    // Check for dangerous characters
    const dangerousChars = /[<>\"'&\x00-\x1f\x7f-\x9f]/;
    if (dangerousChars.test(modelName)) {
      setError('Model name contains invalid characters');
      return false;
    }

    // Check length
    if (modelName.length > 100) {
      setError('Model name too long');
      return false;
    }

    // Check if model exists in our list
    const modelExists = models.some(m => m.name === modelName);
    if (!modelExists) {
      setError('Unknown model');
      return false;
    }

    return true;
  };

  const handleDownloadModel = async (modelName: string) => {
    try {
      setError(null);

      // Validate input
      if (!validateModelName(modelName)) {
        return;
      }

      const response = await invoke('ai_engine_request', {
        method: 'local_llm.download_model',
        params: { model_name: modelName }
      });

      if (response && response.success) {
        // Update model status
        setModels(prev => prev.map(m =>
          m.name === modelName
            ? { ...m, status: 'downloading' }
            : m
        ));
      } else {
        setError(response?.error || 'Failed to start download');
      }
    } catch (err) {
      console.error('Error downloading model:', err);
      setError('Network error: Failed to download model');
    }
  };

  const handleLoadModel = async (modelName: string) => {
    try {
      setError(null);

      // Validate input
      if (!validateModelName(modelName)) {
        return;
      }

      // Update status to loading
      setModels(prev => prev.map(m =>
        m.name === modelName
          ? { ...m, status: 'loading' }
          : m
      ));

      const response = await invoke('ai_engine_request', {
        method: 'local_llm.load_model',
        params: { model_name: modelName }
      });

      if (response && response.success) {
        setActiveModel(modelName);
        onModelChange?.(modelName);
        await fetchModels(); // Refresh to get updated status
      } else {
        setError(response?.error || 'Failed to load model');
        await fetchModels(); // Refresh to get error status
      }
    } catch (err) {
      console.error('Error loading model:', err);
      setError('Network error: Failed to load model');
      await fetchModels();
    }
  };

  const handleUnloadModel = async (modelName: string) => {
    try {
      setError(null);

      // Validate input
      if (!validateModelName(modelName)) {
        return;
      }

      const response = await invoke('ai_engine_request', {
        method: 'local_llm.unload_model',
        params: { model_name: modelName }
      });

      if (response && response.success) {
        if (activeModel === modelName) {
          setActiveModel(null);
          onModelChange?.('');
        }
        await fetchModels();
      } else {
        setError(response?.error || 'Failed to unload model');
      }
    } catch (err) {
      console.error('Error unloading model:', err);
      setError('Network error: Failed to unload model');
    }
  };

  const formatFileSize = (sizeInMB: number): string => {
    if (sizeInMB >= 1024) {
      return `${(sizeInMB / 1024).toFixed(1)} GB`;
    }
    return `${sizeInMB} MB`;
  };

  const formatETA = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m`;
    } else {
      return `${Math.round(seconds / 3600)}h`;
    }
  };

  const getModelStatusColor = (status: string): string => {
    switch (status) {
      case 'loaded': return 'status-loaded';
      case 'downloaded': return 'status-downloaded';
      case 'downloading': return 'status-downloading';
      case 'loading': return 'status-loading';
      case 'error': return 'status-error';
      default: return 'status-not-downloaded';
    }
  };

  const getActionButton = (model: ModelInfo) => {
    switch (model.status) {
      case 'not_downloaded':
        return (
          <button
            className="action-button download-button"
            onClick={() => handleDownloadModel(model.name)}
            aria-label={`Download ${model.display_name}`}
          >
            📥 Download
          </button>
        );
      
      case 'downloading':
        const progress = downloadProgress[model.name];
        return (
          <div className="download-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${progress?.progress_percent || 0}%` }}
              />
            </div>
            <div className="progress-text">
              {progress ? (
                <>
                  {Math.round(progress.progress_percent)}% 
                  ({progress.download_speed_mbps.toFixed(1)} MB/s, 
                  ETA: {formatETA(progress.eta_seconds)})
                </>
              ) : (
                'Downloading...'
              )}
            </div>
          </div>
        );
      
      case 'downloaded':
        return (
          <button
            className="action-button load-button"
            onClick={() => handleLoadModel(model.name)}
            aria-label={`Load ${model.display_name}`}
          >
            🚀 Load
          </button>
        );
      
      case 'loading':
        return (
          <div className="loading-indicator">
            <span className="loading-spinner">⏳</span>
            Loading...
          </div>
        );
      
      case 'loaded':
        const isActive = activeModel === model.name;
        return (
          <div className="loaded-actions">
            {isActive && <span className="active-badge">Active</span>}
            <button
              className="action-button unload-button"
              onClick={() => handleUnloadModel(model.name)}
              aria-label={`Unload ${model.display_name}`}
            >
              🔄 Unload
            </button>
          </div>
        );
      
      case 'error':
        return (
          <div className="error-status">
            <span className="error-icon">❌</span>
            <span className="error-text">Error</span>
            <button
              className="action-button retry-button"
              onClick={() => handleLoadModel(model.name)}
              aria-label={`Retry loading ${model.display_name}`}
            >
              🔄 Retry
            </button>
          </div>
        );
      
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className={`model-manager loading ${className}`}>
        <div className="loading-message">
          <span className="loading-spinner">⏳</span>
          Loading models...
        </div>
      </div>
    );
  }

  return (
    <div className={`model-manager ${className}`}>
      <div className="manager-header">
        <h3>Local AI Models</h3>
        <button 
          className="refresh-button"
          onClick={fetchModels}
          aria-label="Refresh models list"
        >
          🔄
        </button>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
          <button 
            className="dismiss-button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <div className="models-list">
        {models.map((model) => (
          <div key={model.name} className={`model-card ${getModelStatusColor(model.status)}`}>
            <div className="model-header">
              <div className="model-info">
                <h4 className="model-name">{model.display_name}</h4>
                <div className="model-meta">
                  <span className="model-type">{model.model_type}</span>
                  <span className="model-size">{model.parameter_count}</span>
                  <span className="file-size">{formatFileSize(model.file_size_mb)}</span>
                </div>
              </div>
              <div className="model-actions">
                {getActionButton(model)}
              </div>
            </div>
            
            <p className="model-description">{model.description}</p>
            
            <div className="model-details">
              <div className="detail-item">
                <span className="detail-label">Memory Required:</span>
                <span className="detail-value">{formatFileSize(model.memory_requirement_mb)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Quality Score:</span>
                <span className="detail-value">{(model.quality_score * 100).toFixed(0)}%</span>
              </div>
              {model.recommended_for.length > 0 && (
                <div className="detail-item">
                  <span className="detail-label">Best For:</span>
                  <span className="detail-value">{model.recommended_for.join(', ')}</span>
                </div>
              )}
            </div>

            {model.error_message && (
              <div className="model-error">
                <span className="error-icon">⚠️</span>
                <span className="error-text">{model.error_message}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {models.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <p>No models available</p>
        </div>
      )}
    </div>
  );
};

export default ModelManager;
