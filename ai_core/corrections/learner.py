"""
Correction Learner
Main orchestrator for learning from user corrections.
"""

import asyncio
import logging
import time
from typing import Dict, Any, List, Optional
from collections import defaultdict
from functools import lru_cache
import weakref

from .types import (
    UserCorrection, CorrectionPattern, CorrectionAnalysis, SessionLearning,
    CorrectionStats, LearningImpact
)
from .analyzer import CorrectionAnalyzer
from .sanitizer import CorrectionSanitizer
from ..memory.types import LearnedPattern, PatternType

logger = logging.getLogger(__name__)


class CorrectionLearner:
    """Main correction learning orchestrator"""
    
    def __init__(self, memory_manager):
        self.memory_manager = memory_manager
        self.analyzer = CorrectionAnalyzer()
        self.sanitizer = CorrectionSanitizer()

        # Session-based learning cache with weak references to prevent memory leaks
        self.session_corrections = defaultdict(list)
        self.session_patterns = defaultdict(list)
        self._session_last_access = defaultdict(float)

        # Learning statistics
        self.learning_stats = CorrectionStats()

        # Performance optimization caches
        self._pattern_cache = {}
        self._pattern_cache_ttl = 300  # 5 minutes
        self._pattern_cache_timestamps = {}

        # Configuration
        self.min_pattern_confidence = 0.6
        self.max_session_corrections = 50
        self.pattern_merge_threshold = 0.8
        self.performance_target_ms = 200  # Target processing time

        # Background cleanup task
        self._cleanup_task = None
        self._start_background_cleanup()
        
    async def process_correction(self, correction: UserCorrection) -> Dict[str, Any]:
        """Process a user correction with performance optimization (<200ms target)"""
        start_time = time.time()

        try:
            # Performance optimization: Run sanitization and pattern retrieval concurrently
            sanitization_task = asyncio.create_task(
                self.sanitizer.sanitize_correction(correction)
            )
            patterns_task = asyncio.create_task(
                self._get_existing_patterns_cached(correction.project_id)
            )

            # Wait for both tasks to complete
            sanitized_correction, existing_patterns = await asyncio.gather(
                sanitization_task, patterns_task
            )

            # Analyze the correction
            analysis = await self.analyzer.analyze_correction(sanitized_correction, existing_patterns)

            # Performance optimization: Run session learning and pattern storage concurrently
            session_task = asyncio.create_task(
                self._apply_session_learning(sanitized_correction, analysis)
            )
            storage_task = asyncio.create_task(
                self._store_correction_patterns_batch(analysis.patterns_extracted)
            )

            # Update session data immediately (no await needed)
            self._update_session_data_sync(correction.session_id, sanitized_correction, analysis.patterns_extracted)

            # Wait for concurrent tasks
            session_impact, stored_patterns = await asyncio.gather(session_task, storage_task)

            # Update statistics asynchronously (fire and forget)
            asyncio.create_task(self._update_learning_stats(sanitized_correction, analysis))

            # Check performance target
            processing_time_ms = (time.time() - start_time) * 1000
            if processing_time_ms > self.performance_target_ms:
                logger.warning(f"Correction processing exceeded target: {processing_time_ms:.1f}ms > {self.performance_target_ms}ms")

            return {
                'success': True,
                'correction_id': sanitized_correction.id,
                'patterns_learned': len(analysis.patterns_extracted),
                'patterns_stored': len(stored_patterns),
                'confidence_score': analysis.confidence_score,
                'session_impact': session_impact,
                'recommendations': analysis.recommended_actions,
                'processing_time_ms': processing_time_ms,
                'learning_metadata': {
                    'similarity_to_existing': analysis.similarity_to_existing,
                    'potential_conflicts': len(analysis.potential_conflicts),
                    'analysis_timestamp': time.time(),
                    'performance_target_met': processing_time_ms <= self.performance_target_ms
                }
            }

        except Exception as e:
            processing_time_ms = (time.time() - start_time) * 1000
            logger.error(f"Error processing correction in {processing_time_ms:.1f}ms: {e}")
            return {
                'success': False,
                'error': str(e),
                'correction_id': correction.id,
                'processing_time_ms': processing_time_ms
            }
    
    async def get_session_learning(self, session_id: str, project_id: str) -> Optional[SessionLearning]:
        """Get session-specific learning data"""
        try:
            # Get from database first
            session_learning = await self.memory_manager.db_manager.get_session_learning(
                session_id, project_id
            )
            
            if session_learning and not session_learning.is_expired():
                return session_learning
            
            # Create new session learning from current session data
            if session_id in self.session_corrections:
                corrections = self.session_corrections[session_id]
                patterns = self.session_patterns[session_id]
                
                learning_data = {
                    'corrections_count': len(corrections),
                    'patterns_count': len(patterns),
                    'recent_corrections': [c.to_dict() for c in corrections[-5:]],  # Last 5
                    'active_patterns': [p.to_dict() for p in patterns if p.confidence > 0.7]
                }
                
                session_learning = SessionLearning(
                    session_id=session_id,
                    project_id=project_id,
                    learning_data=learning_data,
                    corrections_applied=[c.id for c in corrections if c.id],
                    patterns_learned=[p.id for p in patterns if p.id]
                )
                
                # Store in database
                await self.memory_manager.db_manager.store_session_learning(session_learning)
                
                return session_learning
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting session learning: {e}")
            return None
    
    async def apply_session_corrections(self, query: str, session_id: str, 
                                      project_id: str) -> str:
        """Apply session-specific corrections to a query"""
        try:
            session_learning = await self.get_session_learning(session_id, project_id)
            if not session_learning:
                return query
            
            enhanced_query = query
            
            # Apply active patterns from this session
            active_patterns = session_learning.learning_data.get('active_patterns', [])
            
            for pattern_data in active_patterns:
                enhanced_query = await self._apply_pattern_to_query(
                    enhanced_query, pattern_data
                )
            
            return enhanced_query
            
        except Exception as e:
            logger.error(f"Error applying session corrections: {e}")
            return query
    
    async def get_learning_impact(self, session_id: str, project_id: str) -> LearningImpact:
        """Calculate the learning impact for a session"""
        try:
            corrections = self.session_corrections.get(session_id, [])
            patterns = self.session_patterns.get(session_id, [])
            
            # Calculate accuracy improvement (simplified)
            accuracy_improvement = 0.0
            if corrections:
                positive_corrections = sum(1 for c in corrections 
                                         if c.feedback_score and c.feedback_score.value > 0)
                accuracy_improvement = positive_corrections / len(corrections)
            
            # Calculate confidence improvement
            confidence_improvement = 0.0
            if patterns:
                avg_confidence = sum(p.confidence for p in patterns) / len(patterns)
                confidence_improvement = min(avg_confidence, 1.0)
            
            # Calculate user satisfaction (based on feedback)
            user_satisfaction = 0.0
            feedback_corrections = [c for c in corrections if c.feedback_score]
            if feedback_corrections:
                avg_feedback = sum(c.feedback_score.value for c in feedback_corrections) / len(feedback_corrections)
                user_satisfaction = (avg_feedback + 1) / 2  # Normalize to 0-1
            
            # Calculate learning effectiveness
            learning_effectiveness = 0.0
            if corrections:
                learning_effectiveness = len(patterns) / len(corrections)
            
            return LearningImpact(
                session_id=session_id,
                project_id=project_id,
                corrections_count=len(corrections),
                patterns_learned=len(patterns),
                accuracy_improvement=accuracy_improvement,
                confidence_improvement=confidence_improvement,
                user_satisfaction_score=user_satisfaction,
                learning_effectiveness=learning_effectiveness
            )
            
        except Exception as e:
            logger.error(f"Error calculating learning impact: {e}")
            return LearningImpact(
                session_id=session_id,
                project_id=project_id,
                corrections_count=0,
                patterns_learned=0,
                accuracy_improvement=0.0,
                confidence_improvement=0.0,
                user_satisfaction_score=0.0,
                learning_effectiveness=0.0
            )
    
    async def cleanup_expired_sessions(self) -> int:
        """Clean up expired session data"""
        try:
            cleaned_count = 0
            
            # Clean up in-memory session data (older than 1 hour)
            current_time = time.time()
            expired_sessions = []
            
            for session_id, corrections in self.session_corrections.items():
                if corrections:
                    last_correction_time = max(c.timestamp for c in corrections)
                    if current_time - last_correction_time > 3600:  # 1 hour
                        expired_sessions.append(session_id)
            
            for session_id in expired_sessions:
                del self.session_corrections[session_id]
                if session_id in self.session_patterns:
                    del self.session_patterns[session_id]
                cleaned_count += 1
            
            # Clean up database session learning
            db_cleaned = await self.memory_manager.db_manager.cleanup_expired_session_learning()
            cleaned_count += db_cleaned
            
            logger.info(f"Cleaned up {cleaned_count} expired sessions")
            return cleaned_count
            
        except Exception as e:
            logger.error(f"Error cleaning up expired sessions: {e}")
            return 0
    
    async def _get_existing_patterns(self, project_id: str) -> List[CorrectionPattern]:
        """Get existing correction patterns for comparison"""
        try:
            # Get from memory manager (learned patterns)
            learned_patterns = await self.memory_manager.db_manager.get_learned_patterns(project_id)
            
            # Convert to correction patterns for analysis
            correction_patterns = []
            for pattern in learned_patterns:
                if pattern.pattern_type in [PatternType.USER_PREFERENCE, PatternType.QUERY_TEMPLATE]:
                    # Convert to correction pattern format
                    correction_pattern = CorrectionPattern(
                        id=pattern.id,
                        project_id=pattern.project_id,
                        pattern_data=pattern.pattern_data,
                        confidence=pattern.confidence,
                        usage_count=pattern.usage_count,
                        created_at=pattern.created_at,
                        last_applied=pattern.last_used,
                        metadata=pattern.metadata
                    )
                    correction_patterns.append(correction_pattern)
            
            return correction_patterns
            
        except Exception as e:
            logger.error(f"Error getting existing patterns: {e}")
            return []
    
    async def _apply_session_learning(self, correction: UserCorrection, 
                                    analysis: CorrectionAnalysis) -> Dict[str, Any]:
        """Apply immediate session-based learning"""
        try:
            session_id = correction.session_id
            
            # Update session corrections list
            if len(self.session_corrections[session_id]) >= self.max_session_corrections:
                # Remove oldest correction
                self.session_corrections[session_id].pop(0)
            
            # Add patterns to session cache
            high_confidence_patterns = [
                p for p in analysis.patterns_extracted 
                if p.confidence >= self.min_pattern_confidence
            ]
            
            self.session_patterns[session_id].extend(high_confidence_patterns)
            
            return {
                'session_corrections_count': len(self.session_corrections[session_id]),
                'session_patterns_count': len(self.session_patterns[session_id]),
                'high_confidence_patterns': len(high_confidence_patterns),
                'immediate_learning': True
            }
            
        except Exception as e:
            logger.error(f"Error applying session learning: {e}")
            return {'immediate_learning': False, 'error': str(e)}
    
    async def _store_correction_patterns(self, patterns: List[CorrectionPattern]) -> List[int]:
        """Store correction patterns as learned patterns in the database"""
        try:
            stored_ids = []
            
            for pattern in patterns:
                if pattern.confidence >= self.min_pattern_confidence:
                    # Convert to LearnedPattern format
                    learned_pattern = LearnedPattern(
                        project_id=pattern.project_id,
                        pattern_type=PatternType.USER_PREFERENCE,  # Map correction patterns to user preferences
                        pattern_data=pattern.pattern_data,
                        confidence=pattern.confidence,
                        usage_count=1,
                        metadata={
                            **pattern.metadata,
                            'source': 'correction_learning',
                            'correction_pattern_type': pattern.pattern_type.value,
                            'source_corrections': pattern.source_corrections
                        }
                    )
                    
                    # Store in database
                    pattern_id = await self.memory_manager.db_manager.store_learned_pattern(learned_pattern)
                    if pattern_id:
                        stored_ids.append(pattern_id)
                        pattern.id = pattern_id
            
            return stored_ids
            
        except Exception as e:
            logger.error(f"Error storing correction patterns: {e}")
            return []
    
    async def _update_learning_stats(self, correction: UserCorrection, 
                                   analysis: CorrectionAnalysis) -> None:
        """Update learning statistics"""
        try:
            self.learning_stats.total_corrections += 1
            
            # Update corrections by type
            correction_type = correction.correction_type.value
            if correction_type not in self.learning_stats.corrections_by_type:
                self.learning_stats.corrections_by_type[correction_type] = 0
            self.learning_stats.corrections_by_type[correction_type] += 1
            
            # Update patterns learned
            self.learning_stats.patterns_learned += len(analysis.patterns_extracted)
            
            # Update average confidence
            if analysis.confidence_score > 0:
                current_avg = self.learning_stats.average_confidence
                total_corrections = self.learning_stats.total_corrections
                self.learning_stats.average_confidence = (
                    (current_avg * (total_corrections - 1) + analysis.confidence_score) / total_corrections
                )
            
            # Update learning velocity
            if self.learning_stats.total_corrections > 0:
                self.learning_stats.learning_velocity = (
                    self.learning_stats.patterns_learned / self.learning_stats.total_corrections
                )
            
        except Exception as e:
            logger.error(f"Error updating learning stats: {e}")
    
    async def _apply_pattern_to_query(self, query: str, pattern_data: Dict[str, Any]) -> str:
        """Apply a learned pattern to enhance a query"""
        try:
            # This is a simplified implementation
            # In practice, this would be more sophisticated based on pattern type
            
            enhanced_query = query
            
            # Apply terminology preferences
            if 'terminology_preferences' in pattern_data:
                for old_term, new_term in pattern_data['terminology_preferences'].items():
                    if old_term.startswith('table_'):
                        old_table = old_term.replace('table_', '')
                        enhanced_query = enhanced_query.replace(old_table, new_term)
                    elif old_term.startswith('column_'):
                        old_column = old_term.replace('column_', '')
                        enhanced_query = enhanced_query.replace(old_column, new_term)
            
            # Apply style preferences
            if 'style_preferences' in pattern_data:
                style_prefs = pattern_data['style_preferences']
                if style_prefs.get('case_preference') == 'upper':
                    # Convert SQL keywords to uppercase
                    for keyword in self.analyzer.sql_keywords:
                        enhanced_query = enhanced_query.replace(
                            keyword.lower(), keyword.upper()
                        )
            
            return enhanced_query
            
        except Exception as e:
            logger.error(f"Error applying pattern to query: {e}")
            return query

    async def _get_existing_patterns_cached(self, project_id: str) -> List[CorrectionPattern]:
        """Get existing patterns with caching for performance"""
        current_time = time.time()
        cache_key = f"patterns_{project_id}"

        # Check cache validity
        if (cache_key in self._pattern_cache and
            cache_key in self._pattern_cache_timestamps and
            current_time - self._pattern_cache_timestamps[cache_key] < self._pattern_cache_ttl):
            return self._pattern_cache[cache_key]

        # Cache miss - fetch from database
        patterns = await self._get_existing_patterns(project_id)

        # Update cache
        self._pattern_cache[cache_key] = patterns
        self._pattern_cache_timestamps[cache_key] = current_time

        # Cleanup old cache entries
        self._cleanup_pattern_cache()

        return patterns

    def _cleanup_pattern_cache(self):
        """Clean up expired cache entries"""
        current_time = time.time()
        expired_keys = [
            key for key, timestamp in self._pattern_cache_timestamps.items()
            if current_time - timestamp > self._pattern_cache_ttl
        ]

        for key in expired_keys:
            self._pattern_cache.pop(key, None)
            self._pattern_cache_timestamps.pop(key, None)

    async def _store_correction_patterns_batch(self, patterns: List[CorrectionPattern]) -> List[int]:
        """Store patterns in batch for better performance"""
        if not patterns:
            return []

        try:
            # Filter high-confidence patterns
            high_confidence_patterns = [
                p for p in patterns if p.confidence >= self.min_pattern_confidence
            ]

            if not high_confidence_patterns:
                return []

            # Batch convert to LearnedPattern format
            learned_patterns = []
            for pattern in high_confidence_patterns:
                learned_pattern = LearnedPattern(
                    project_id=pattern.project_id,
                    pattern_type=PatternType.USER_PREFERENCE,
                    pattern_data=pattern.pattern_data,
                    confidence=pattern.confidence,
                    usage_count=1,
                    metadata={
                        **pattern.metadata,
                        'source': 'correction_learning',
                        'correction_pattern_type': pattern.pattern_type.value,
                        'source_corrections': pattern.source_corrections
                    }
                )
                learned_patterns.append(learned_pattern)

            # Batch store in database (fallback to individual if batch not available)
            try:
                stored_ids = await self.memory_manager.db_manager.store_learned_patterns_batch(learned_patterns)
            except AttributeError:
                # Fallback to individual storage if batch method doesn't exist
                stored_ids = []
                for pattern in learned_patterns:
                    pattern_id = await self.memory_manager.db_manager.store_learned_pattern(pattern)
                    if pattern_id:
                        stored_ids.append(pattern_id)

            # Update pattern IDs
            for i, pattern_id in enumerate(stored_ids):
                if i < len(high_confidence_patterns) and pattern_id:
                    high_confidence_patterns[i].id = pattern_id

            return stored_ids

        except Exception as e:
            logger.error(f"Error in batch pattern storage: {e}")
            # Fallback to individual storage
            return await self._store_correction_patterns(patterns)

    def _update_session_data_sync(self, session_id: str, correction: UserCorrection, patterns: List[CorrectionPattern]):
        """Update session data synchronously for performance"""
        try:
            # Update last access time
            self._session_last_access[session_id] = time.time()

            # Manage session corrections size
            if len(self.session_corrections[session_id]) >= self.max_session_corrections:
                # Remove oldest corrections (FIFO)
                self.session_corrections[session_id] = self.session_corrections[session_id][-(self.max_session_corrections-1):]

            self.session_corrections[session_id].append(correction)

            # Add high-confidence patterns only
            high_confidence_patterns = [p for p in patterns if p.confidence >= self.min_pattern_confidence]
            self.session_patterns[session_id].extend(high_confidence_patterns)

            # Limit session patterns to prevent memory bloat
            if len(self.session_patterns[session_id]) > 100:
                # Keep only the most recent and highest confidence patterns
                sorted_patterns = sorted(
                    self.session_patterns[session_id],
                    key=lambda p: (p.confidence, getattr(p, 'created_at', 0)),
                    reverse=True
                )
                self.session_patterns[session_id] = sorted_patterns[:100]

        except Exception as e:
            logger.error(f"Error updating session data: {e}")

    def _start_background_cleanup(self):
        """Start background cleanup task"""
        async def cleanup_loop():
            while True:
                try:
                    await asyncio.sleep(300)  # Run every 5 minutes
                    await self._background_cleanup()
                except Exception as e:
                    logger.error(f"Background cleanup error: {e}")

        self._cleanup_task = asyncio.create_task(cleanup_loop())

    async def _background_cleanup(self):
        """Background cleanup of expired data"""
        try:
            current_time = time.time()

            # Clean up expired sessions (older than 1 hour)
            expired_sessions = [
                session_id for session_id, last_access in self._session_last_access.items()
                if current_time - last_access > 3600
            ]

            for session_id in expired_sessions:
                self.session_corrections.pop(session_id, None)
                self.session_patterns.pop(session_id, None)
                self._session_last_access.pop(session_id, None)

            # Clean up pattern cache
            self._cleanup_pattern_cache()

            if expired_sessions:
                logger.info(f"Background cleanup removed {len(expired_sessions)} expired sessions")

        except Exception as e:
            logger.error(f"Background cleanup error: {e}")

    def __del__(self):
        """Cleanup when object is destroyed"""
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
