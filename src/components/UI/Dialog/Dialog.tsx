/**
 * XP Dialog Component
 * Authentic Windows XP dialog/modal styling
 */

import React, { useEffect, useRef } from 'react';
import { a11yUtils } from '../../../styles/utils/accessibility';
import './Dialog.css';

export interface DialogProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  'data-testid': testId,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapFocusRef = useRef<(() => void) | null>(null);

  // Handle focus trapping when dialog is open
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      trapFocusRef.current = a11yUtils.trapFocus(dialogRef.current);
    } else if (trapFocusRef.current) {
      trapFocusRef.current();
      trapFocusRef.current = null;
    }

    return () => {
      if (trapFocusRef.current) {
        trapFocusRef.current();
      }
    };
  }, [isOpen]);

  // Handle escape key to close dialog
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Handle click outside to close dialog
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(event.target as Node)
      ) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="xp-dialog-overlay" data-testid={`${testId}-overlay`}>
      <div
        ref={dialogRef}
        className={`xp-dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${testId}-title` : undefined}
        data-testid={testId}
      >
        {title && (
          <div className="xp-dialog-header">
            <h2 id={`${testId}-title`} className="xp-dialog-title">
              {title}
            </h2>
            {onClose && (
              <button
                className="xp-dialog-close"
                onClick={onClose}
                aria-label="Close dialog"
                data-testid={`${testId}-close`}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path
                    d="M1 1L7 7M7 1L1 7"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="xp-dialog-content">{children}</div>
      </div>
    </div>
  );
};
