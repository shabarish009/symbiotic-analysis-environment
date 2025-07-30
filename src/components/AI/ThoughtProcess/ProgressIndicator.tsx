/**
 * Progress Indicator Component
 * Shows the current step and progress of the AI thought process
 */

import React from 'react';
import { ProgressIndicatorProps, STEP_LABELS, STEP_DESCRIPTIONS } from '../../../types/thoughtProcess';
import './ProgressIndicator.css';

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  progress,
  expectedSteps
}) => {
  const getStepStatus = (step: string) => {
    const currentIndex = expectedSteps.indexOf(currentStep);
    const stepIndex = expectedSteps.indexOf(step);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const getStepIcon = (step: string, status: string) => {
    if (status === 'completed') return '✓';
    if (status === 'active') return '⟳';
    return '○';
  };

  return (
    <div className="progress-indicator">
      <div className="progress-header">
        <h4>Processing Progress</h4>
        <div className="progress-percentage">
          {Math.round(progress * 100)}%
        </div>
      </div>
      
      <div className="progress-bar-container">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <div className="steps-container">
        {expectedSteps.map((step, index) => {
          const status = getStepStatus(step);
          const icon = getStepIcon(step, status);
          const label = STEP_LABELS[step] || step;
          const description = STEP_DESCRIPTIONS[step] || '';

          return (
            <div key={step} className={`step-item ${status}`}>
              <div className="step-indicator">
                <span className="step-icon">{icon}</span>
                <span className="step-number">{index + 1}</span>
              </div>
              
              <div className="step-content">
                <div className="step-label">{label}</div>
                <div className="step-description">{description}</div>
                
                {status === 'active' && (
                  <div className="step-status">
                    <span className="status-text">In Progress...</span>
                    <div className="loading-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                )}
              </div>
              
              {index < expectedSteps.length - 1 && (
                <div className={`step-connector ${status === 'completed' ? 'completed' : ''}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="current-step-info">
        <div className="current-step-label">
          Current Step: <strong>{STEP_LABELS[currentStep] || currentStep}</strong>
        </div>
        <div className="current-step-description">
          {STEP_DESCRIPTIONS[currentStep] || 'Processing...'}
        </div>
      </div>
    </div>
  );
};
