import React from 'react';
import { useDatabaseTypes } from './hooks/useDatabaseTypes';
import type { DatabaseType } from './types';
import './DatabaseTypeSelector.css';

interface DatabaseTypeSelectorProps {
  value: DatabaseType;
  onChange: (type: DatabaseType) => void;
  disabled?: boolean;
  showDescription?: boolean;
}

export const DatabaseTypeSelector: React.FC<DatabaseTypeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  showDescription = false,
}) => {
  const { supportedTypeInfo, isTypeSupported } = useDatabaseTypes();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as DatabaseType);
  };

  const selectedTypeInfo = supportedTypeInfo.find(info => info.type === value);

  return (
    <div className="database-type-selector">
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="database-type-select"
      >
        {supportedTypeInfo.map((typeInfo) => (
          <option
            key={typeInfo.type}
            value={typeInfo.type}
            disabled={!isTypeSupported(typeInfo.type)}
          >
            {typeInfo.icon} {typeInfo.displayName}
            {!isTypeSupported(typeInfo.type) && ' (Not Available)'}
          </option>
        ))}
      </select>

      {showDescription && selectedTypeInfo && (
        <div className="database-type-info">
          <div className="type-description">
            <span className="type-icon">{selectedTypeInfo.icon}</span>
            <div className="type-details">
              <div className="type-name">{selectedTypeInfo.displayName}</div>
              <div className="type-desc">{selectedTypeInfo.description}</div>
              {selectedTypeInfo.defaultPort > 0 && (
                <div className="type-port">Default Port: {selectedTypeInfo.defaultPort}</div>
              )}
            </div>
          </div>
          
          {selectedTypeInfo.features.length > 0 && (
            <div className="type-features">
              <div className="features-title">Key Features:</div>
              <div className="features-list">
                {selectedTypeInfo.features.map((feature, index) => (
                  <span key={index} className="feature-tag">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
