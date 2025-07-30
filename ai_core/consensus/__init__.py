"""
Consensus Engine Package
Core anti-hallucination system using multiple AI models for trustworthy responses.
"""

from .engine import ConsensusEngine
from .config import ConsensusConfig
from .types import ConsensusResult, ModelResponse, ValidatedResponse
from .validator import ResponseValidator
from .scorer import ConfidenceScorer
from .resolver import ConflictResolver

__all__ = [
    'ConsensusEngine',
    'ConsensusConfig', 
    'ConsensusResult',
    'ModelResponse',
    'ValidatedResponse',
    'ResponseValidator',
    'ConfidenceScorer',
    'ConflictResolver'
]
