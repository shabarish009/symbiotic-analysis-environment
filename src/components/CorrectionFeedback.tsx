import React, { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './CorrectionFeedback.css';

interface CorrectionFeedbackProps {
  queryId: string;
  originalQuery: string;
  generatedResult: string;
  onCorrection?: (correction: UserCorrection) => void;
  sessionId: string;
  projectId: string;
  className?: string;
}

interface UserCorrection {
  session_id: string;
  query_id: string;
  project_id: string;
  original_query: string;
  corrected_query?: string;
  correction_type: 'edit' | 'replacement' | 'refinement' | 'feedback' | 'suggestion';
  feedback_score?: number;
  correction_reason: string;
  context?: Record<string, any>;
  confidence?: number;
  metadata?: Record<string, any>;
}

type FeedbackMode = 'none' | 'rating' | 'edit' | 'suggestion';

const CorrectionFeedback: React.FC<CorrectionFeedbackProps> = ({
  queryId,
  originalQuery,
  generatedResult,
  onCorrection,
  sessionId,
  projectId,
  className = ''
}) => {
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('none');
  const [correctedQuery, setCorrectedQuery] = useState(generatedResult);
  const [correctionReason, setCorrectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Refs for accessibility
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const correctionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus management for accessibility
  useEffect(() => {
    if (feedbackMode !== 'none' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [feedbackMode]);

  // Input validation and sanitization
  const validateInput = useCallback((text: string, maxLength: number = 1000): string[] => {
    const errors: string[] = [];

    if (!text.trim()) {
      errors.push('This field is required');
      return errors;
    }

    if (text.length > maxLength) {
      errors.push(`Text must be ${maxLength} characters or less`);
    }

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(text)) {
        errors.push('Input contains potentially unsafe content');
        break;
      }
    }

    return errors;
  }, []);

  const sanitizeInput = useCallback((text: string): string => {
    // Remove potentially dangerous HTML/script content
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:text\/html/gi, '')
      .replace(/vbscript:/gi, '')
      .trim();
  }, []);

  const handleThumbsUp = useCallback(async () => {
    try {
      setIsSubmitting(true);
      
      const result = await invoke('ai_engine_request', {
        method: 'correction.feedback',
        params: {
          query_id: queryId,
          feedback_score: 1,
          feedback_text: 'Positive feedback',
          session_id: sessionId,
          project_id: projectId
        }
      });

      if (result.success) {
        setFeedbackSubmitted(true);
        onCorrection?.({
          session_id: sessionId,
          query_id: queryId,
          project_id: projectId,
          original_query: originalQuery,
          correction_type: 'feedback',
          feedback_score: 1,
          correction_reason: 'Positive feedback'
        });
      }
    } catch (error) {
      console.error('Error submitting positive feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [queryId, sessionId, projectId, originalQuery, onCorrection]);

  const handleThumbsDown = useCallback(() => {
    setFeedbackMode('rating');
  }, []);

  const handleEditMode = useCallback(() => {
    setFeedbackMode('edit');
    setCorrectedQuery(generatedResult);
  }, [generatedResult]);

  const handleSuggestionMode = useCallback(() => {
    setFeedbackMode('suggestion');
  }, []);

  const handleSubmitCorrection = useCallback(async () => {
    // Clear previous errors
    setError(null);
    setValidationErrors([]);

    // Validate inputs
    const reasonErrors = validateInput(correctionReason, 1000);
    let queryErrors: string[] = [];

    if (feedbackMode === 'edit') {
      queryErrors = validateInput(correctedQuery, 10000);
      if (correctedQuery.trim() === generatedResult.trim()) {
        queryErrors.push('Please make changes to the query before submitting');
      }
    }

    const allErrors = [...reasonErrors, ...queryErrors];
    if (allErrors.length > 0) {
      setValidationErrors(allErrors);
      return;
    }

    try {
      setIsSubmitting(true);

      // Sanitize inputs
      const sanitizedReason = sanitizeInput(correctionReason);
      const sanitizedQuery = feedbackMode === 'edit' ? sanitizeInput(correctedQuery) : undefined;

      const correction: UserCorrection = {
        session_id: sessionId,
        query_id: queryId,
        project_id: projectId,
        original_query: originalQuery,
        corrected_query: sanitizedQuery,
        correction_type: feedbackMode === 'edit' ? 'edit' :
                        feedbackMode === 'suggestion' ? 'suggestion' : 'feedback',
        feedback_score: feedbackMode === 'rating' ? -1 : undefined,
        correction_reason: sanitizedReason,
        context: {
          original_result: generatedResult,
          correction_timestamp: Date.now(),
          user_agent: navigator.userAgent,
          feedback_mode: feedbackMode
        },
        confidence: 0.8,
        metadata: {
          ui_source: 'correction_feedback_component',
          feedback_mode: feedbackMode,
          input_length: sanitizedReason.length,
          query_length: sanitizedQuery?.length || 0
        }
      };

      const result = await invoke('ai_engine_request', {
        method: 'correction.submit',
        params: correction
      });

      if (result && result.success) {
        setFeedbackSubmitted(true);
        setFeedbackMode('none');
        setCorrectionReason('');
        setCorrectedQuery(generatedResult);
        onCorrection?.(correction);
      } else {
        const errorMessage = result?.error || 'Unknown error occurred';
        setError(`Failed to submit correction: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error submitting correction:', error);
      setError('Network error: Failed to submit correction. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    feedbackMode, correctionReason, correctedQuery, sessionId, queryId, projectId,
    originalQuery, generatedResult, onCorrection, validateInput, sanitizeInput
  ]);

  const handleCancel = useCallback(() => {
    setFeedbackMode('none');
    setCorrectionReason('');
    setCorrectedQuery(generatedResult);
  }, [generatedResult]);

  if (feedbackSubmitted) {
    return (
      <div className={`correction-feedback submitted ${className}`}>
        <div className="feedback-success">
          <span className="success-icon">✓</span>
          <span className="success-text">Thank you for your feedback!</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`correction-feedback ${className}`}>
      <div className="feedback-header">
        <span className="feedback-label">How was this response?</span>
      </div>

      <div className="feedback-buttons" role="group" aria-label="Feedback options">
        <button
          className="feedback-btn thumbs-up"
          onClick={handleThumbsUp}
          disabled={isSubmitting}
          title="This response was helpful"
          aria-label="Mark response as helpful"
        >
          👍
        </button>
        <button
          className="feedback-btn thumbs-down"
          onClick={handleThumbsDown}
          disabled={isSubmitting}
          title="This response needs improvement"
          aria-label="Mark response as needing improvement"
        >
          👎
        </button>
        <button
          className="feedback-btn edit-button"
          onClick={handleEditMode}
          disabled={isSubmitting}
          title="Edit and improve this query"
          aria-label="Edit and improve this query"
        >
          ✏️ Improve
        </button>
        <button
          className="feedback-btn suggestion-button"
          onClick={handleSuggestionMode}
          disabled={isSubmitting}
          title="Suggest improvements"
          aria-label="Provide suggestions for improvement"
        >
          💡 Suggest
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message" role="alert" aria-live="polite">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="validation-errors" role="alert" aria-live="polite">
          <ul>
            {validationErrors.map((error, index) => (
              <li key={index} className="validation-error">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedbackMode === 'rating' && (
        <div className="feedback-form">
          <div className="form-header">
            <span className="form-title">What could be improved?</span>
          </div>
          <textarea
            ref={textareaRef}
            className="feedback-textarea"
            placeholder="Please describe what was wrong or how it could be improved..."
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            rows={3}
            maxLength={1000}
            aria-label="Feedback description"
            aria-describedby="feedback-help"
            aria-invalid={validationErrors.length > 0}
          />
          <div id="feedback-help" className="input-help">
            {1000 - correctionReason.length} characters remaining
          </div>
          <div className="form-actions">
            <button 
              className="btn-secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              className="btn-primary"
              onClick={handleSubmitCorrection}
              disabled={isSubmitting || !correctionReason.trim()}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      )}

      {feedbackMode === 'edit' && (
        <div className="correction-editor">
          <div className="form-header">
            <span className="form-title">Edit the query to improve it:</span>
          </div>
          <textarea
            ref={correctionTextareaRef}
            className="correction-textarea"
            value={correctedQuery}
            onChange={(e) => setCorrectedQuery(e.target.value)}
            rows={6}
            maxLength={10000}
            placeholder="Edit the SQL query..."
            aria-label="Corrected SQL query"
            aria-describedby="query-help"
            aria-invalid={validationErrors.some(e => e.includes('query'))}
          />
          <div id="query-help" className="input-help">
            {10000 - correctedQuery.length} characters remaining
          </div>
          <textarea
            ref={textareaRef}
            className="reason-textarea"
            placeholder="Why did you make this change? (This helps the AI learn)"
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            rows={2}
            maxLength={1000}
            aria-label="Reason for correction"
            aria-describedby="reason-help"
            aria-invalid={validationErrors.some(e => e.includes('required'))}
          />
          <div id="reason-help" className="input-help">
            {1000 - correctionReason.length} characters remaining
          </div>
          <div className="form-actions">
            <button 
              className="btn-secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              className="btn-primary"
              onClick={handleSubmitCorrection}
              disabled={isSubmitting || !correctionReason.trim() || correctedQuery === generatedResult}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Correction'}
            </button>
          </div>
        </div>
      )}

      {feedbackMode === 'suggestion' && (
        <div className="suggestion-form">
          <div className="form-header">
            <span className="form-title">Share your suggestions:</span>
          </div>
          <textarea
            className="suggestion-textarea"
            placeholder="What suggestions do you have for improving this query or the AI's approach?"
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            rows={4}
          />
          <div className="form-actions">
            <button 
              className="btn-secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              className="btn-primary"
              onClick={handleSubmitCorrection}
              disabled={isSubmitting || !correctionReason.trim()}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorrectionFeedback;
