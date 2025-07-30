"""
Consensus Engine
Main orchestrator for the consensus system.
"""

import asyncio
import time
import uuid
import logging
from typing import List, Dict, Optional

from .types import (
    ConsensusResult, ConsensusStatus, QueryContext, ThoughtProcessStep,
    ModelThought, ConsensusThought, ResolutionThought
)
from .config import ConsensusConfig
from .models import ModelManager
from .validator import ResponseValidator
from .scorer import ConfidenceScorer
from .resolver import ConflictResolver
from .streamer import thought_process_streamer

# Import memory system
from ..memory import MemoryManager, MemoryConfig

logger = logging.getLogger(__name__)


class ConsensusEngine:
    """Main consensus engine that orchestrates the entire consensus process"""

    def __init__(self, config: ConsensusConfig, memory_manager: Optional[MemoryManager] = None):
        self.config = config

        # Initialize components
        self.model_manager = ModelManager(config.get_enabled_models())
        self.validator = ResponseValidator(config)
        self.scorer = ConfidenceScorer(config)
        self.resolver = ConflictResolver(config)

        # Initialize memory system
        self.memory_manager = memory_manager
        
        # IMPROVEMENT: Enhanced performance tracking
        self.query_count = 0
        self.total_execution_time = 0.0
        self.success_count = 0
        self.consensus_count = 0
        self.conflict_resolution_count = 0
        self.timeout_count = 0
        self.error_count = 0
        self.avg_confidence_scores = []
        self.execution_times = []
        
        logger.info(f"Consensus Engine initialized with {len(config.get_enabled_models())} models")
    
    async def process_query(self, query: str, context: Optional[QueryContext] = None,
                           project_id: Optional[str] = None) -> ConsensusResult:
        """Process query through multiple models and return consensus with memory enhancement"""
        start_time = time.time()
        self.query_count += 1
        query_id = str(uuid.uuid4())

        try:
            # SECURITY: Input validation and sanitization
            validation_result = self._validate_query_input(query)
            if not validation_result['valid']:
                logger.warning(f"Query validation failed: {validation_result['reason']}")
                error_result = ConsensusResult.error(
                    reason=f"Invalid query: {validation_result['reason']}",
                    execution_time=time.time() - start_time
                )
                await thought_process_streamer.emit_error(query_id, validation_result['reason'], 'validation')
                return error_result

            # MEMORY ENHANCEMENT: Retrieve relevant context from memory
            enhanced_context = context
            if self.memory_manager and project_id:
                try:
                    memory_context = await self.memory_manager.get_relevant_context(
                        query, project_id, context
                    )
                    enhanced_context = self._enhance_context_with_memory(context, memory_context)
                    logger.debug(f"Enhanced context with memory: score={memory_context.context_score:.3f}")
                except Exception as e:
                    logger.warning(f"Memory context retrieval failed: {e}")
                    # Continue without memory enhancement

            # Sanitize query for logging (prevent log injection)
            safe_query = query.replace('\n', '\\n').replace('\r', '\\r')[:100]
            logger.info(f"Processing query #{self.query_count}: '{safe_query}{'...' if len(query) > 100 else ''}'")

            # Create query context if not provided
            if context is None:
                context = QueryContext(query=query, timeout=self.config.total_timeout)

            # Start thought process streaming
            expected_steps = ['query_initiated', 'models_executing', 'validation', 'consensus', 'complete']
            await thought_process_streamer.start_query_stream(query_id, query, expected_steps)

            # Step 1: Query initiated
            await thought_process_streamer.emit_step(query_id, ThoughtProcessStep(
                step_type='query_initiated',
                timestamp=time.time(),
                description=f"Starting consensus process for query with {len(self.model_manager.get_enabled_models())} models",
                data={'query_length': len(query), 'models_count': len(self.model_manager.get_enabled_models())},
                progress=0.1
            ))
            
            # Step 2: Models executing
            await thought_process_streamer.emit_step(query_id, ThoughtProcessStep(
                step_type='models_executing',
                timestamp=time.time(),
                description="Executing query on multiple AI models in parallel",
                data={'timeout': self.config.model_timeout},
                progress=0.3
            ))

            # Execute parallel queries with timeout
            try:
                responses = await asyncio.wait_for(
                    self.model_manager.execute_parallel_queries(query, context, self.config.model_timeout),
                    timeout=self.config.total_timeout
                )
            except asyncio.TimeoutError:
                execution_time = time.time() - start_time
                logger.warning(f"Query processing timed out after {execution_time:.2f}s")
                timeout_result = ConsensusResult.timeout(
                    reason=f"Query processing timed out after {execution_time:.2f}s",
                    execution_time=execution_time
                )
                await thought_process_streamer.emit_error(query_id, f"Query processing timed out after {execution_time:.2f}s", 'timeout')
                await thought_process_streamer.complete_query_stream(query_id, timeout_result.to_dict())
                return timeout_result
            
            # Step 3: Response validation
            await thought_process_streamer.emit_step(query_id, ThoughtProcessStep(
                step_type='validation',
                timestamp=time.time(),
                description="Validating and analyzing model responses",
                data={'total_responses': len(responses)},
                progress=0.5
            ))

            # Validate responses
            validated_responses = self.validator.validate_responses(responses)

            # Create model thoughts for streaming
            model_thoughts = []
            for vr in validated_responses:
                model_thought = ModelThought(
                    model_id=vr.response.model_id,
                    confidence=vr.response.confidence,
                    response_preview=vr.response.content[:100] + ('...' if len(vr.response.content) > 100 else ''),
                    execution_time=vr.response.execution_time,
                    status=vr.response.status,
                    reasoning_indicators=self._generate_reasoning_indicators(vr),
                    similarity_scores=vr.similarity_scores,
                    content_score=vr.content_score
                )
                model_thoughts.append(model_thought)

            # Emit model thoughts
            await thought_process_streamer.emit_model_thoughts(query_id, model_thoughts)

            # Step 4: Consensus generation
            await thought_process_streamer.emit_step(query_id, ThoughtProcessStep(
                step_type='consensus',
                timestamp=time.time(),
                description="Calculating consensus from validated responses",
                data={'valid_responses': len([vr for vr in validated_responses if vr.is_valid])},
                progress=0.7
            ))

            # Generate consensus with thought process
            consensus = await self._generate_consensus_with_thoughts(query_id, validated_responses)

            # IMPROVEMENT: Enhanced performance metrics tracking
            execution_time = time.time() - start_time
            consensus.execution_time = execution_time
            self.total_execution_time += execution_time
            self.execution_times.append(execution_time)

            # Track different outcome types
            if consensus.is_successful:
                self.success_count += 1
                self.avg_confidence_scores.append(consensus.confidence)

                if consensus.resolution_method:
                    self.conflict_resolution_count += 1
                else:
                    self.consensus_count += 1
            elif consensus.status.value == "timeout":
                self.timeout_count += 1
            else:
                self.error_count += 1

            # MEMORY LEARNING: Learn from the result
            if self.memory_manager and project_id:
                try:
                    await self.memory_manager.learn_from_result(
                        query, project_id, enhanced_context or context, consensus
                    )
                    logger.debug("Stored query result in memory for learning")
                except Exception as e:
                    logger.warning(f"Memory learning failed: {e}")
                    # Continue without memory learning

            # Keep metrics arrays bounded (last 1000 entries)
            if len(self.execution_times) > 1000:
                self.execution_times = self.execution_times[-1000:]
            if len(self.avg_confidence_scores) > 1000:
                self.avg_confidence_scores = self.avg_confidence_scores[-1000:]

            # Step 5: Complete
            await thought_process_streamer.emit_step(query_id, ThoughtProcessStep(
                step_type='complete',
                timestamp=time.time(),
                description=f"Consensus process completed: {consensus.status.value}",
                data={'final_confidence': consensus.confidence, 'execution_time': execution_time},
                progress=1.0
            ))

            # Complete thought process streaming
            await thought_process_streamer.complete_query_stream(query_id, consensus.to_dict())

            logger.info(f"Query #{self.query_count} completed in {execution_time:.2f}s: {consensus.status.value}")
            return consensus
            
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Unexpected error processing query: {e}")
            error_result = ConsensusResult.error(
                reason=f"Unexpected error: {str(e)}",
                execution_time=execution_time
            )

            # IMPROVEMENT: Enhanced error handling with retry logic
            try:
                await thought_process_streamer.emit_error(query_id, str(e), 'unexpected')
                await thought_process_streamer.complete_query_stream(query_id, error_result.to_dict())
            except Exception as stream_error:
                logger.error(f"Failed to emit error to thought process stream: {stream_error}")
                # Continue execution even if streaming fails

            return error_result

    def _generate_reasoning_indicators(self, validated_response) -> List[str]:
        """Generate human-readable reasoning indicators for a model response"""
        indicators = []

        # Content quality indicators
        if validated_response.content_score > 0.8:
            indicators.append("High quality response")
        elif validated_response.content_score > 0.6:
            indicators.append("Good quality response")
        else:
            indicators.append("Lower quality response")

        # Confidence indicators
        if validated_response.response.confidence > 0.8:
            indicators.append("Very confident")
        elif validated_response.response.confidence > 0.6:
            indicators.append("Moderately confident")
        else:
            indicators.append("Less confident")

        # Similarity indicators
        if validated_response.similarity_scores:
            avg_similarity = sum(validated_response.similarity_scores.values()) / len(validated_response.similarity_scores)
            if avg_similarity > 0.7:
                indicators.append("Agrees with other models")
            elif avg_similarity > 0.4:
                indicators.append("Partially agrees with others")
            else:
                indicators.append("Differs from other models")

        # Execution time indicators
        if validated_response.response.execution_time < 1.0:
            indicators.append("Quick response")
        elif validated_response.response.execution_time > 5.0:
            indicators.append("Slow response")

        return indicators
    
    async def _generate_consensus_with_thoughts(self, query_id: str, validated_responses) -> ConsensusResult:
        """Generate consensus with thought process streaming"""
        consensus_result = await self._generate_consensus(validated_responses)

        # Create consensus thought
        valid_responses = [vr for vr in validated_responses if vr.is_valid]
        consensus_score = self.scorer.calculate_consensus_score(valid_responses) if valid_responses else 0.0

        # Determine agreement level
        if consensus_score >= 0.8:
            agreement_level = "strong"
        elif consensus_score >= 0.6:
            agreement_level = "moderate"
        else:
            agreement_level = "weak"

        consensus_thought = ConsensusThought(
            consensus_score=consensus_score,
            agreement_level=agreement_level,
            participating_models=[vr.response.model_id for vr in valid_responses],
            decision_factors=self._generate_decision_factors(valid_responses, consensus_score),
            threshold_met=consensus_score >= self.config.consensus_threshold
        )

        # Emit consensus thought
        await thought_process_streamer.emit_consensus_thought(query_id, consensus_thought)

        # If resolution was used, create resolution thought
        if consensus_result.resolution_method:
            resolution_thought = ResolutionThought(
                resolution_method=consensus_result.resolution_method,
                attempts_made=["majority_consensus", "weighted_consensus", "highest_confidence"],
                success_reason=f"Resolved using {consensus_result.resolution_method}",
                alternative_responses=consensus_result.conflicting_responses[:3]  # Limit to 3
            )
            await thought_process_streamer.emit_resolution_thought(query_id, resolution_thought)

        return consensus_result

    def _generate_decision_factors(self, valid_responses, consensus_score: float) -> List[str]:
        """Generate human-readable decision factors"""
        factors = []

        if len(valid_responses) >= self.config.min_supporting_models:
            factors.append(f"{len(valid_responses)} models provided valid responses")

        if consensus_score >= self.config.consensus_threshold:
            factors.append("Models showed strong agreement")
        else:
            factors.append("Models showed disagreement, conflict resolution applied")

        # Average confidence
        avg_confidence = sum(vr.response.confidence for vr in valid_responses) / len(valid_responses) if valid_responses else 0
        if avg_confidence > 0.7:
            factors.append("Models were generally confident in their responses")

        # Content quality
        avg_quality = sum(vr.content_score for vr in valid_responses) / len(valid_responses) if valid_responses else 0
        if avg_quality > 0.7:
            factors.append("Response quality was high across models")

        return factors

    async def _generate_consensus(self, validated_responses) -> ConsensusResult:
        """Generate consensus from validated responses"""
        valid_responses = [vr for vr in validated_responses if vr.is_valid]
        
        # Check if we have enough valid responses
        if len(valid_responses) == 0:
            logger.warning("No valid responses available for consensus")
            return ConsensusResult.no_valid_responses(
                reason="All model responses were invalid or failed validation"
            )
        
        if len(valid_responses) < self.config.min_supporting_models:
            logger.warning(f"Insufficient valid responses: {len(valid_responses)} < {self.config.min_supporting_models}")
            return ConsensusResult.no_valid_responses(
                reason=f"Only {len(valid_responses)} valid responses, need at least {self.config.min_supporting_models}"
            )
        
        # Calculate consensus score
        consensus_score = self.scorer.calculate_consensus_score(valid_responses)
        
        logger.debug(f"Consensus score: {consensus_score:.3f} (threshold: {self.config.consensus_threshold})")
        
        # Check if we have strong consensus
        if consensus_score >= self.config.consensus_threshold:
            return await self._handle_strong_consensus(valid_responses, consensus_score)
        else:
            return await self._handle_weak_consensus(valid_responses, consensus_score)
    
    async def _handle_strong_consensus(self, valid_responses, consensus_score) -> ConsensusResult:
        """Handle case where strong consensus is achieved"""
        logger.info("Strong consensus achieved")
        
        # Select best response
        best_response = self.scorer.select_best_response(valid_responses)
        
        # Calculate final confidence
        final_confidence = self.scorer.calculate_final_confidence(consensus_score, valid_responses)
        
        # Get supporting models
        supporting_models = [vr.response.model_id for vr in valid_responses]
        
        return ConsensusResult.consensus(
            response=best_response.response.content,
            confidence=final_confidence,
            supporting_models=supporting_models
        )
    
    async def _handle_weak_consensus(self, valid_responses, consensus_score) -> ConsensusResult:
        """Handle case where consensus is weak - attempt conflict resolution"""
        logger.info("Weak consensus detected, attempting conflict resolution")
        
        # Attempt conflict resolution
        resolution = self.resolver.resolve_conflicts(valid_responses)
        
        if resolution.success:
            logger.info(f"Conflict resolved using method: {resolution.method}")
            
            return ConsensusResult.resolved_consensus(
                response=resolution.content,
                confidence=resolution.confidence,
                supporting_models=resolution.supporting_models,
                resolution_method=resolution.method
            )
        else:
            logger.warning("Conflict resolution failed, returning ambiguous result")
            
            # Analyze disagreement for better error reporting
            disagreement_analysis = self.scorer.analyze_disagreement(valid_responses)
            
            conflicting_responses = [vr.response.content for vr in valid_responses]
            
            return ConsensusResult.ambiguous(
                conflicting_responses=conflicting_responses,
                reason=f"Models disagree (consensus score: {consensus_score:.3f}) and conflict resolution failed using method: {resolution.method}"
            )
    
    async def health_check(self) -> Dict[str, any]:
        """Perform comprehensive health check"""
        logger.info("Performing consensus engine health check")
        
        # Check model health
        model_health = await self.model_manager.health_check_all()
        
        # Check system resources and performance
        avg_execution_time = (
            self.total_execution_time / self.query_count 
            if self.query_count > 0 else 0.0
        )
        
        success_rate = (
            self.success_count / self.query_count 
            if self.query_count > 0 else 0.0
        )
        
        # Overall health status
        healthy_models = sum(1 for is_healthy in model_health.values() if is_healthy)
        total_models = len(model_health)
        
        overall_healthy = (
            healthy_models >= self.config.min_supporting_models and
            success_rate >= 0.8  # At least 80% success rate
        )
        
        health_report = {
            'overall_healthy': overall_healthy,
            'models': {
                'total': total_models,
                'healthy': healthy_models,
                'health_details': model_health
            },
            'performance': {
                'total_queries': self.query_count,
                'successful_queries': self.success_count,
                'success_rate': success_rate,
                'avg_execution_time': avg_execution_time
            },
            'configuration': {
                'consensus_threshold': self.config.consensus_threshold,
                'min_supporting_models': self.config.min_supporting_models,
                'model_timeout': self.config.model_timeout,
                'total_timeout': self.config.total_timeout
            }
        }
        
        logger.info(f"Health check complete: {'HEALTHY' if overall_healthy else 'UNHEALTHY'}")
        return health_report
    
    def get_performance_metrics(self) -> Dict[str, any]:
        """Get enhanced performance metrics"""
        import statistics

        base_metrics = {
            'query_count': self.query_count,
            'success_count': self.success_count,
            'consensus_count': self.consensus_count,
            'conflict_resolution_count': self.conflict_resolution_count,
            'timeout_count': self.timeout_count,
            'error_count': self.error_count,
            'success_rate': self.success_count / self.query_count if self.query_count > 0 else 0.0,
            'total_execution_time': self.total_execution_time,
            'avg_execution_time': self.total_execution_time / self.query_count if self.query_count > 0 else 0.0,
        }

        # Enhanced metrics with statistical analysis
        if self.execution_times:
            base_metrics.update({
                'min_execution_time': min(self.execution_times),
                'max_execution_time': max(self.execution_times),
                'median_execution_time': statistics.median(self.execution_times),
                'p95_execution_time': statistics.quantiles(self.execution_times, n=20)[18] if len(self.execution_times) >= 20 else max(self.execution_times),
            })

        if self.avg_confidence_scores:
            base_metrics.update({
                'avg_confidence': statistics.mean(self.avg_confidence_scores),
                'min_confidence': min(self.avg_confidence_scores),
                'max_confidence': max(self.avg_confidence_scores),
                'median_confidence': statistics.median(self.avg_confidence_scores),
            })

        base_metrics['model_info'] = self.model_manager.get_model_info()
        return base_metrics
    
    def reset_metrics(self):
        """Reset performance metrics"""
        self.query_count = 0
        self.total_execution_time = 0.0
        self.success_count = 0
        logger.info("Performance metrics reset")
    
    async def shutdown(self):
        """Gracefully shutdown the consensus engine"""
        logger.info("Shutting down consensus engine")
        
        # Log final performance metrics
        metrics = self.get_performance_metrics()
        logger.info(f"Final metrics: {metrics}")
        
        # In a production system, this would clean up model resources
        logger.info("Consensus engine shutdown complete")

    def _validate_query_input(self, query: str) -> Dict[str, any]:
        """Validate and sanitize query input for security"""
        if not isinstance(query, str):
            return {'valid': False, 'reason': 'Query must be a string'}

        # Check for empty or whitespace-only queries
        if not query or not query.strip():
            return {'valid': False, 'reason': 'Query cannot be empty'}

        # Check query length limits
        if len(query) > 10000:  # 10KB limit
            return {'valid': False, 'reason': 'Query too long (max 10,000 characters)'}

        if len(query.strip()) < 3:
            return {'valid': False, 'reason': 'Query too short (minimum 3 characters)'}

        # Check for potentially malicious content
        dangerous_patterns = [
            '\x00',  # Null bytes
            '\x1a',  # Substitute character
            '<?php',  # PHP injection
            '<script',  # Script injection
            'javascript:',  # JavaScript injection
            'data:',  # Data URI injection
        ]

        query_lower = query.lower()
        for pattern in dangerous_patterns:
            if pattern in query_lower:
                return {'valid': False, 'reason': f'Query contains potentially dangerous content: {pattern}'}

        # Check for excessive special characters (potential injection)
        special_char_count = sum(1 for c in query if not c.isalnum() and not c.isspace() and c not in '.,!?;:-()[]{}')
        if special_char_count > len(query) * 0.3:  # More than 30% special characters
            return {'valid': False, 'reason': 'Query contains excessive special characters'}

        return {'valid': True, 'reason': 'Query is valid'}

    def _enhance_context_with_memory(self, context: Optional[QueryContext],
                                    memory_context) -> QueryContext:
        """Enhance query context with relevant historical information"""
        if not context:
            context = QueryContext()

        # Add schema information
        if memory_context.relevant_schemas:
            if not hasattr(context, 'database_schemas'):
                context.database_schemas = []
            context.database_schemas.extend([
                schema.to_dict() for schema in memory_context.relevant_schemas
            ])

        # Add similar query patterns
        if memory_context.similar_queries:
            if not hasattr(context, 'query_patterns'):
                context.query_patterns = []
            context.query_patterns.extend([
                {
                    'query': query.query_text[:100],
                    'success_score': query.success_score,
                    'execution_time': query.execution_time
                }
                for query in memory_context.similar_queries[:3]  # Limit to top 3
            ])

        # Add learned patterns
        if memory_context.learned_patterns:
            if not hasattr(context, 'learned_patterns'):
                context.learned_patterns = []
            context.learned_patterns.extend([
                {
                    'type': pattern.pattern_type.value,
                    'confidence': pattern.confidence,
                    'data': pattern.pattern_data
                }
                for pattern in memory_context.learned_patterns[:5]  # Limit to top 5
            ])

        # Add user preferences
        if memory_context.user_preferences:
            if not hasattr(context, 'user_preferences'):
                context.user_preferences = {}
            context.user_preferences.update(memory_context.user_preferences)

        # Add memory metadata
        if not hasattr(context, 'memory_context'):
            context.memory_context = {}
        context.memory_context.update({
            'context_score': memory_context.context_score,
            'retrieval_time': memory_context.retrieval_time,
            'cache_hit': memory_context.cache_hit,
            'schemas_count': len(memory_context.relevant_schemas),
            'similar_queries_count': len(memory_context.similar_queries),
            'patterns_count': len(memory_context.learned_patterns)
        })

        return context


