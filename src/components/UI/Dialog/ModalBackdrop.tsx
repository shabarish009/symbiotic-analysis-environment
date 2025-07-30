/**
 * XP Modal Backdrop Component
 * Reusable backdrop component for modal dialogs
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './ModalBackdrop.css';

export interface ModalBackdropProps {
  isOpen: boolean;
  onClose?: () => void;
  closeOnClick?: boolean;
  closeOnEscape?: boolean;
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}

export const ModalBackdrop: React.FC<ModalBackdropProps> = ({
  isOpen,
  onClose,
  closeOnClick = true,
  closeOnEscape = true,
  children,
  className = '',
  'data-testid': testId,
}) => {
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape && isOpen) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (closeOnClick && event.target === event.currentTarget) {
      onClose?.();
    }
  };

  if (!isOpen) {
    return null;
  }

  const backdropElement = (
    <div
      className={`xp-modal-backdrop ${className}`}
      onClick={handleBackdropClick}
      data-testid={testId}
    >
      {children}
    </div>
  );

  return createPortal(backdropElement, document.body);
};
