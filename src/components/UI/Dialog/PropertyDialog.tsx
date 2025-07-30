/**
 * XP Property Dialog Component
 * Authentic Windows XP property dialog for settings and configuration
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../Button';
import './PropertyDialog.css';

export interface PropertyTab {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface PropertyDialogProps {
  isOpen: boolean;
  title: string;
  tabs: PropertyTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  onOk?: () => void;
  onCancel?: () => void;
  onApply?: () => void;
  okLabel?: string;
  cancelLabel?: string;
  applyLabel?: string;
  showApply?: boolean;
  className?: string;
  'data-testid'?: string;
}

export const PropertyDialog: React.FC<PropertyDialogProps> = ({
  isOpen,
  title,
  tabs,
  activeTab,
  onTabChange,
  onOk,
  onCancel,
  onApply,
  okLabel = 'OK',
  cancelLabel = 'Cancel',
  applyLabel = 'Apply',
  showApply = false,
  className = '',
  'data-testid': testId,
}) => {
  const [currentTab, setCurrentTab] = useState(activeTab || tabs[0]?.id || '');
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstTabRef = useRef<HTMLButtonElement>(null);

  // Update current tab when activeTab prop changes
  useEffect(() => {
    if (activeTab && activeTab !== currentTab) {
      setCurrentTab(activeTab);
    }
  }, [activeTab, currentTab]);

  // Focus management
  useEffect(() => {
    if (isOpen && firstTabRef.current) {
      firstTabRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          onCancel?.();
          break;
        case 'Enter':
          if (event.ctrlKey) {
            onOk?.();
          }
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
          if (event.target && (event.target as HTMLElement).classList.contains('xp-property-tab')) {
            event.preventDefault();
            navigateTab(event.key === 'ArrowRight' ? 1 : -1);
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onCancel, onOk]);

  const navigateTab = (direction: number) => {
    const currentIndex = tabs.findIndex(tab => tab.id === currentTab);
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    
    if (!nextTab.disabled) {
      handleTabChange(nextTab.id);
    }
  };

  const handleTabChange = (tabId: string) => {
    setCurrentTab(tabId);
    onTabChange?.(tabId);
  };

  const activeTabContent = tabs.find(tab => tab.id === currentTab)?.content;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="xp-property-dialog-overlay">
      <div
        ref={dialogRef}
        className={`xp-property-dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        data-testid={testId}
      >
        <div className="xp-property-dialog-header">
          <h2 id={`${testId}-title`} className="xp-property-dialog-title">
            {title}
          </h2>
        </div>

        <div className="xp-property-dialog-body">
          <div className="xp-property-tabs" role="tablist">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={index === 0 ? firstTabRef : undefined}
                className={`xp-property-tab ${
                  currentTab === tab.id ? 'xp-property-tab--active' : ''
                } ${tab.disabled ? 'xp-property-tab--disabled' : ''}`}
                role="tab"
                aria-selected={currentTab === tab.id}
                aria-controls={`${testId}-panel-${tab.id}`}
                disabled={tab.disabled}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            id={`${testId}-panel-${currentTab}`}
            className="xp-property-content"
            role="tabpanel"
            aria-labelledby={`${testId}-tab-${currentTab}`}
          >
            {activeTabContent}
          </div>
        </div>

        <div className="xp-property-dialog-footer">
          <div className="xp-property-dialog-buttons">
            <Button variant="primary" onClick={onOk}>
              {okLabel}
            </Button>
            <Button variant="default" onClick={onCancel}>
              {cancelLabel}
            </Button>
            {showApply && (
              <Button variant="default" onClick={onApply}>
                {applyLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
