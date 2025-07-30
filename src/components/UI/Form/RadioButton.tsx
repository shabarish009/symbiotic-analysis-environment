/**
 * XP Radio Button Component
 * Authentic Windows XP radio button styling
 */

import React, { forwardRef } from 'react';
import './Form.css';

export interface RadioButtonProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  'data-testid'?: string;
}

export interface RadioGroupProps {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}

export const RadioButton = forwardRef<HTMLInputElement, RadioButtonProps>(
  (
    {
      label,
      error,
      helperText,
      className = '',
      id,
      children,
      'data-testid': testId,
      ...props
    },
    ref
  ) => {
    const radioId = id || `radio-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${radioId}-error` : undefined;
    const helperId = helperText ? `${radioId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={`xp-form-field ${className}`}>
        <div className="xp-radio-container">
          <input
            ref={ref}
            type="radio"
            id={radioId}
            className={`xp-radio ${error ? 'xp-radio--error' : ''}`}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            data-testid={testId}
            {...props}
          />
          {(label || children) && (
            <label htmlFor={radioId} className="xp-radio-label">
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

RadioButton.displayName = 'RadioButton';

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  value,
  onChange,
  error,
  helperText,
  children,
  className = '',
  'data-testid': testId,
}) => {
  const groupId = `radio-group-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${groupId}-error` : undefined;
  const helperId = helperText ? `${groupId}-helper` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event.target.value);
    }
  };

  // Clone children to add group props
  const enhancedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type === RadioButton) {
      return React.cloneElement(child, {
        name,
        checked: child.props.value === value,
        onChange: handleChange,
        error: error && !child.props.error ? error : child.props.error,
      });
    }
    return child;
  });

  return (
    <div
      className={`xp-radio-group ${className}`}
      role="radiogroup"
      aria-describedby={describedBy}
      aria-invalid={!!error}
      data-testid={testId}
    >
      {enhancedChildren}
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
};
