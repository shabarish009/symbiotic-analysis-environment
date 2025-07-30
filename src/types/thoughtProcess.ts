/**
 * Thought Process Types
 * TypeScript definitions for AI thought process data structures
 */

export interface ThoughtProcessStep {
  step_type: 'query_initiated' | 'models_executing' | 'validation' | 'consensus' | 'resolution' | 'complete';
  timestamp: number;
  description: string;
  data: Record<string, any>;
  duration_ms: number;
  progress: number; // 0.0 to 1.0
}

export interface ModelThought {
  model_id: string;
  confidence: number;
  response_preview: string;
  execution_time: number;
  status: 'success' | 'timeout' | 'error' | 'invalid_response';
  reasoning_indicators: string[];
  similarity_scores: Record<string, number>;
  content_score: number;
}

export interface ConsensusThought {
  consensus_score: number;
  agreement_level: 'strong' | 'moderate' | 'weak';
  participating_models: string[];
  similarity_matrix: Record<string, Record<string, number>>;
  decision_factors: string[];
  threshold_met: boolean;
}

export interface ResolutionThought {
  resolution_method: string;
  attempts_made: string[];
  success_reason: string;
  alternative_responses: string[];
}

export interface ThoughtProcess {
  steps: ThoughtProcessStep[];
  model_thoughts: ModelThought[];
  consensus_thought: ConsensusThought | null;
  resolution_thought: ResolutionThought | null;
}

export interface ThoughtProcessUpdate {
  type: 'query_started' | 'step_update' | 'model_thoughts' | 'consensus_thought' | 'resolution_thought' | 'query_completed' | 'error';
  query_id: string;
  timestamp: number;
  data?: any;
  step?: ThoughtProcessStep;
  model_thoughts?: ModelThought[];
  consensus_thought?: ConsensusThought;
  resolution_thought?: ResolutionThought;
  final_result?: any;
  total_duration?: number;
  error_message?: string;
  error_type?: string;
  query_progress?: number;
}

export interface QueryData {
  query_id: string;
  query: string;
  expected_steps: string[];
  start_time: number;
  current_step: string;
  progress: number;
  steps: ThoughtProcessStep[];
  end_time?: number;
  total_duration?: number;
  final_result?: any;
  completed?: boolean;
}

export interface ThoughtProcessHistory {
  success: boolean;
  history: QueryData[];
  count: number;
}

export interface ThoughtProcessSubscription {
  success: boolean;
  subscriber_id?: string;
  message?: string;
  error?: string;
}

// UI-specific types
export interface ThoughtProcessDisplayProps {
  isVisible: boolean;
  onToggleVisibility: () => void;
  currentQuery?: QueryData;
  thoughtProcess?: ThoughtProcess;
}

export interface ModelParticipationViewProps {
  models: ModelThought[];
  isLoading?: boolean;
}

export interface ConsensusVisualizationProps {
  consensus: ConsensusThought | null;
  isLoading?: boolean;
}

export interface ConfidenceScoreDisplayProps {
  score: number;
  agreementLevel: 'strong' | 'moderate' | 'weak';
  isLoading?: boolean;
}

export interface ResolutionMethodIndicatorProps {
  method: string;
  attempts: string[];
  successReason: string;
}

export interface ExecutionMetricsDisplayProps {
  metrics: {
    execution_time?: number;
    total_duration?: number;
    models_count?: number;
    valid_responses?: number;
  };
}

export interface ProgressIndicatorProps {
  currentStep: string;
  progress: number;
  expectedSteps: string[];
}

// Utility types for step formatting
export const STEP_LABELS: Record<string, string> = {
  'query_initiated': 'Query Initiated',
  'models_executing': 'Models Executing',
  'validation': 'Validating Responses',
  'consensus': 'Calculating Consensus',
  'resolution': 'Resolving Conflicts',
  'complete': 'Complete'
};

