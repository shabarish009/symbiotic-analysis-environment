"""
Correction-Aware Consensus Engine
Enhanced consensus engine that learns from user corrections.
"""

import asyncio
import logging
import time
import uuid
from typing import Dict, Any, List, Optional

from .engine import ConsensusEngine, ConsensusConfig, ConsensusResult
from ..corrections import CorrectionLearner, UserCorrection, CorrectionType, FeedbackScore
from ..memory.types import QueryContext

logger = logging.getLogger(__name__)


class CorrectionAwareConsensusEngine(ConsensusEngine):
    """Enhanced consensus engine with correction learning capabilities"""
    
    def __init__(self, config: ConsensusConfig, memory_manager):
        super().__init__(config, memory_manager)
        self.correction_learner = CorrectionLearner(memory_manager)
        self.session_corrections = {}
        self.query_tracking = {}  # Track queries for potential correction

        # Performance and reliability settings
        self.max_query_tracking = 1000
        self.max_session_corrections = 100
        self.cleanup_interval = 3600  # 1 hour
        self.last_cleanup = time.time()

        # Circuit breaker for correction learning failures
        self.correction_failure_count = 0
        self.max_correction_failures = 5
        self.correction_circuit_open = False
        self.circuit_reset_time = 300  # 5 minutes
        
    async def process_query_with_corrections(self, query: str, session_id: str,
                                           project_id: str, context: Optional[QueryContext] = None) -> ConsensusResult:
        """Process query with real-time correction learning and robust error handling"""
        query_id = str(uuid.uuid4())
        start_time = time.time()

        try:
            # Periodic cleanup check
            await self._periodic_cleanup()

            # Check circuit breaker
            if self.correction_circuit_open:
                if time.time() - self.circuit_reset_time > 300:  # 5 minutes
                    self.correction_circuit_open = False
                    self.correction_failure_count = 0
                    logger.info("Correction learning circuit breaker reset")
                else:
                    # Circuit open - use standard processing
                    logger.warning("Correction learning circuit breaker open, using standard processing")
                    result = await super().process_query(query, context, project_id)
                    result.metadata['correction_circuit_open'] = True
                    return result

            # Step 1: Get correction-enhanced context (with timeout)
            try:
                enhanced_context = await asyncio.wait_for(
                    self._get_correction_enhanced_context(query, session_id, project_id, context),
                    timeout=2.0  # 2 second timeout
                )
            except asyncio.TimeoutError:
                logger.warning("Context enhancement timed out, using original context")
                enhanced_context = context or QueryContext()
            except Exception as e:
                logger.warning(f"Context enhancement failed: {e}, using original context")
                enhanced_context = context or QueryContext()

            # Step 2: Apply session-specific correction patterns (with timeout)
            enhanced_query = query
            try:
                enhanced_query = await asyncio.wait_for(
                    self.correction_learner.apply_session_corrections(query, session_id, project_id),
                    timeout=1.0  # 1 second timeout
                )
            except asyncio.TimeoutError:
                logger.warning("Session correction application timed out, using original query")
            except Exception as e:
                logger.warning(f"Session correction application failed: {e}, using original query")

            # Step 3: Generate consensus with correction awareness
            result = await super().process_query(enhanced_query, enhanced_context, project_id)

            # Step 4: Track query for potential correction (async, non-blocking)
            asyncio.create_task(
                self._track_query_for_correction_safe(query_id, query, result, session_id, project_id)
            )

            # Step 5: Enhance result with correction metadata
            processing_time = time.time() - start_time
            result.metadata.update({
                'query_id': query_id,
                'session_id': session_id,
                'correction_enhanced': enhanced_query != query,
                'session_corrections_applied': len(self.session_corrections.get(session_id, [])),
                'correction_learning_enabled': not self.correction_circuit_open,
                'correction_processing_time': processing_time,
                'enhanced_query_used': enhanced_query if enhanced_query != query else None
            })

            # Reset failure count on success
            if self.correction_failure_count > 0:
                self.correction_failure_count = max(0, self.correction_failure_count - 1)

            return result

        except Exception as e:
            processing_time = time.time() - start_time
            logger.error(f"Error in correction-aware query processing after {processing_time:.2f}s: {e}")

            # Increment failure count and potentially open circuit breaker
            self.correction_failure_count += 1
            if self.correction_failure_count >= self.max_correction_failures:
                self.correction_circuit_open = True
                self.circuit_reset_time = time.time()
                logger.error("Correction learning circuit breaker opened due to repeated failures")

            # Fallback to standard processing
            try:
                result = await super().process_query(query, context, project_id)
                result.metadata.update({
                    'query_id': query_id,
                    'correction_fallback_used': True,
                    'correction_error': str(e),
                    'processing_time': processing_time
                })
                return result
            except Exception as fallback_error:
                logger.error(f"Fallback processing also failed: {fallback_error}")
                raise
    
    async def apply_user_correction(self, correction: UserCorrection) -> Dict[str, Any]:
        """Apply user correction and learn from it"""
        try:
            # Step 1: Process correction through learning engine
            learning_result = await self.correction_learner.process_correction(correction)
            
            if not learning_result['success']:
                return {
                    'success': False,
                    'error': learning_result.get('error', 'Unknown error'),
                    'correction_id': correction.id
                }
            
            # Step 2: Update session-specific learning
            session_id = correction.session_id
            if session_id not in self.session_corrections:
                self.session_corrections[session_id] = []
            self.session_corrections[session_id].append(correction)
            
            # Step 3: Regenerate query with corrections applied (if applicable)
            improved_result = None
            if correction.correction_type != CorrectionType.FEEDBACK:
                improved_result = await self._regenerate_with_corrections(correction)
            
            # Step 4: Update query tracking
            if correction.query_id in self.query_tracking:
                self.query_tracking[correction.query_id]['corrected'] = True
                self.query_tracking[correction.query_id]['correction_applied'] = time.time()
            
            return {
                'success': True,
                'correction_id': correction.id,
                'patterns_learned': learning_result.get('patterns_learned', 0),
                'confidence_improvement': learning_result.get('confidence_score', 0.0),
                'session_impact': learning_result.get('session_impact', {}),
                'improved_query': improved_result.response if improved_result else None,
                'improved_confidence': improved_result.confidence if improved_result else None,
                'learning_applied': True,
                'recommendations': learning_result.get('recommendations', [])
            }
            
        except Exception as e:
            logger.error(f"Error applying user correction: {e}")
            return {
                'success': False,
                'error': str(e),
                'correction_id': correction.id
            }
    
    async def submit_feedback(self, query_id: str, feedback_score: FeedbackScore, 
                            feedback_text: str = "", session_id: str = "", 
                            project_id: str = "") -> Dict[str, Any]:
        """Submit user feedback for a query"""
        try:
            # Get original query from tracking
            if query_id not in self.query_tracking:
                return {
                    'success': False,
                    'error': 'Query not found in tracking system'
                }
            
            tracked_query = self.query_tracking[query_id]
            
            # Create feedback correction
            feedback_correction = UserCorrection(
                session_id=session_id,
                query_id=query_id,
                project_id=project_id,
                original_query=tracked_query['original_query'],
                correction_type=CorrectionType.FEEDBACK,
                feedback_score=feedback_score,
                correction_reason=feedback_text,
                context=tracked_query.get('context', {}),
                metadata={
                    'original_confidence': tracked_query.get('confidence', 0.0),
                    'execution_time': tracked_query.get('execution_time', 0.0),
                    'feedback_timestamp': time.time()
                }
            )
            
            # Apply the feedback correction
            return await self.apply_user_correction(feedback_correction)
            
        except Exception as e:
            logger.error(f"Error submitting feedback: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_correction_impact(self, session_id: str, project_id: str) -> Dict[str, Any]:
        """Get correction learning impact for session"""
        try:
            learning_impact = await self.correction_learner.get_learning_impact(session_id, project_id)
            
            return {
                'success': True,
                'session_id': session_id,
                'corrections_count': learning_impact.corrections_count,
                'patterns_learned': learning_impact.patterns_learned,
                'accuracy_improvement': learning_impact.accuracy_improvement,
                'confidence_improvement': learning_impact.confidence_improvement,
                'user_satisfaction': learning_impact.user_satisfaction_score,
                'learning_effectiveness': learning_impact.learning_effectiveness,
                'session_corrections': len(self.session_corrections.get(session_id, [])),
                'tracked_queries': len([q for q in self.query_tracking.values() 
                                      if q.get('session_id') == session_id])
            }
            
        except Exception as e:
            logger.error(f"Error getting correction impact: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_learning_progress(self, project_id: str) -> Dict[str, Any]:
        """Get learning progress and effectiveness metrics"""
        try:
            # Get correction statistics
            from ..corrections.manager import CorrectionManager
            correction_manager = CorrectionManager(self.memory_manager.db_manager)
            stats = await correction_manager.get_correction_statistics(project_id)
            
            # Get recent corrections
            recent_corrections = await correction_manager.get_corrections_for_project(project_id, 20)
            
            # Calculate learning trends
            learning_trends = self._calculate_learning_trends(recent_corrections)
            
            return {
                'success': True,
                'project_id': project_id,
                'statistics': stats.to_dict(),
                'learning_trends': learning_trends,
                'recent_corrections_count': len(recent_corrections),
                'active_sessions': len(self.session_corrections),
                'tracked_queries': len(self.query_tracking)
            }
            
        except Exception as e:
            logger.error(f"Error getting learning progress: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def cleanup_session_data(self, session_id: str) -> None:
        """Clean up session-specific data"""
        try:
            # Remove from session corrections
            if session_id in self.session_corrections:
                del self.session_corrections[session_id]
            
            # Remove from query tracking
            to_remove = [qid for qid, data in self.query_tracking.items() 
                        if data.get('session_id') == session_id]
            for qid in to_remove:
                del self.query_tracking[qid]
            
            # Clean up correction learner session data
            await self.correction_learner.cleanup_expired_sessions()
            
            logger.debug(f"Cleaned up session data for: {session_id}")
            
        except Exception as e:
            logger.error(f"Error cleaning up session data: {e}")
    
    async def _get_correction_enhanced_context(self, query: str, session_id: str, 
                                             project_id: str, context: Optional[QueryContext]) -> QueryContext:
        """Get context enhanced with correction learning"""
        try:
            # Get base context
            base_context = context or QueryContext()
            
            # Get session learning data
            session_learning = await self.correction_learner.get_session_learning(session_id, project_id)
            
            if session_learning:
                # Add session-specific context
                base_context.metadata.update({
                    'session_corrections_count': len(session_learning.corrections_applied),
                    'session_patterns_count': len(session_learning.patterns_learned),
                    'session_learning_data': session_learning.learning_data
                })
                
                # Add recent correction patterns to context
                recent_patterns = session_learning.learning_data.get('active_patterns', [])
                if recent_patterns:
                    base_context.metadata['recent_correction_patterns'] = recent_patterns[:5]  # Last 5
            
            return base_context
            
        except Exception as e:
            logger.error(f"Error enhancing context with corrections: {e}")
            return context or QueryContext()
    
    async def _track_query_for_correction(self, query_id: str, query: str, result: ConsensusResult,
                                        session_id: str, project_id: str) -> None:
        """Track query for potential correction"""
        try:
            self.query_tracking[query_id] = {
                'original_query': query,
                'result': result.response,
                'confidence': result.confidence,
                'execution_time': result.execution_time,
                'timestamp': time.time(),
                'session_id': session_id,
                'project_id': project_id,
                'corrected': False,
                'context': result.metadata
            }
            
            # Limit tracking size (keep last 1000 queries)
            if len(self.query_tracking) > 1000:
                # Remove oldest entries
                oldest_queries = sorted(self.query_tracking.items(), 
                                      key=lambda x: x[1]['timestamp'])[:100]
                for qid, _ in oldest_queries:
                    del self.query_tracking[qid]
            
        except Exception as e:
            logger.error(f"Error tracking query: {e}")
    
    async def _regenerate_with_corrections(self, correction: UserCorrection) -> Optional[ConsensusResult]:
        """Regenerate query with corrections applied"""
        try:
            if not correction.corrected_query:
                return None
            
            # Get enhanced context for regeneration
            enhanced_context = await self._get_correction_enhanced_context(
                correction.corrected_query, correction.session_id, correction.project_id, None
            )
            
            # Process the corrected query
            result = await super().process_query(
                correction.corrected_query, enhanced_context, correction.project_id
            )
            
            # Mark as correction-generated
            result.metadata.update({
                'generated_from_correction': True,
                'original_query': correction.original_query,
                'correction_type': correction.correction_type.value,
                'correction_confidence': correction.confidence
            })
            
            return result
            
        except Exception as e:
            logger.error(f"Error regenerating with corrections: {e}")
            return None
    
    def _calculate_learning_trends(self, recent_corrections: List) -> Dict[str, Any]:
        """Calculate learning trends from recent corrections"""
        try:
            if not recent_corrections:
                return {
                    'trend': 'no_data',
                    'correction_velocity': 0.0,
                    'confidence_trend': 'stable',
                    'feedback_trend': 'neutral'
                }
            
            # Calculate correction velocity (corrections per day)
            if len(recent_corrections) > 1:
                time_span = recent_corrections[0].timestamp - recent_corrections[-1].timestamp
                days = max(time_span / 86400, 1)  # At least 1 day
                correction_velocity = len(recent_corrections) / days
            else:
                correction_velocity = 0.0
            
            # Calculate confidence trend
            confidences = [c.confidence for c in recent_corrections if c.confidence > 0]
            if len(confidences) >= 3:
                recent_avg = sum(confidences[:len(confidences)//2]) / (len(confidences)//2)
                older_avg = sum(confidences[len(confidences)//2:]) / (len(confidences) - len(confidences)//2)
                
                if recent_avg > older_avg + 0.1:
                    confidence_trend = 'improving'
                elif recent_avg < older_avg - 0.1:
                    confidence_trend = 'declining'
                else:
                    confidence_trend = 'stable'
            else:
                confidence_trend = 'insufficient_data'
            
            # Calculate feedback trend
            feedback_scores = [c.feedback_score.value for c in recent_corrections 
                             if c.feedback_score is not None]
            if feedback_scores:
                avg_feedback = sum(feedback_scores) / len(feedback_scores)
                if avg_feedback > 0.3:
                    feedback_trend = 'positive'
                elif avg_feedback < -0.3:
                    feedback_trend = 'negative'
                else:
                    feedback_trend = 'neutral'
            else:
                feedback_trend = 'no_feedback'
            
            return {
                'trend': 'active' if correction_velocity > 0.1 else 'low_activity',
                'correction_velocity': correction_velocity,
                'confidence_trend': confidence_trend,
                'feedback_trend': feedback_trend,
                'total_corrections': len(recent_corrections),
                'avg_confidence': sum(confidences) / len(confidences) if confidences else 0.0
            }
            
        except Exception as e:
            logger.error(f"Error calculating learning trends: {e}")
            return {'trend': 'error', 'error': str(e)}

    async def _track_query_for_correction_safe(self, query_id: str, query: str, result: ConsensusResult,
                                             session_id: str, project_id: str) -> None:
        """Safe query tracking with error handling"""
        try:
            await self._track_query_for_correction(query_id, query, result, session_id, project_id)
        except Exception as e:
            logger.error(f"Error in safe query tracking: {e}")

    async def _periodic_cleanup(self) -> None:
        """Perform periodic cleanup of expired data"""
        current_time = time.time()

        if current_time - self.last_cleanup < self.cleanup_interval:
            return

        try:
            # Clean up old query tracking
            if len(self.query_tracking) > self.max_query_tracking:
                # Remove oldest 20% of entries
                sorted_queries = sorted(
                    self.query_tracking.items(),
                    key=lambda x: x[1]['timestamp']
                )
                to_remove = sorted_queries[:len(sorted_queries) // 5]
                for qid, _ in to_remove:
                    del self.query_tracking[qid]

                logger.info(f"Cleaned up {len(to_remove)} old query tracking entries")

            # Clean up old session corrections
            for session_id, corrections in list(self.session_corrections.items()):
                if len(corrections) > self.max_session_corrections:
                    # Keep only the most recent corrections
                    self.session_corrections[session_id] = corrections[-self.max_session_corrections:]

                # Remove sessions with no recent activity (older than 2 hours)
                if corrections:
                    last_activity = max(getattr(c, 'timestamp', 0) for c in corrections)
                    if current_time - last_activity > 7200:  # 2 hours
                        del self.session_corrections[session_id]

            # Clean up correction learner
            await self.correction_learner.cleanup_expired_sessions()

            self.last_cleanup = current_time

        except Exception as e:
            logger.error(f"Error in periodic cleanup: {e}")

    async def get_system_health(self) -> Dict[str, Any]:
        """Get system health metrics for monitoring"""
        try:
            current_time = time.time()

            # Calculate memory usage
            query_tracking_size = len(self.query_tracking)
            session_corrections_size = sum(len(corrections) for corrections in self.session_corrections.values())

            # Calculate activity metrics
            recent_queries = sum(
                1 for data in self.query_tracking.values()
                if current_time - data['timestamp'] < 3600  # Last hour
            )

            recent_corrections = sum(
                len([c for c in corrections if current_time - getattr(c, 'timestamp', 0) < 3600])
                for corrections in self.session_corrections.values()
            )

            return {
                'system_status': 'healthy' if not self.correction_circuit_open else 'degraded',
                'correction_circuit_open': self.correction_circuit_open,
                'correction_failure_count': self.correction_failure_count,
                'memory_usage': {
                    'query_tracking_entries': query_tracking_size,
                    'session_corrections_total': session_corrections_size,
                    'active_sessions': len(self.session_corrections)
                },
                'activity_metrics': {
                    'recent_queries_1h': recent_queries,
                    'recent_corrections_1h': recent_corrections,
                    'queries_per_minute': recent_queries / 60 if recent_queries > 0 else 0
                },
                'performance_metrics': {
                    'last_cleanup': self.last_cleanup,
                    'cleanup_interval': self.cleanup_interval,
                    'max_query_tracking': self.max_query_tracking
                },
                'timestamp': current_time
            }

        except Exception as e:
            logger.error(f"Error getting system health: {e}")
            return {
                'system_status': 'error',
                'error': str(e),
                'timestamp': time.time()
            }
