"""
Local-Aware Consensus Engine
Extends the correction-aware consensus engine to work with local LLMs.
"""

import asyncio
import logging
import time
from typing import Dict, Any, List, Optional

from .correction_aware_engine import CorrectionAwareConsensusEngine
from .types import ConsensusResult, QueryContext
from .config import ConsensusConfig
from ..local_llm.manager import LocalLLMManager
from ..local_llm.inference import InferenceRequest

logger = logging.getLogger(__name__)


class LocalAwareConsensusEngine(CorrectionAwareConsensusEngine):
    """Consensus engine that can use both local and cloud models"""
    
    def __init__(self, config: ConsensusConfig, memory_manager, models_dir: Optional[str] = None):
        super().__init__(config, memory_manager)
        
        # Local LLM integration
        self.local_llm_manager = LocalLLMManager(models_dir)
        self.use_local_models = True
        self.local_fallback_enabled = True
        
        # Performance tracking
        self.local_inference_stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'average_response_time': 0.0,
            'total_response_time': 0.0
        }
        
        logger.info("🏠 Local-Aware Consensus Engine initialized")
    
    async def initialize(self) -> bool:
        """Initialize the local-aware consensus engine"""
        try:
            # Initialize parent
            parent_init = await super().initialize() if hasattr(super(), 'initialize') else True
            
            # Initialize local LLM manager
            local_init = await self.local_llm_manager.initialize()
            
            if local_init:
                logger.info("✅ Local LLM system ready")
                self.use_local_models = True
            else:
                logger.warning("⚠️ Local LLM system failed to initialize - using cloud fallback")
                self.use_local_models = False
            
            return parent_init and (local_init or self.local_fallback_enabled)
            
        except Exception as e:
            logger.error(f"Error initializing Local-Aware Consensus Engine: {e}")
            return False
    
    async def process_query_with_corrections(self, query: str, session_id: str, 
                                           project_id: str, context: Optional[QueryContext] = None) -> ConsensusResult:
        """Process query using local models with correction awareness"""
        start_time = time.time()
        
        try:
            # Check if local models are available
            if self.use_local_models and await self._is_local_system_ready():
                logger.debug("🏠 Using local LLM for query processing")
                result = await self._process_query_local(query, session_id, project_id, context)
                
                # Update local inference stats
                self._update_local_stats(time.time() - start_time, success=True)
                
                # Add local processing metadata
                result.metadata.update({
                    'processing_mode': 'local',
                    'local_model_used': self.local_llm_manager.active_model,
                    'privacy_guaranteed': True,
                    'cost_free': True
                })
                
                return result
            else:
                # Fallback to cloud-based processing
                logger.debug("☁️ Falling back to cloud-based processing")
                result = await super().process_query_with_corrections(query, session_id, project_id, context)
                
                result.metadata.update({
                    'processing_mode': 'cloud_fallback',
                    'local_fallback_reason': 'local_system_unavailable',
                    'privacy_guaranteed': False
                })
                
                return result
                
        except Exception as e:
            processing_time = time.time() - start_time
            logger.error(f"Error in local-aware query processing: {e}")
            
            # Update stats for failure
            self._update_local_stats(processing_time, success=False)
            
            # Try fallback if local processing failed
            if self.local_fallback_enabled and self.use_local_models:
                logger.info("🔄 Attempting cloud fallback after local failure")
                try:
                    result = await super().process_query_with_corrections(query, session_id, project_id, context)
                    result.metadata.update({
                        'processing_mode': 'cloud_fallback',
                        'local_fallback_reason': f'local_error: {str(e)}',
                        'privacy_guaranteed': False,
                        'fallback_successful': True
                    })

                    # Record fallback usage for learning
                    await self._record_fallback_usage(query, session_id, project_id, str(e))

                    return result
                except Exception as fallback_error:
                    logger.error(f"Cloud fallback also failed: {fallback_error}")

                    # Record complete failure
                    await self._record_complete_failure(query, session_id, project_id, str(e), str(fallback_error))
            
            # If all else fails, return error result
            return ConsensusResult(
                query=query,
                consensus_response="Error: Unable to process query with local or cloud models",
                confidence_score=0.0,
                model_responses=[],
                processing_time=processing_time,
                metadata={
                    'processing_mode': 'error',
                    'error': str(e),
                    'privacy_guaranteed': False
                }
            )
    
    async def _process_query_local(self, query: str, session_id: str, 
                                 project_id: str, context: Optional[QueryContext] = None) -> ConsensusResult:
        """Process query using local models"""
        start_time = time.time()
        
        try:
            # Get correction-enhanced context
            enhanced_context = await self._get_correction_enhanced_context(
                query, session_id, project_id, context
            )
            
            # Apply session-specific correction patterns
            enhanced_query = await self.correction_learner.apply_session_corrections(
                query, session_id, project_id
            )
            
            # Generate SQL using local model
            sql_response = await self._generate_sql_local(enhanced_query, enhanced_context)
            
            # For now, use single model response (can be extended to multiple local models)
            model_responses = [sql_response]
            
            # Calculate consensus (simplified for single model)
            consensus_response = sql_response['response']
            confidence_score = sql_response.get('confidence', 0.8)
            
            # Create result
            result = ConsensusResult(
                query=query,
                consensus_response=consensus_response,
                confidence_score=confidence_score,
                model_responses=model_responses,
                processing_time=time.time() - start_time,
                metadata={
                    'enhanced_query_used': enhanced_query != query,
                    'local_model': self.local_llm_manager.active_model,
                    'context_enhanced': enhanced_context is not None,
                    'session_corrections_applied': True
                }
            )
            
            # Track query for potential correction
            asyncio.create_task(
                self._track_query_for_correction_safe(
                    f"local_{int(time.time())}", query, result, session_id, project_id
                )
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error in local query processing: {e}")
            raise
    
    async def _generate_sql_local(self, query: str, context: Optional[QueryContext] = None) -> Dict[str, Any]:
        """Generate SQL using local LLM"""
        try:
            # Build prompt for SQL generation
            prompt = self._build_sql_prompt(query, context)
            
            # Generate response using local model
            response = await self.local_llm_manager.generate_text(
                prompt=prompt,
                max_tokens=512,
                temperature=0.3,  # Lower temperature for more deterministic SQL
                top_p=0.9,
                stop_sequences=["```", "\n\n--", "EXPLAIN:"]
            )
            
            if response.success:
                # Extract SQL from response
                sql_query = self._extract_sql_from_response(response.text)
                
                return {
                    'model': self.local_llm_manager.active_model,
                    'response': sql_query,
                    'confidence': min(0.9, response.tokens_per_second / 10.0),  # Rough confidence based on speed
                    'processing_time': response.inference_time,
                    'tokens_generated': response.tokens_generated,
                    'raw_response': response.text
                }
            else:
                raise RuntimeError(f"Local model inference failed: {response.error}")
                
        except Exception as e:
            logger.error(f"Error generating SQL with local model: {e}")
            raise
    
    def _build_sql_prompt(self, query: str, context: Optional[QueryContext] = None) -> str:
        """Build prompt for SQL generation"""
        prompt_parts = [
            "You are an expert SQL analyst. Generate a precise SQL query based on the user's request.",
            "",
            "Guidelines:",
            "- Write clean, efficient SQL",
            "- Use appropriate table and column names",
            "- Include necessary JOINs and WHERE clauses",
            "- Return only the SQL query, no explanations",
            "",
        ]
        
        # Add context if available
        if context and hasattr(context, 'schema_info') and context.schema_info:
            prompt_parts.extend([
                "Available tables and columns:",
                str(context.schema_info),
                ""
            ])
        
        if context and hasattr(context, 'sample_data') and context.sample_data:
            prompt_parts.extend([
                "Sample data:",
                str(context.sample_data),
                ""
            ])
        
        # Add the user query
        prompt_parts.extend([
            f"User request: {query}",
            "",
            "SQL Query:"
        ])
        
        return "\n".join(prompt_parts)
    
    def _extract_sql_from_response(self, response_text: str) -> str:
        """Extract SQL query from model response"""
        # Remove common prefixes and suffixes
        sql = response_text.strip()
        
        # Remove markdown code blocks
        if sql.startswith("```sql"):
            sql = sql[6:]
        elif sql.startswith("```"):
            sql = sql[3:]
        
        if sql.endswith("```"):
            sql = sql[:-3]
        
        # Remove common explanatory text
        lines = sql.split('\n')
        sql_lines = []
        
        for line in lines:
            line = line.strip()
            if line and not line.startswith('--') and not line.lower().startswith('explanation'):
                sql_lines.append(line)
        
        return '\n'.join(sql_lines).strip()
    
    async def _is_local_system_ready(self) -> bool:
        """Check if local LLM system is ready for inference"""
        try:
            system_status = self.local_llm_manager.get_system_status()
            return (
                system_status['active_model'] is not None and
                len(system_status['loaded_models']) > 0 and
                system_status['security_scan_completed']
            )
        except Exception as e:
            logger.error(f"Error checking local system readiness: {e}")
            return False
    
    def _update_local_stats(self, response_time: float, success: bool):
        """Update local inference statistics"""
        self.local_inference_stats['total_requests'] += 1
        self.local_inference_stats['total_response_time'] += response_time
        
        if success:
            self.local_inference_stats['successful_requests'] += 1
        else:
            self.local_inference_stats['failed_requests'] += 1
        
        # Update average
        if self.local_inference_stats['total_requests'] > 0:
            self.local_inference_stats['average_response_time'] = (
                self.local_inference_stats['total_response_time'] / 
                self.local_inference_stats['total_requests']
            )
    
    async def get_system_health(self) -> Dict[str, Any]:
        """Get comprehensive system health including local LLM status"""
        # Get parent health metrics
        parent_health = await super().get_system_health()
        
        # Add local LLM health metrics
        local_status = self.local_llm_manager.get_system_status()
        
        # Calculate local system health
        local_health = "healthy"
        if not local_status['security_scan_completed']:
            local_health = "security_pending"
        elif local_status['security_vulnerabilities'] > 0:
            local_health = "security_issues"
        elif not local_status['active_model']:
            local_health = "no_model_loaded"
        elif len(local_status['loaded_models']) == 0:
            local_health = "no_models_available"
        
        # Combine health metrics
        combined_health = {
            **parent_health,
            'local_llm_status': local_health,
            'local_system_details': local_status,
            'local_inference_stats': self.local_inference_stats,
            'processing_mode': 'local' if self.use_local_models else 'cloud',
            'privacy_mode': self.use_local_models and local_health == "healthy",
            'cost_free_mode': self.use_local_models and local_health == "healthy"
        }
        
        return combined_health
    
    async def switch_to_local_mode(self) -> bool:
        """Switch to local processing mode"""
        try:
            if await self._is_local_system_ready():
                self.use_local_models = True
                logger.info("✅ Switched to local processing mode")
                return True
            else:
                logger.warning("⚠️ Cannot switch to local mode - system not ready")
                return False
        except Exception as e:
            logger.error(f"Error switching to local mode: {e}")
            return False
    
    async def switch_to_cloud_mode(self) -> bool:
        """Switch to cloud processing mode"""
        try:
            self.use_local_models = False
            logger.info("☁️ Switched to cloud processing mode")
            return True
        except Exception as e:
            logger.error(f"Error switching to cloud mode: {e}")
            return False
    
    def get_processing_mode(self) -> Dict[str, Any]:
        """Get current processing mode information"""
        return {
            'mode': 'local' if self.use_local_models else 'cloud',
            'local_available': asyncio.run(self._is_local_system_ready()),
            'fallback_enabled': self.local_fallback_enabled,
            'active_local_model': self.local_llm_manager.active_model,
            'privacy_guaranteed': self.use_local_models,
            'cost_free': self.use_local_models
        }
    
    async def cleanup(self):
        """Cleanup resources"""
        try:
            # Cleanup local LLM manager
            await self.local_llm_manager.cleanup()
            
            # Cleanup parent
            if hasattr(super(), 'cleanup'):
                await super().cleanup()
                
            logger.info("✅ Local-Aware Consensus Engine cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

    async def _record_fallback_usage(self, query: str, session_id: str, project_id: str, error: str):
        """Record when fallback to cloud is used for learning purposes"""
        try:
            # Create a correction record indicating local model failure
            from corrections.types import UserCorrection, CorrectionType

            fallback_correction = UserCorrection(
                session_id=session_id,
                query_id=f"fallback_{int(time.time())}",
                project_id=project_id,
                original_query=query,
                correction_type=CorrectionType.FEEDBACK,
                feedback_score=-1,  # Negative feedback for local failure
                correction_reason=f"Local model failed: {error}",
                context={
                    'fallback_used': True,
                    'local_error': error,
                    'timestamp': time.time()
                },
                confidence=0.3,  # Low confidence due to failure
                metadata={
                    'source': 'local_fallback',
                    'automatic': True
                }
            )

            # Process the correction for learning
            await self.correction_learner.process_correction(fallback_correction)

        except Exception as e:
            logger.error(f"Error recording fallback usage: {e}")

    async def _record_complete_failure(self, query: str, session_id: str, project_id: str,
                                     local_error: str, cloud_error: str):
        """Record complete system failure for analysis"""
        try:
            # Log detailed failure information
            failure_data = {
                'query': query,
                'session_id': session_id,
                'project_id': project_id,
                'local_error': local_error,
                'cloud_error': cloud_error,
                'timestamp': time.time(),
                'system_status': await self.get_system_health()
            }

            logger.error(f"Complete system failure recorded: {failure_data}")

            # Could be extended to write to a failure log file or database

        except Exception as e:
            logger.error(f"Error recording complete failure: {e}")

    async def get_integration_health(self) -> Dict[str, Any]:
        """Get detailed integration health metrics"""
        try:
            base_health = await self.get_system_health()

            # Add integration-specific metrics
            integration_metrics = {
                'correction_learning_integration': True,
                'consensus_engine_integration': True,
                'memory_system_integration': True,
                'fallback_mechanism_status': self.local_fallback_enabled,
                'local_inference_stats': self.local_inference_stats.copy(),
                'circuit_breaker_status': {
                    'local_circuit_open': getattr(self.local_llm_manager, 'circuit_open', False),
                    'failure_count': getattr(self.local_llm_manager, 'failure_count', 0)
                }
            }

            # Test integration points
            try:
                # Test correction learner integration
                test_correction_available = hasattr(self.correction_learner, 'process_correction')
                integration_metrics['correction_learning_integration'] = test_correction_available

                # Test memory manager integration
                test_memory_available = hasattr(self.memory_manager, 'db_manager')
                integration_metrics['memory_system_integration'] = test_memory_available

            except Exception as test_error:
                integration_metrics['integration_test_error'] = str(test_error)

            return {
                **base_health,
                'integration_metrics': integration_metrics
            }

        except Exception as e:
            logger.error(f"Error getting integration health: {e}")
            return {
                'integration_health_error': str(e),
                'timestamp': time.time()
            }
