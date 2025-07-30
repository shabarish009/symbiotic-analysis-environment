/**
 * XP Button Component
 * Authentic Windows XP button with various types and states
 */

import React, { forwardRef } from 'react';
import './Button.css';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'icon' | 'toolbar';
  size?: 'small' | 'medium' | 'large';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right' | 'only';
  loading?: boolean;
  pressed?: boolean; // For toggle buttons
  group?: boolean; // For button groups
  'data-testid'?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'default',
      size = 'medium',
      icon,
      iconPosition = 'left',
      loading = false,
      pressed = false,
      group = false,
      className = '',
      children,
      disabled,
      'data-testid': testId,
      ...props
    },
    ref
  ) => {
    const buttonClasses = [
      'xp-button',
      `xp-button--${variant}`,
      `xp-button--${size}`,
      loading && 'xp-button--loading',
      disabled && 'xp-button--disabled',
      pressed && 'xp-button--pressed',
      group && 'xp-button--group',
      iconPosition === 'only' && 'xp-button--icon-only',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const renderContent = () => {
      if (loading) {
        return (
          <>
            <span className="xp-button-spinner" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle
                  cx="6"
                  cy="6"
                  r="5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="8 4"
                />
              </svg>
            </span>
            <span className="sr-only">Loading...</span>
          </>
        );
      }

      return (
        <>
          {icon && iconPosition === 'left' && (
            <span
              className="xp-button-icon xp-button-icon--left"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
          {iconPosition === 'only' ? (
            <span className="xp-button-icon xp-button-icon--only" aria-hidden="true">
              {icon}
            </span>
          ) : (
            children && <span className="xp-button-text">{children}</span>
          )}
          {icon && iconPosition === 'right' && (
            <span
              className="xp-button-icon xp-button-icon--right"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
        </>
      );
    };

    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={disabled || loading}
        data-testid={testId}
        aria-disabled={disabled || loading}
        {...props}
      >
        {renderContent()}
      </button>
    );
  }
);

Button.displayName = 'Button';
