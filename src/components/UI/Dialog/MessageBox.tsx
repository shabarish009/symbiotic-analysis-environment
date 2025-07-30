/**
 * XP Message Box Component
 * Authentic Windows XP message box for alerts and confirmations
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../Button';
import './MessageBox.css';

export interface MessageBoxButton {
  id: string;
  label: string;
  variant?: 'default' | 'primary' | 'secondary';
  autoFocus?: boolean;
}

export interface MessageBoxProps {
  type: 'info' | 'warning' | 'error' | 'question';
  title: string;
  message: string;
  buttons: MessageBoxButton[];
  defaultButton?: number;
  onClose: (result: string) => void;
  className?: string;
  'data-testid'?: string;
}

const MESSAGE_BOX_ICONS = {
  info: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#0066CC" stroke="#003399"/>
      <path d="M16 8V12M16 16V24" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="16" cy="12" r="1" fill="white"/>
    </svg>
  ),
  warning: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M16 2L30 28H2L16 2Z" fill="#FFD700" stroke="#CC9900"/>
      <path d="M16 10V18M16 22V24" stroke="black" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  error: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#CC0000" stroke="#990000"/>
      <path d="M10 10L22 22M22 10L10 22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  question: (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="15" fill="#0066CC" stroke="#003399"/>
      <path d="M12 12C12 8 14 6 16 6C18 6 20 8 20 12C20 14 18 15 16 16V18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="16" cy="22" r="1" fill="white"/>
    </svg>
  ),
};

export const MessageBox: React.FC<MessageBoxProps> = ({
  type,
  title,
  message,
  buttons,
  defaultButton = 0,
  onClose,
  className = '',
  'data-testid': testId,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const defaultButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management
  useEffect(() => {
    if (defaultButtonRef.current) {
      defaultButtonRef.current.focus();
    }
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          // Close with the last button (usually Cancel)
          onClose(buttons[buttons.length - 1].id);
          break;
        case 'Enter':
          // Activate default button
          if (defaultButtonRef.current) {
            defaultButtonRef.current.click();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [buttons, onClose]);

  const handleButtonClick = (buttonId: string) => {
    onClose(buttonId);
  };

  const messageBoxElement = (
    <div className="xp-message-box-overlay">
      <div
        ref={dialogRef}
        className={`xp-message-box xp-message-box--${type} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        aria-describedby={`${testId}-message`}
        data-testid={testId}
      >
        <div className="xp-message-box-header">
          <h2 id={`${testId}-title`} className="xp-message-box-title">
            {title}
          </h2>
        </div>

        <div className="xp-message-box-content">
          <div className="xp-message-box-icon" aria-hidden="true">
            {MESSAGE_BOX_ICONS[type]}
          </div>
          <div
            id={`${testId}-message`}
            className="xp-message-box-message"
          >
            {message}
          </div>
        </div>

        <div className="xp-message-box-buttons">
          {buttons.map((button, index) => (
            <Button
              key={button.id}
              ref={index === defaultButton ? defaultButtonRef : undefined}
              variant={button.variant || (index === defaultButton ? 'primary' : 'default')}
              onClick={() => handleButtonClick(button.id)}
              autoFocus={button.autoFocus || index === defaultButton}
            >
              {button.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(messageBoxElement, document.body);
};

// Convenience functions for common message box types
export const showInfo = (title: string, message: string): Promise<string> => {
  return new Promise((resolve) => {
    const messageBox = (
      <MessageBox
        type="info"
        title={title}
        message={message}
        buttons={[{ id: 'ok', label: 'OK', variant: 'primary' }]}
        onClose={resolve}
      />
    );
    // This would need to be handled by a MessageBox provider/context
    // For now, this is just the interface
  });
};

export const showWarning = (title: string, message: string): Promise<string> => {
  return new Promise((resolve) => {
    const messageBox = (
      <MessageBox
        type="warning"
        title={title}
        message={message}
        buttons={[{ id: 'ok', label: 'OK', variant: 'primary' }]}
        onClose={resolve}
      />
    );
  });
};

export const showError = (title: string, message: string): Promise<string> => {
  return new Promise((resolve) => {
    const messageBox = (
      <MessageBox
        type="error"
        title={title}
        message={message}
        buttons={[{ id: 'ok', label: 'OK', variant: 'primary' }]}
        onClose={resolve}
      />
    );
  });
};

export const showConfirm = (title: string, message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const messageBox = (
      <MessageBox
        type="question"
        title={title}
        message={message}
        buttons={[
          { id: 'yes', label: 'Yes', variant: 'primary' },
          { id: 'no', label: 'No', variant: 'default' },
        ]}
        onClose={(result) => resolve(result === 'yes')}
      />
    );
  });
};
