/**
 * XP Icon Button Component
 * Specialized button for icon-only interactions
 */

import React, { forwardRef } from 'react';
import { Button, ButtonProps } from './Button';

export interface IconButtonProps
  extends Omit<ButtonProps, 'children' | 'iconPosition'> {
  icon: React.ReactNode;
  'aria-label': string; // Required for accessibility
  tooltip?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = 'icon',
      size = 'medium',
      'aria-label': ariaLabel,
      tooltip,
      title,
      ...props
    },
    ref
  ) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        icon={icon}
        iconPosition="only"
        aria-label={ariaLabel}
        title={title || tooltip || ariaLabel}
        {...props}
      />
    );
  }
);

IconButton.displayName = 'IconButton';
