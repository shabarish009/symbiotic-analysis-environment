/**
 * XP Menu Separator Component
 * Standalone separator component for menu items
 */

import React, { forwardRef } from 'react';

export interface MenuSeparatorProps {
  className?: string;
  'data-testid'?: string;
}

export const MenuSeparator = forwardRef<HTMLDivElement, MenuSeparatorProps>(
  (
    {
      className = '',
      'data-testid': testId,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`xp-menu-separator ${className}`}
        role="separator"
        data-testid={testId}
      />
    );
  }
);

MenuSeparator.displayName = 'MenuSeparator';