class ConsensusHandler:
    """Handles JSON-RPC requests for consensus operations"""
    
    def __init__(self, consensus_engine: ConsensusEngine):
        self.engine = consensus_engine
    
    async def handle_consensus_request(self, params: Dict) -> Dict:
        """Handle JSON-RPC consensus request"""
        try:
            # Validate parameters
            query = params.get('query')
            if not query:
                return self._error_response(-32602, "Missing 'query' parameter")
            
            if not isinstance(query, str) or len(query.strip()) == 0:
                return self._error_response(-32602, "Query must be a non-empty string")
            
            # Optional parameters
            timeout = params.get('timeout')
            priority = params.get('priority', 0)
            project_id = params.get('project_id')  # Optional project ID for memory

            # Create query context
            context = QueryContext(
                query=query,
                timeout=timeout,
                priority=priority
            )

            # Process through consensus engine with memory
            result = await self.engine.process_query(query, context, project_id)
            
            # Return formatted response
            return result.to_dict()
        
        except Exception as e:
            logger.error(f"Consensus request failed: {e}")
            return self._error_response(-32603, f"Internal error: {str(e)}")
    
    async def handle_health_check(self, params: Dict) -> Dict:
        """Handle health check request"""
        try:
            health_report = await self.engine.health_check()
            return {
                'success': True,
                'health': health_report
            }
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return self._error_response(-32603, f"Health check error: {str(e)}")
    
    async def handle_metrics_request(self, params: Dict) -> Dict:
        """Handle performance metrics request"""
        try:
            metrics = self.engine.get_performance_metrics()
            return {
                'success': True,
                'metrics': metrics
            }
        except Exception as e:
            logger.error(f"Metrics request failed: {e}")
            return self._error_response(-32603, f"Metrics error: {str(e)}")
    
    def _error_response(self, code: int, message: str) -> Dict:
        """Create JSON-RPC error response"""
        return {
            'success': False,
            'error': {
                'code': code,
                'message': message
            }
        }
