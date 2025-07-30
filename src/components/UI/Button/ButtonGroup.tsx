/**
 * XP Button Group Component
 * Groups buttons together with authentic XP styling
 */

import React, { forwardRef, Children, cloneElement, isValidElement } from 'react';
import './ButtonGroup.css';

export interface ButtonGroupProps
  extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'toolbar';
  'data-testid'?: string;
}

export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(
  (
    {
      orientation = 'horizontal',
      size = 'medium',
      variant = 'default',
      className = '',
      children,
      'data-testid': testId,
      ...props
    },
    ref
  ) => {
    const groupClasses = [
      'xp-button-group',
      `xp-button-group--${orientation}`,
      `xp-button-group--${size}`,
      `xp-button-group--${variant}`,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    // Clone children to add group prop
    const enhancedChildren = Children.map(children, (child, index) => {
      if (isValidElement(child) && child.type && 
          (child.type as any).displayName === 'Button') {
        return cloneElement(child, {
          group: true,
          size: child.props.size || size,
          variant: child.props.variant || (variant === 'toolbar' ? 'toolbar' : 'default'),
          'data-group-index': index,
        });
      }
      return child;
    });

    return (
      <div
        ref={ref}
        className={groupClasses}
        role="group"
        data-testid={testId}
        {...props}
      >
        {enhancedChildren}
      </div>
    );
  }
);

ButtonGroup.displayName = 'ButtonGroup';
