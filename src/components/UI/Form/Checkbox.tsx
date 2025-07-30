/**
 * XP Checkbox Component
 * Authentic Windows XP checkbox styling
 */

import React, { forwardRef } from 'react';
import './Form.css';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  indeterminate?: boolean;
  'data-testid'?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      error,
      helperText,
      indeterminate = false,
      className = '',
      id,
      children,
      'data-testid': testId,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${checkboxId}-error` : undefined;
    const helperId = helperText ? `${checkboxId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    // Handle indeterminate state
    React.useEffect(() => {
      if (ref && typeof ref === 'object' && ref.current) {
        ref.current.indeterminate = indeterminate;
      }
    }, [indeterminate, ref]);

    return (
      <div className={`xp-form-field ${className}`}>
        <div className="xp-checkbox-container">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            className={`xp-checkbox ${error ? 'xp-checkbox--error' : ''}`}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            data-testid={testId}
            {...props}
          />
          {(label || children) && (
            <label htmlFor={checkboxId} className="xp-checkbox-label">
              {label || children}
            </label>
          )}
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

Checkbox.displayName = 'Checkbox';
