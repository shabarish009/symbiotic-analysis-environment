"""
Correction Learning Types
Data structures for user corrections and learning patterns.
"""

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Any, Optional, List


class CorrectionType(Enum):
    """Types of user corrections"""
    EDIT = "edit"                    # User modified the query
    REPLACEMENT = "replacement"      # User provided completely new query
    REFINEMENT = "refinement"        # User added conditions/clauses
    FEEDBACK = "feedback"            # Thumbs up/down with explanation
    SUGGESTION = "suggestion"        # User suggested improvement


class FeedbackScore(Enum):
    """User feedback scores"""
    NEGATIVE = -1    # Thumbs down
    NEUTRAL = 0      # No feedback or mixed
    POSITIVE = 1     # Thumbs up


class CorrectionPatternType(Enum):
    """Types of patterns learned from corrections"""
    QUERY_STRUCTURE = "query_structure"      # SQL structure preferences
    TERMINOLOGY = "terminology"              # Preferred table/column names
    CONDITIONS = "conditions"                # WHERE clause preferences
    STYLE = "style"                         # Formatting and style preferences
    JOINS = "joins"                         # JOIN pattern preferences
    AGGREGATION = "aggregation"             # GROUP BY/aggregate preferences
    ORDERING = "ordering"                   # ORDER BY preferences
    FILTERING = "filtering"                 # Filter condition preferences


@dataclass
class UserCorrection:
    """Represents a user correction to an AI-generated query"""
    id: Optional[int] = None
    session_id: str = ""
    query_id: str = ""
    project_id: str = ""
    original_query: str = ""
    corrected_query: Optional[str] = None
    correction_type: CorrectionType = CorrectionType.EDIT
    feedback_score: Optional[FeedbackScore] = None
    correction_reason: str = ""
    context: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    applied: bool = False
    confidence: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'query_id': self.query_id,
            'project_id': self.project_id,
            'original_query': self.original_query,
            'corrected_query': self.corrected_query,
            'correction_type': self.correction_type.value,
            'feedback_score': self.feedback_score.value if self.feedback_score else None,
            'correction_reason': self.correction_reason,
            'context': self.context,
            'timestamp': self.timestamp,
            'applied': self.applied,
            'confidence': self.confidence,
            'metadata': self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UserCorrection':
        """Create from dictionary"""
        return cls(
            id=data.get('id'),
            session_id=data.get('session_id', ''),
            query_id=data.get('query_id', ''),
            project_id=data.get('project_id', ''),
            original_query=data.get('original_query', ''),
            corrected_query=data.get('corrected_query'),
            correction_type=CorrectionType(data.get('correction_type', 'edit')),
            feedback_score=FeedbackScore(data['feedback_score']) if data.get('feedback_score') is not None else None,
            correction_reason=data.get('correction_reason', ''),
            context=data.get('context', {}),
            timestamp=data.get('timestamp', time.time()),
            applied=data.get('applied', False),
            confidence=data.get('confidence', 0.0),
            metadata=data.get('metadata', {})
        )


@dataclass
class CorrectionFeedback:
    """User feedback on AI responses"""
    query_id: str
    session_id: str
    project_id: str
    feedback_score: FeedbackScore
    feedback_text: str = ""
    improvement_suggestions: List[str] = field(default_factory=list)
    timestamp: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CorrectionPattern:
    """A learned pattern from user corrections"""
    id: Optional[int] = None
    project_id: str = ""
    pattern_type: CorrectionPatternType = CorrectionPatternType.QUERY_STRUCTURE
    pattern_data: Dict[str, Any] = field(default_factory=dict)
    source_corrections: List[int] = field(default_factory=list)
    confidence: float = 0.0
    usage_count: int = 0
    success_rate: float = 0.0
    created_at: float = field(default_factory=time.time)
    last_applied: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'pattern_type': self.pattern_type.value,
            'pattern_data': self.pattern_data,
            'source_corrections': self.source_corrections,
            'confidence': self.confidence,
            'usage_count': self.usage_count,
            'success_rate': self.success_rate,
            'created_at': self.created_at,
            'last_applied': self.last_applied,
            'metadata': self.metadata
        }


@dataclass
class SessionLearning:
    """Session-specific learning cache"""
    id: Optional[int] = None
    session_id: str = ""
    project_id: str = ""
    learning_data: Dict[str, Any] = field(default_factory=dict)
    corrections_applied: List[int] = field(default_factory=list)
    patterns_learned: List[int] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    expires_at: float = field(default_factory=lambda: time.time() + 3600)  # 1 hour default
    
    def is_expired(self) -> bool:
        """Check if session learning has expired"""
        return time.time() > self.expires_at
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'project_id': self.project_id,
            'learning_data': self.learning_data,
            'corrections_applied': self.corrections_applied,
            'patterns_learned': self.patterns_learned,
            'created_at': self.created_at,
            'expires_at': self.expires_at
        }


@dataclass
class CorrectionAnalysis:
    """Analysis results from a correction"""
    correction_id: int
    patterns_extracted: List[CorrectionPattern]
    confidence_score: float
    similarity_to_existing: float
    potential_conflicts: List[int]
    recommended_actions: List[str]
    analysis_metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LearningImpact:
    """Impact measurement of correction-based learning"""
    session_id: str
    project_id: str
    corrections_count: int
    patterns_learned: int
    accuracy_improvement: float
    confidence_improvement: float
    user_satisfaction_score: float
    learning_effectiveness: float
    timestamp: float = field(default_factory=time.time)


@dataclass
class CorrectionStats:
    """Statistics about correction learning"""
    total_corrections: int = 0
    corrections_by_type: Dict[str, int] = field(default_factory=dict)
    average_confidence: float = 0.0
    patterns_learned: int = 0
    success_rate: float = 0.0
    user_satisfaction: float = 0.0
    learning_velocity: float = 0.0  # Patterns learned per correction
    accuracy_trend: List[float] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'total_corrections': self.total_corrections,
            'corrections_by_type': self.corrections_by_type,
            'average_confidence': self.average_confidence,
            'patterns_learned': self.patterns_learned,
            'success_rate': self.success_rate,
            'user_satisfaction': self.user_satisfaction,
            'learning_velocity': self.learning_velocity,
            'accuracy_trend': self.accuracy_trend
        }
