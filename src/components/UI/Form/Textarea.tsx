/**
 * XP Textarea Component
 * Authentic Windows XP textarea styling
 */

import React, { forwardRef } from 'react';
import './Form.css';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
  'data-testid'?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      required = false,
      resize = 'vertical',
      className = '',
      id,
      rows = 3,
      'data-testid': testId,
      style,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${textareaId}-error` : undefined;
    const helperId = helperText ? `${textareaId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    const textareaStyle = {
      resize,
      ...style,
    };

    return (
      <div className={`xp-form-field ${className}`}>
        {label && (
          <label htmlFor={textareaId} className="xp-form-label">
            {label}
            {required && <span className="xp-form-required" aria-label="required">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`xp-textarea ${error ? 'xp-textarea--error' : ''}`}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          aria-required={required}
          rows={rows}
          style={textareaStyle}
          data-testid={testId}
          {...props}
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

Textarea.displayName = 'Textarea';
