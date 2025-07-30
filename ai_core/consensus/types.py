"""
Consensus Engine Types
Core data structures for the consensus system.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Union
from enum import Enum
import time


class ConsensusStatus(Enum):
    """Status of consensus generation"""
    SUCCESS = "success"
    FAILED = "failed"
    AMBIGUOUS = "ambiguous"
    NO_VALID_RESPONSES = "no_valid_responses"
    TIMEOUT = "timeout"
    ERROR = "error"


class ModelStatus(Enum):
    """Status of individual model execution"""
    SUCCESS = "success"
    TIMEOUT = "timeout"
    ERROR = "error"
    INVALID_RESPONSE = "invalid_response"


@dataclass
class ModelResponse:
    """Response from a single AI model"""
    model_id: str
    content: str
    confidence: float
    execution_time: float
    status: ModelStatus
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    
    @classmethod
    def success(cls, model_id: str, content: str, confidence: float, execution_time: float) -> 'ModelResponse':
        """Create a successful model response"""
        return cls(
            model_id=model_id,
            content=content,
            confidence=confidence,
            execution_time=execution_time,
            status=ModelStatus.SUCCESS
        )
    
    @classmethod
    def error(cls, model_id: str, error_message: str, execution_time: float = 0.0) -> 'ModelResponse':
        """Create an error model response"""
        return cls(
            model_id=model_id,
            content="",
            confidence=0.0,
            execution_time=execution_time,
            status=ModelStatus.ERROR,
            error_message=error_message
        )
    
    @classmethod
    def timeout(cls, model_id: str, execution_time: float) -> 'ModelResponse':
        """Create a timeout model response"""
        return cls(
            model_id=model_id,
            content="",
            confidence=0.0,
            execution_time=execution_time,
            status=ModelStatus.TIMEOUT,
            error_message="Model execution timed out"
        )
    
    @property
    def is_valid(self) -> bool:
        """Check if the response is valid for consensus"""
        return self.status == ModelStatus.SUCCESS and len(self.content.strip()) > 0


@dataclass
class ValidatedResponse:
    """Model response with validation scores"""
    response: ModelResponse
    content_score: float
    similarity_scores: Dict[str, float]  # model_id -> similarity score
    is_valid: bool
    validation_metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def weighted_confidence(self) -> float:
        """Calculate weighted confidence based on content score and model confidence"""
        return (self.response.confidence * 0.7) + (self.content_score * 0.3)


@dataclass
class ConsensusResult:
    """Result of consensus generation process"""
    status: ConsensusStatus
    response: str
    confidence: float
    supporting_models: List[str]
    conflicting_responses: List[str] = field(default_factory=list)
    execution_time: float = 0.0
    reason: Optional[str] = None
    resolution_method: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    
    @classmethod
    def consensus(cls, response: str, confidence: float, supporting_models: List[str], 
                  execution_time: float = 0.0) -> 'ConsensusResult':
        """Create a successful consensus result"""
        return cls(
            status=ConsensusStatus.SUCCESS,
            response=response,
            confidence=confidence,
            supporting_models=supporting_models,
            execution_time=execution_time
        )
    
    @classmethod
    def resolved_consensus(cls, response: str, confidence: float, supporting_models: List[str],
                          resolution_method: str, execution_time: float = 0.0) -> 'ConsensusResult':
        """Create a resolved consensus result"""
        return cls(
            status=ConsensusStatus.SUCCESS,
            response=response,
            confidence=confidence,
            supporting_models=supporting_models,
            resolution_method=resolution_method,
            execution_time=execution_time
        )
    
    @classmethod
    def ambiguous(cls, conflicting_responses: List[str], reason: str, 
                  execution_time: float = 0.0) -> 'ConsensusResult':
        """Create an ambiguous result when consensus cannot be reached"""
        return cls(
            status=ConsensusStatus.AMBIGUOUS,
            response="",
            confidence=0.0,
            supporting_models=[],
            conflicting_responses=conflicting_responses,
            reason=reason,
            execution_time=execution_time
        )
    
    @classmethod
    def no_valid_responses(cls, reason: str = "No valid responses from models", 
                          execution_time: float = 0.0) -> 'ConsensusResult':
        """Create a result when no valid responses are available"""
        return cls(
            status=ConsensusStatus.NO_VALID_RESPONSES,
            response="",
            confidence=0.0,
            supporting_models=[],
            reason=reason,
            execution_time=execution_time
        )
    
    @classmethod
    def timeout(cls, reason: str = "Consensus generation timed out", 
                execution_time: float = 0.0) -> 'ConsensusResult':
        """Create a timeout result"""
        return cls(
            status=ConsensusStatus.TIMEOUT,
            response="",
            confidence=0.0,
            supporting_models=[],
            reason=reason,
            execution_time=execution_time
        )
    
    @classmethod
    def error(cls, reason: str, execution_time: float = 0.0) -> 'ConsensusResult':
        """Create an error result"""
        return cls(
            status=ConsensusStatus.ERROR,
            response="",
            confidence=0.0,
            supporting_models=[],
            reason=reason,
            execution_time=execution_time
        )
    
    @property
    def has_consensus(self) -> bool:
        """Check if consensus was successfully reached"""
        return self.status == ConsensusStatus.SUCCESS
    
    @property
    def is_successful(self) -> bool:
        """Check if the result represents a successful operation"""
        return self.status in [ConsensusStatus.SUCCESS]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON-RPC response"""
        base_dict = {
            'success': self.is_successful,
            'status': self.status.value,
            'response': self.response,
            'confidence': self.confidence,
            'supporting_models': self.supporting_models,
            'conflicting_responses': self.conflicting_responses,
            'execution_time': self.execution_time,
            'reason': self.reason,
            'resolution_method': self.resolution_method,
            'metadata': self.metadata,
            'timestamp': self.timestamp
        }

        # Add thought process data if available
        if hasattr(self, 'thought_process_steps'):
            base_dict['thought_process'] = {
                'steps': [step.to_dict() for step in self.thought_process_steps],
                'model_thoughts': [thought.to_dict() for thought in self.model_thoughts] if hasattr(self, 'model_thoughts') else [],
                'consensus_thought': self.consensus_thought.to_dict() if hasattr(self, 'consensus_thought') and self.consensus_thought else None,
                'resolution_thought': self.resolution_thought.to_dict() if hasattr(self, 'resolution_thought') and self.resolution_thought else None
            }

        return base_dict


