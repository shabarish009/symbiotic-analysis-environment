/**
 * XP Toolbar Button Component
 * Specialized button for toolbar usage with XP styling
 */

import React, { forwardRef } from 'react';
import { Button, ButtonProps } from './Button';

export interface ToolbarButtonProps extends ButtonProps {
  tooltip?: string;
}

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      variant = 'toolbar',
      size = 'small',
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
        title={title || tooltip}
        {...props}
      />
    );
  }
);

ToolbarButton.displayName = 'ToolbarButton';
