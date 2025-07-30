"""
Memory System Types
Core data structures for the Project Cortex memory system.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Union
from enum import Enum
import time
import json


class PatternType(Enum):
    """Types of learned patterns"""
    QUERY_TEMPLATE = "query_template"
    USER_PREFERENCE = "user_preference"
    SCHEMA_USAGE = "schema_usage"
    QUERY_SIMILARITY = "query_similarity"
    SUCCESS_PATTERN = "success_pattern"


class MemoryStatus(Enum):
    """Status of memory operations"""
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"
    CORRUPTED = "corrupted"
    RECOVERING = "recovering"


@dataclass
class SchemaInfo:
    """Database schema information"""
    schema_name: str
    table_name: str
    columns: Dict[str, Dict[str, Any]]  # column_name -> {type, nullable, default, etc.}
    relationships: List[Dict[str, Any]] = field(default_factory=list)
    indexes: List[Dict[str, Any]] = field(default_factory=list)
    constraints: List[Dict[str, Any]] = field(default_factory=list)
    last_updated: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'schema_name': self.schema_name,
            'table_name': self.table_name,
            'columns': self.columns,
            'relationships': self.relationships,
            'indexes': self.indexes,
            'constraints': self.constraints,
            'last_updated': self.last_updated,
            'metadata': self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SchemaInfo':
        """Create from dictionary"""
        return cls(
            schema_name=data['schema_name'],
            table_name=data['table_name'],
            columns=data['columns'],
            relationships=data.get('relationships', []),
            indexes=data.get('indexes', []),
            constraints=data.get('constraints', []),
            last_updated=data.get('last_updated', time.time()),
            metadata=data.get('metadata', {})
        )


@dataclass
class QueryHistoryEntry:
    """Single query history entry"""
    id: Optional[int] = None
    project_id: str = ""
    query_text: str = ""
    query_hash: str = ""
    context: Dict[str, Any] = field(default_factory=dict)
    consensus_result: Dict[str, Any] = field(default_factory=dict)
    success_score: float = 0.0
    execution_time: float = 0.0
    timestamp: float = field(default_factory=time.time)
    user_feedback: Optional[int] = None  # -1, 0, 1 for negative, neutral, positive
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'query_text': self.query_text,
            'query_hash': self.query_hash,
            'context': self.context,
            'consensus_result': self.consensus_result,
            'success_score': self.success_score,
            'execution_time': self.execution_time,
            'timestamp': self.timestamp,
            'user_feedback': self.user_feedback,
            'metadata': self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'QueryHistoryEntry':
        """Create from dictionary"""
        return cls(
            id=data.get('id'),
            project_id=data.get('project_id', ''),
            query_text=data.get('query_text', ''),
            query_hash=data.get('query_hash', ''),
            context=data.get('context', {}),
            consensus_result=data.get('consensus_result', {}),
            success_score=data.get('success_score', 0.0),
            execution_time=data.get('execution_time', 0.0),
            timestamp=data.get('timestamp', time.time()),
            user_feedback=data.get('user_feedback'),
            metadata=data.get('metadata', {})
        )


@dataclass
class LearnedPattern:
    """Learned pattern from user interactions"""
    id: Optional[int] = None
    project_id: str = ""
    pattern_type: PatternType = PatternType.QUERY_TEMPLATE
    pattern_data: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.0
    usage_count: int = 1
    last_used: float = field(default_factory=time.time)
    created_at: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'pattern_type': self.pattern_type.value,
            'pattern_data': self.pattern_data,
            'confidence': self.confidence,
            'usage_count': self.usage_count,
            'last_used': self.last_used,
            'created_at': self.created_at,
            'metadata': self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'LearnedPattern':
        """Create from dictionary"""
        return cls(
            id=data.get('id'),
            project_id=data.get('project_id', ''),
            pattern_type=PatternType(data.get('pattern_type', PatternType.QUERY_TEMPLATE.value)),
            pattern_data=data.get('pattern_data', {}),
            confidence=data.get('confidence', 0.0),
            usage_count=data.get('usage_count', 1),
            last_used=data.get('last_used', time.time()),
            created_at=data.get('created_at', time.time()),
            metadata=data.get('metadata', {})
        )


@dataclass
class MemoryContext:
    """Context retrieved from memory for query processing"""
    relevant_schemas: List[SchemaInfo] = field(default_factory=list)
    similar_queries: List[QueryHistoryEntry] = field(default_factory=list)
    learned_patterns: List[LearnedPattern] = field(default_factory=list)
    user_preferences: Dict[str, Any] = field(default_factory=dict)
    context_score: float = 0.0
    retrieval_time: float = 0.0
    cache_hit: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'relevant_schemas': [schema.to_dict() for schema in self.relevant_schemas],
            'similar_queries': [query.to_dict() for query in self.similar_queries],
            'learned_patterns': [pattern.to_dict() for pattern in self.learned_patterns],
            'user_preferences': self.user_preferences,
            'context_score': self.context_score,
            'retrieval_time': self.retrieval_time,
            'cache_hit': self.cache_hit,
            'metadata': self.metadata
        }


@dataclass
class MemoryStats:
    """Memory system statistics"""
    project_count: int = 0
    schema_count: int = 0
    query_count: int = 0
    pattern_count: int = 0
    cache_hit_rate: float = 0.0
    avg_retrieval_time: float = 0.0
    database_size_mb: float = 0.0
    last_cleanup: float = 0.0
    health_status: MemoryStatus = MemoryStatus.SUCCESS
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'project_count': self.project_count,
            'schema_count': self.schema_count,
            'query_count': self.query_count,
            'pattern_count': self.pattern_count,
            'cache_hit_rate': self.cache_hit_rate,
            'avg_retrieval_time': self.avg_retrieval_time,
            'database_size_mb': self.database_size_mb,
            'last_cleanup': self.last_cleanup,
            'health_status': self.health_status.value
        }


@dataclass
class ProjectInfo:
    """Project information"""
    id: str
    name: str
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at,
            'last_accessed': self.last_accessed,
            'metadata': self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ProjectInfo':
        """Create from dictionary"""
        return cls(
            id=data['id'],
            name=data['name'],
            created_at=data.get('created_at', time.time()),
            last_accessed=data.get('last_accessed', time.time()),
            metadata=data.get('metadata', {})
        )
