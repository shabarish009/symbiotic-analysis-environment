"""
Correction Learning System
AI learning from user corrections and feedback during sessions.
"""

from .types import (
    UserCorrection, CorrectionType, CorrectionFeedback,
    CorrectionPattern, SessionLearning
)
from .learner import CorrectionLearner
from .analyzer import CorrectionAnalyzer
from .sanitizer import CorrectionSanitizer
from .manager import CorrectionManager

__all__ = [
    'UserCorrection',
    'CorrectionType', 
    'CorrectionFeedback',
    'CorrectionPattern',
    'SessionLearning',
    'CorrectionLearner',
    'CorrectionAnalyzer',
    'CorrectionSanitizer',
    'CorrectionManager'
]