@dataclass
class QueryContext:
    """Context information for a consensus query"""
    query: str
    query_type: Optional[str] = None
    priority: int = 0
    timeout: Optional[float] = None
    model_preferences: Dict[str, float] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)


@dataclass
class ThoughtProcessStep:
    """Individual step in the AI's thought process"""
    step_type: str  # "query_initiated", "models_executing", "validation", "consensus", "resolution", "complete"
    timestamp: float
    description: str
    data: Dict[str, Any] = field(default_factory=dict)
    duration_ms: float = 0.0
    progress: float = 0.0  # 0.0 to 1.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'step_type': self.step_type,
            'timestamp': self.timestamp,
            'description': self.description,
            'data': self.data,
            'duration_ms': self.duration_ms,
            'progress': self.progress
        }


@dataclass
class ModelThought:
    """Individual model's contribution to the thought process"""
    model_id: str
    confidence: float
    response_preview: str  # First 100 chars of response
    execution_time: float
    status: ModelStatus
    reasoning_indicators: List[str] = field(default_factory=list)
    similarity_scores: Dict[str, float] = field(default_factory=dict)
    content_score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'model_id': self.model_id,
            'confidence': self.confidence,
            'response_preview': self.response_preview,
            'execution_time': self.execution_time,
            'status': self.status.value,
            'reasoning_indicators': self.reasoning_indicators,
            'similarity_scores': self.similarity_scores,
            'content_score': self.content_score
        }


@dataclass
class ConsensusThought:
    """Detailed information about the consensus process"""
    consensus_score: float
    agreement_level: str  # "strong", "moderate", "weak"
    participating_models: List[str]
    similarity_matrix: Dict[str, Dict[str, float]] = field(default_factory=dict)
    decision_factors: List[str] = field(default_factory=list)
    threshold_met: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'consensus_score': self.consensus_score,
            'agreement_level': self.agreement_level,
            'participating_models': self.participating_models,
            'similarity_matrix': self.similarity_matrix,
            'decision_factors': self.decision_factors,
            'threshold_met': self.threshold_met
        }


@dataclass
class ResolutionThought:
    """Information about conflict resolution process"""
    resolution_method: str
    attempts_made: List[str]
    success_reason: str
    alternative_responses: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'resolution_method': self.resolution_method,
            'attempts_made': self.attempts_made,
            'success_reason': self.success_reason,
            'alternative_responses': self.alternative_responses
        }
