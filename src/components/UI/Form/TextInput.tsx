/**
 * XP TextInput Component
 * Authentic Windows XP text input styling
 */

import React, { forwardRef } from 'react';
import './Form.css';

export interface TextInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  'data-testid'?: string;
}

export const TextInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextInputProps>(
  (
    {
      label,
      error,
      helperText,
      required = false,
      multiline = false,
      rows = 3,
      className = '',
      id,
      'data-testid': testId,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    const inputClasses = [
      multiline ? 'xp-textarea' : 'xp-text-input',
      error && 'xp-text-input--error',
    ].filter(Boolean).join(' ');

    const InputComponent = multiline ? 'textarea' : 'input';

    return (
      <div className={`xp-form-field ${className}`}>
        {label && (
          <label htmlFor={inputId} className="xp-form-label">
            {label}
            {required && <span className="xp-form-required" aria-label="required">*</span>}
          </label>
        )}
        <InputComponent
          ref={ref as any}
          id={inputId}
          className={inputClasses}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          aria-required={required}
          rows={multiline ? rows : undefined}
          data-testid={testId}
          {...(props as any)}
        />
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

TextInput.displayName = 'TextInput';