export const STEP_DESCRIPTIONS: Record<string, string> = {
  'query_initiated': 'Starting the consensus process',
  'models_executing': 'Running query on multiple AI models',
  'validation': 'Checking response quality and similarity',
  'consensus': 'Determining agreement between models',
  'resolution': 'Resolving disagreements between models',
  'complete': 'Consensus process finished'
};

export const AGREEMENT_COLORS: Record<string, string> = {
  'strong': '#28a745', // Green
  'moderate': '#ffc107', // Yellow
  'weak': '#dc3545' // Red
};

export const STATUS_COLORS: Record<string, string> = {
  'success': '#28a745',
  'timeout': '#ffc107',
  'error': '#dc3545',
  'invalid_response': '#6c757d'
};

// IMPROVEMENT: Data validation utilities
export const validateThoughtProcessStep = (step: any): step is ThoughtProcessStep => {
  return (
    typeof step === 'object' &&
    step !== null &&
    typeof step.step_type === 'string' &&
    typeof step.timestamp === 'number' &&
    typeof step.description === 'string' &&
    typeof step.data === 'object' &&
    typeof step.duration_ms === 'number' &&
    typeof step.progress === 'number' &&
    step.progress >= 0 &&
    step.progress <= 1
  );
};

export const validateModelThought = (thought: any): thought is ModelThought => {
  return (
    typeof thought === 'object' &&
    thought !== null &&
    typeof thought.model_id === 'string' &&
    typeof thought.confidence === 'number' &&
    typeof thought.response_preview === 'string' &&
    typeof thought.execution_time === 'number' &&
    typeof thought.status === 'string' &&
    Array.isArray(thought.reasoning_indicators) &&
    typeof thought.similarity_scores === 'object' &&
    typeof thought.content_score === 'number' &&
    thought.confidence >= 0 &&
    thought.confidence <= 1 &&
    thought.content_score >= 0 &&
    thought.content_score <= 1
  );
};

export const validateConsensusThought = (consensus: any): consensus is ConsensusThought => {
  return (
    typeof consensus === 'object' &&
    consensus !== null &&
    typeof consensus.consensus_score === 'number' &&
    typeof consensus.agreement_level === 'string' &&
    ['strong', 'moderate', 'weak'].includes(consensus.agreement_level) &&
    Array.isArray(consensus.participating_models) &&
    typeof consensus.similarity_matrix === 'object' &&
    Array.isArray(consensus.decision_factors) &&
    typeof consensus.threshold_met === 'boolean' &&
    consensus.consensus_score >= 0 &&
    consensus.consensus_score <= 1
  );
};

export const validateThoughtProcess = (process: any): process is ThoughtProcess => {
  return (
    typeof process === 'object' &&
    process !== null &&
    Array.isArray(process.steps) &&
    process.steps.every(validateThoughtProcessStep) &&
    Array.isArray(process.model_thoughts) &&
    process.model_thoughts.every(validateModelThought) &&
    (process.consensus_thought === null || validateConsensusThought(process.consensus_thought))
  );
};

// IMPROVEMENT: Safe data access utilities
export const safeGetConfidence = (thoughtProcess?: ThoughtProcess): number => {
  return thoughtProcess?.consensus_thought?.consensus_score ?? 0;
};

export const safeGetAgreementLevel = (thoughtProcess?: ThoughtProcess): 'strong' | 'moderate' | 'weak' => {
  const level = thoughtProcess?.consensus_thought?.agreement_level;
  return ['strong', 'moderate', 'weak'].includes(level as string) ? level as 'strong' | 'moderate' | 'weak' : 'weak';
};

export const safeGetModelCount = (thoughtProcess?: ThoughtProcess): number => {
  return thoughtProcess?.model_thoughts?.length ?? 0;
};

export const safeGetSuccessfulModels = (thoughtProcess?: ThoughtProcess): number => {
  return thoughtProcess?.model_thoughts?.filter(m => m.status === 'success').length ?? 0;
};
