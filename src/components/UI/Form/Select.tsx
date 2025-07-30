/**
 * XP Select Component
 * Authentic Windows XP dropdown select styling
 */

import React, { forwardRef } from 'react';
import './Form.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  options: SelectOption[];
  placeholder?: string;
  'data-testid'?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      required = false,
      options,
      placeholder,
      className = '',
      id,
      'data-testid': testId,
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${selectId}-error` : undefined;
    const helperId = helperText ? `${selectId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={`xp-form-field ${className}`}>
        {label && (
          <label htmlFor={selectId} className="xp-form-label">
            {label}
            {required && <span className="xp-form-required" aria-label="required">*</span>}
          </label>
        )}
        <div className="xp-select-container">
          <select
            ref={ref}
            id={selectId}
            className={`xp-select ${error ? 'xp-select--error' : ''}`}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            aria-required={required}
            data-testid={testId}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          <div className="xp-select-arrow" aria-hidden="true">
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path
                d="M1 1L6 6L11 1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        {helperText && !error && (
          <div id={helperId} className="xp-form-helper">
            {helperText}
          </div>
        )}
        {error && (
          <div id={errorId} className="xp-form-error" role="alert">
            {error}
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
