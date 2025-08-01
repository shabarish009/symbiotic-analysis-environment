import React, { useState, useEffect } from 'react';
import { Button } from '../UI/Button';
import { DatabaseTypeSelector } from './DatabaseTypeSelector';
import { useDatabaseTypes } from './hooks/useDatabaseTypes';
import type { DatabaseConnection, ConnectionFormData, ConnectionFormErrors, DatabaseType } from './types';
import './ConnectionForm.css';

interface ConnectionFormProps {
  connection?: DatabaseConnection | null;
  onSubmit: (formData: ConnectionFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  connection,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const { getConnectionTemplate, validateConnectionParams } = useDatabaseTypes();
  
  const [formData, setFormData] = useState<ConnectionFormData>({
    name: '',
    database_type: 'PostgreSQL',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl_enabled: true,
    connection_timeout: 30,
    max_connections: 10,
    additional_params: {},
  });

  const [errors, setErrors] = useState<ConnectionFormErrors>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize form data when connection prop changes
  useEffect(() => {
    if (connection) {
      setFormData({
        name: connection.name,
        database_type: connection.database_type,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        password: '', // Never pre-fill password for security
        ssl_enabled: connection.ssl_enabled,
        connection_timeout: connection.connection_timeout,
        max_connections: connection.max_connections,
        additional_params: connection.additional_params,
      });
    } else {
      // Reset to defaults for new connection
      const template = getConnectionTemplate('PostgreSQL');
      setFormData({
        name: '',
        database_type: 'PostgreSQL',
        host: template.host,
        port: template.port,
        database: template.database,
        username: template.username,
        password: '',
        ssl_enabled: template.ssl_enabled,
        connection_timeout: 30,
        max_connections: 10,
        additional_params: {},
      });
    }
    setErrors({});
  }, [connection, getConnectionTemplate]);

  // Update form when database type changes
  const handleDatabaseTypeChange = (type: DatabaseType) => {
    const template = getConnectionTemplate(type);
    setFormData(prev => ({
      ...prev,
      database_type: type,
      host: template.host,
      port: template.port,
      database: prev.database || template.database,
      username: prev.username || template.username,
      ssl_enabled: template.ssl_enabled,
    }));
    setErrors({});
  };

  const handleInputChange = (field: keyof ConnectionFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    if (errors[field as keyof ConnectionFormErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: ConnectionFormErrors = {};

    // Basic validation
    if (!formData.name.trim()) {
      newErrors.name = 'Connection name is required';
    }

    if (!formData.password.trim() && !connection) {
      newErrors.password = 'Password is required';
    }

    // Database-specific validation
    const dbErrors = validateConnectionParams(formData.database_type, formData);
    Object.assign(newErrors, dbErrors);

    // Timeout validation
    if (formData.connection_timeout < 1 || formData.connection_timeout > 300) {
      newErrors.connection_timeout = 'Timeout must be between 1 and 300 seconds';
    }

    // Max connections validation
    if (formData.max_connections < 1 || formData.max_connections > 100) {
      newErrors.max_connections = 'Max connections must be between 1 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      // Error handling is done by parent component
    }
  };

  const isEditing = !!connection;

  return (
    <div className="connection-form">
      <div className="form-header">
        <h3>{isEditing ? 'Edit Connection' : 'Add New Connection'}</h3>
        <p>Configure your database connection settings</p>
      </div>

      <form onSubmit={handleSubmit} className="form-content">
        {/* Basic Settings */}
        <div className="form-section">
          <h4>Basic Settings</h4>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Connection Name *</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={errors.name ? 'error' : ''}
                placeholder="My Database Connection"
                disabled={isLoading}
                aria-required="true"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
                maxLength={255}
              />
              {errors.name && (
                <span
                  id="name-error"
                  className="error-text"
                  role="alert"
                  aria-live="polite"
                >
                  {errors.name}
                </span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="database_type">Database Type *</label>
              <DatabaseTypeSelector
                value={formData.database_type}
                onChange={handleDatabaseTypeChange}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Connection Settings */}
        <div className="form-section">
          <h4>Connection Settings</h4>
          
          {formData.database_type !== 'SQLite' && (
            <>
              <div className="form-row">
                <div className="form-group flex-2">
                  <label htmlFor="host">Host *</label>
                  <input
                    id="host"
                    type="text"
                    value={formData.host}
                    onChange={(e) => handleInputChange('host', e.target.value)}
                    className={errors.host ? 'error' : ''}
                    placeholder="localhost"
                    disabled={isLoading}
                  />
                  {errors.host && <span className="error-text">{errors.host}</span>}
                </div>
                <div className="form-group flex-1">
                  <label htmlFor="port">Port *</label>
                  <input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 0)}
                    className={errors.port ? 'error' : ''}
                    min="1"
                    max="65535"
                    disabled={isLoading}
                  />
                  {errors.port && <span className="error-text">{errors.port}</span>}
                </div>
              </div>
            </>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="database">
                {formData.database_type === 'SQLite' ? 'Database File Path *' : 'Database Name *'}
              </label>
              <input
                id="database"
                type="text"
                value={formData.database}
                onChange={(e) => handleInputChange('database', e.target.value)}
                className={errors.database ? 'error' : ''}
                placeholder={
                  formData.database_type === 'SQLite' 
                    ? './database.db' 
                    : 'database_name'
                }
                disabled={isLoading}
              />
              {errors.database && <span className="error-text">{errors.database}</span>}
            </div>
          </div>

          {formData.database_type !== 'SQLite' && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="username">Username *</label>
                <input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className={errors.username ? 'error' : ''}
                  placeholder="username"
                  disabled={isLoading}
                />
                {errors.username && <span className="error-text">{errors.username}</span>}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">
                Password {!isEditing && '*'}
                {isEditing && <span className="password-note">(leave blank to keep current)</span>}
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={errors.password ? 'error' : ''}
                placeholder={isEditing ? 'Enter new password' : 'password'}
                disabled={isLoading}
                aria-required={!isEditing ? 'true' : 'false'}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : 'password-help'}
                autoComplete="new-password"
                maxLength={1024}
                minLength={8}
              />
              <div id="password-help" className="help-text">
                Password will be securely stored in your system keychain
              </div>
              {errors.password && (
                <span
                  id="password-error"
                  className="error-text"
                  role="alert"
                  aria-live="polite"
                >
                  {errors.password}
                </span>
              )}
            </div>
          </div>

          {formData.database_type !== 'SQLite' && (
            <div className="form-row">
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.ssl_enabled}
                    onChange={(e) => handleInputChange('ssl_enabled', e.target.checked)}
                    disabled={isLoading}
                  />
                  Enable SSL/TLS encryption
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Advanced Settings */}
        <div className="form-section">
          <div className="section-header">
            <h4>Advanced Settings</h4>
            <Button
              type="button"
              variant="text"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={isLoading}
            >
              {showAdvanced ? '▼ Hide' : '▶ Show'}
            </Button>
          </div>

          {showAdvanced && (
            <>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label htmlFor="connection_timeout">Connection Timeout (seconds)</label>
                  <input
                    id="connection_timeout"
                    type="number"
                    value={formData.connection_timeout}
                    onChange={(e) => handleInputChange('connection_timeout', parseInt(e.target.value) || 30)}
                    className={errors.connection_timeout ? 'error' : ''}
                    min="1"
                    max="300"
                    disabled={isLoading}
                  />
                  {errors.connection_timeout && <span className="error-text">{errors.connection_timeout}</span>}
                </div>
                <div className="form-group flex-1">
                  <label htmlFor="max_connections">Max Connections</label>
                  <input
                    id="max_connections"
                    type="number"
                    value={formData.max_connections}
                    onChange={(e) => handleInputChange('max_connections', parseInt(e.target.value) || 10)}
                    className={errors.max_connections ? 'error' : ''}
                    min="1"
                    max="100"
                    disabled={isLoading}
                  />
                  {errors.max_connections && <span className="error-text">{errors.max_connections}</span>}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
            icon={isLoading ? '⏳' : '💾'}
          >
            {isLoading ? 'Saving...' : (isEditing ? 'Update Connection' : 'Add Connection')}
          </Button>
        </div>
      </form>
    </div>
  );
};
