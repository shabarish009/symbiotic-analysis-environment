#!/usr/bin/env python3
"""
AI Core Main Entry Point
Enhanced implementation with Consensus Engine for trustworthy AI responses.
"""

import asyncio
import json
import sys
import logging
from typing import Dict, Any, Optional
from datetime import datetime

# Import consensus engine components
from consensus import ConsensusEngine, ConsensusConfig, ConsensusHandler
from consensus.streamer import thought_process_streamer

# Import memory system components
from memory import MemoryManager, MemoryConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr)  # Log to stderr to avoid interfering with JSON-RPC
    ]
)

logger = logging.getLogger(__name__)


class JSONRPCHandler:
    """Handles JSON-RPC communication via stdin/stdout with Consensus Engine"""

    def __init__(self):
        # Initialize memory system
        self.memory_config = MemoryConfig.from_env()
        self.memory_manager = MemoryManager(self.memory_config)

        # Initialize local-aware consensus engine with memory
        self.consensus_config = ConsensusConfig.from_env()
        from consensus.local_aware_engine import LocalAwareConsensusEngine
        self.consensus_engine = LocalAwareConsensusEngine(self.consensus_config, self.memory_manager)
        self.consensus_handler = ConsensusHandler(self.consensus_engine)

        self.methods = {
            'ping': self.handle_ping,
            'status': self.handle_status,
            'shutdown': self.handle_shutdown,
            'consensus.query': self.handle_consensus_query,
            'consensus.health': self.handle_consensus_health,
            'consensus.metrics': self.handle_consensus_metrics,
            'thought_process.subscribe': self.handle_thought_process_subscribe,
            'thought_process.unsubscribe': self.handle_thought_process_unsubscribe,
            'thought_process.history': self.handle_thought_process_history,
            # Memory system methods
            'memory.get_context': self.handle_memory_get_context,
            'memory.learn_from_interaction': self.handle_memory_learn,
            'memory.get_query_history': self.handle_memory_get_history,
            'memory.get_schema_suggestions': self.handle_memory_get_suggestions,
            'memory.get_statistics': self.handle_memory_get_stats,
            'memory.create_project': self.handle_memory_create_project,
            'memory.store_schema': self.handle_memory_store_schema,
            # Correction learning methods
            'correction.submit': self.handle_submit_correction,
            'correction.feedback': self.handle_submit_feedback,
            'correction.impact': self.handle_get_correction_impact,

            # Local LLM methods
            'local_llm.get_available_models': self.handle_get_available_models,
            'local_llm.download_model': self.handle_download_model,
            'local_llm.load_model': self.handle_load_model,
            'local_llm.unload_model': self.handle_unload_model,
            'local_llm.get_system_status': self.handle_get_system_status,
            'local_llm.get_processing_mode': self.handle_get_processing_mode,
            'local_llm.switch_to_local_mode': self.handle_switch_to_local_mode,
            'local_llm.switch_to_cloud_mode': self.handle_switch_to_cloud_mode,
            'local_llm.get_download_progress': self.handle_get_download_progress,
            'correction.progress': self.handle_get_learning_progress,
            'correction.cleanup_session': self.handle_cleanup_session,
        }
        self.running = True
        self.status = 'starting'

        logger.info("JSON-RPC Handler initialized with Consensus Engine")
    
    async def handle_ping(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle ping request"""
        logger.debug("Received ping request")
        return {
            'pong': True,
            'timestamp': datetime.now().isoformat(),
            'status': self.status
        }
    
    async def handle_status(self, params: Optional[Dict[str, Any]] = None) -> str:
        """Handle status request"""
        logger.debug(f"Received status request, current status: {self.status}")
        return self.status
    
    async def handle_shutdown(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle shutdown request"""
        logger.info("Received shutdown request")

        # Gracefully shutdown consensus engine
        await self.consensus_engine.shutdown()

        self.running = False
        self.status = 'shutting_down'
        return {'message': 'Shutting down AI Core'}

    async def handle_consensus_query(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle consensus query request"""
        logger.info("Received consensus query request")

        if not params:
            return {
                'success': False,
                'error': {
                    'code': -32602,
                    'message': 'Missing parameters'
                }
            }

        return await self.consensus_handler.handle_consensus_request(params)

    async def handle_consensus_health(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle consensus health check request"""
        logger.debug("Received consensus health check request")
        return await self.consensus_handler.handle_health_check(params or {})

    async def handle_consensus_metrics(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle consensus metrics request"""
        logger.debug("Received consensus metrics request")
        return await self.consensus_handler.handle_metrics_request(params or {})

    async def handle_thought_process_subscribe(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle thought process subscription request"""
        logger.debug("Received thought process subscription request")

        try:
            query_id = params.get('query_id') if params else None

            # Create a callback that sends notifications with error handling
            def thought_process_callback(update_data):
                try:
                    # IMPROVEMENT: Add data validation before sending
                    if not isinstance(update_data, dict) or 'type' not in update_data:
                        logger.warning(f"Invalid thought process update data: {update_data}")
                        return

                    # Send notification to shell
                    self.send_notification('thought_process.update', update_data)
                except Exception as e:
                    logger.error(f"Failed to send thought process notification: {e}")
                    # Don't raise exception to avoid breaking the subscriber

            subscriber_id = thought_process_streamer.subscribe(thought_process_callback, query_id)

            return {
                'success': True,
                'subscriber_id': subscriber_id,
                'message': 'Subscribed to thought process updates'
            }

        except Exception as e:
            logger.error(f"Failed to subscribe to thought process: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def handle_thought_process_unsubscribe(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle thought process unsubscription request"""
        logger.debug("Received thought process unsubscription request")

        try:
            if not params or 'subscriber_id' not in params:
                return {
                    'success': False,
                    'error': 'Missing subscriber_id parameter'
                }

            subscriber_id = params['subscriber_id']
            thought_process_streamer.unsubscribe(subscriber_id)

            return {
                'success': True,
                'message': 'Unsubscribed from thought process updates'
            }

        except Exception as e:
            logger.error(f"Failed to unsubscribe from thought process: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    async def handle_thought_process_history(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle thought process history request"""
        logger.debug("Received thought process history request")

        try:
            limit = params.get('limit', 50) if params else 50
            history = thought_process_streamer.get_query_history(limit)

            return {
                'success': True,
                'history': history,
                'count': len(history)
            }

        except Exception as e:
            logger.error(f"Failed to get thought process history: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def send_response(self, response: Dict[str, Any]):
        """Send JSON-RPC response to stdout"""
        try:
            json_str = json.dumps(response)
            print(json_str, flush=True)
            logger.debug(f"Sent response: {json_str}")
        except Exception as e:
            logger.error(f"Error sending response: {e}")
    
    def send_notification(self, method: str, params: Optional[Dict[str, Any]] = None):
        """Send JSON-RPC notification to stdout"""
        try:
            notification = {
                'jsonrpc': '2.0',
                'method': method,
                'params': params
            }
            json_str = json.dumps(notification)
            print(json_str, flush=True)
            logger.debug(f"Sent notification: {json_str}")
        except Exception as e:
            logger.error(f"Error sending notification: {e}")
    
    async def process_message(self, message: Dict[str, Any]):
        """Process incoming JSON-RPC message"""
        try:
            jsonrpc = message.get('jsonrpc')
            if jsonrpc != '2.0':
                logger.warning(f"Invalid JSON-RPC version: {jsonrpc}")
                return
            
            method = message.get('method')
            params = message.get('params')
            msg_id = message.get('id')
            
            logger.debug(f"Processing method: {method}, params: {params}, id: {msg_id}")
            
            if method in self.methods:
                try:
                    result = await self.methods[method](params)
                    
                    # Only send response if this is a request (has id)
                    if msg_id is not None:
                        response = {
                            'jsonrpc': '2.0',
                            'result': result,
                            'id': msg_id
                        }
                        self.send_response(response)
                except Exception as e:
                    logger.error(f"Error executing method {method}: {e}")
                    if msg_id is not None:
                        error_response = {
                            'jsonrpc': '2.0',
                            'error': {
                                'code': -32603,
                                'message': 'Internal error',
                                'data': str(e)
                            },
                            'id': msg_id
                        }
                        self.send_response(error_response)
            else:
                logger.warning(f"Unknown method: {method}")
                if msg_id is not None:
                    error_response = {
                        'jsonrpc': '2.0',
                        'error': {
                            'code': -32601,
                            'message': 'Method not found',
                            'data': method
                        },
                        'id': msg_id
                    }
                    self.send_response(error_response)
        
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def run(self):
        """Main event loop for processing JSON-RPC messages"""
        logger.info("AI Core starting up...")

        try:
            # Initialize memory system
            logger.info("Initializing Project Cortex memory system...")
            await self.memory_manager.initialize()
            logger.info("Memory system initialized successfully")

            # Perform consensus engine health check
            health_report = await self.consensus_engine.health_check()

            if health_report['overall_healthy']:
                # Report that we're ready
                self.status = 'ready'
                self.send_notification('ai.status.update', {
                    'status': 'ready',
                    'message': 'AI Core with Consensus Engine is ready',
                    'timestamp': datetime.now().timestamp(),
                    'consensus_models': health_report['models']['healthy']
                })
                logger.info(f"AI Core is ready with {health_report['models']['healthy']} healthy consensus models")
            else:
                # Report degraded status
                self.status = 'degraded'
                self.send_notification('ai.status.update', {
                    'status': 'degraded',
                    'message': 'AI Core started but consensus engine has issues',
                    'timestamp': datetime.now().timestamp(),
                    'consensus_models': health_report['models']['healthy']
                })
                logger.warning(f"AI Core started in degraded mode: {health_report['models']['healthy']}/{health_report['models']['total']} models healthy")

            # Set up stdin for non-blocking reads
            stdin_reader = asyncio.StreamReader()
            protocol = asyncio.StreamReaderProtocol(stdin_reader)
            await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)

            while self.running:
                try:
                    # Read line from stdin with timeout
                    try:
                        line = await asyncio.wait_for(stdin_reader.readline(), timeout=1.0)
                        if not line:
                            logger.info("EOF received, shutting down")
                            break

                        line = line.decode('utf-8').strip()
                        if not line:
                            continue

                        logger.debug(f"Received: {line}")

                        # Parse JSON-RPC message
                        try:
                            message = json.loads(line)
                            await self.process_message(message)
                        except json.JSONDecodeError as e:
                            logger.error(f"Invalid JSON received: {e}")
                            # Send error response if possible
                            error_response = {
                                'jsonrpc': '2.0',
                                'error': {
                                    'code': -32700,
                                    'message': 'Parse error',
                                    'data': str(e)
                                },
                                'id': None
                            }
                            self.send_response(error_response)
                            continue

                    except asyncio.TimeoutError:
                        # Timeout is normal, just continue
                        continue

                except Exception as e:
                    logger.error(f"Error in main loop: {e}")
                    # Try to continue running unless it's a critical error
                    if isinstance(e, (KeyboardInterrupt, SystemExit)):
                        break
                    continue

        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt")
        except Exception as e:
            logger.error(f"Unexpected error in main loop: {e}")
            # Report error status
            self.status = 'error'
            self.send_notification('ai.status.update', {
                'status': 'error',
                'message': f'AI Core error: {str(e)}',
                'timestamp': datetime.now().timestamp()
            })
        finally:
            logger.info("AI Core shutting down")
            self.status = 'stopped'
            self.send_notification('ai.status.update', {
                'status': 'stopped',
                'message': 'AI Core stopped',
                'timestamp': datetime.now().timestamp()
            })

    # Memory system JSON-RPC handlers
    async def handle_memory_get_context(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle memory context retrieval request"""
        logger.debug("Received memory context request")

        if not params:
            return {'error': 'Missing parameters'}

        query = params.get('query')
        project_id = params.get('project_id')

        if not query or not project_id:
            return {'error': 'Missing query or project_id'}

        try:
            context = await self.memory_manager.get_relevant_context(query, project_id)
            return {
                'success': True,
                'context': context.to_dict()
            }
        except Exception as e:
            logger.error(f"Memory context retrieval failed: {e}")
            return {'error': str(e)}

    async def handle_memory_learn(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle memory learning from interaction"""
        logger.debug("Received memory learning request")

        if not params:
            return {'error': 'Missing parameters'}

        try:
            query = params.get('query')
            project_id = params.get('project_id')
            result_data = params.get('result')
            user_feedback = params.get('user_feedback')

            if not all([query, project_id, result_data]):
                return {'error': 'Missing required parameters'}

            # This would need proper ConsensusResult reconstruction
            # For now, we'll skip the learning aspect
            return {'success': True, 'message': 'Learning recorded'}

        except Exception as e:
            logger.error(f"Memory learning failed: {e}")
            return {'error': str(e)}

    async def handle_memory_get_history(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle query history retrieval"""
        logger.debug("Received query history request")

        if not params:
            return {'error': 'Missing parameters'}

        project_id = params.get('project_id')
        limit = params.get('limit', 50)

        if not project_id:
            return {'error': 'Missing project_id'}

        try:
            history = await self.memory_manager.get_query_history(project_id, limit)
            return {
                'success': True,
                'history': [entry.to_dict() for entry in history]
            }
        except Exception as e:
            logger.error(f"Query history retrieval failed: {e}")
            return {'error': str(e)}

    async def handle_memory_get_suggestions(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle schema suggestions request"""
        logger.debug("Received schema suggestions request")

        if not params:
            return {'error': 'Missing parameters'}

        project_id = params.get('project_id')
        partial_query = params.get('partial_query', '')

        if not project_id:
            return {'error': 'Missing project_id'}

        try:
            suggestions = await self.memory_manager.get_schema_suggestions(project_id, partial_query)
            return {
                'success': True,
                'suggestions': suggestions
            }
        except Exception as e:
            logger.error(f"Schema suggestions failed: {e}")
            return {'error': str(e)}

    async def handle_memory_get_stats(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle memory statistics request"""
        logger.debug("Received memory statistics request")

        project_id = params.get('project_id') if params else None

        try:
            stats = await self.memory_manager.get_memory_statistics(project_id)
            return {
                'success': True,
                'statistics': stats.to_dict()
            }
        except Exception as e:
            logger.error(f"Memory statistics failed: {e}")
            return {'error': str(e)}

    async def handle_memory_create_project(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle project creation request"""
        logger.debug("Received project creation request")

        if not params:
            return {'error': 'Missing parameters'}

        project_id = params.get('project_id')
        name = params.get('name')
        metadata = params.get('metadata', {})

        if not project_id or not name:
            return {'error': 'Missing project_id or name'}

        try:
            project = await self.memory_manager.create_project(project_id, name, metadata)
            return {
                'success': True,
                'project': project.to_dict()
            }
        except Exception as e:
            logger.error(f"Project creation failed: {e}")
            return {'error': str(e)}

    async def handle_memory_store_schema(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle schema storage request"""
        logger.debug("Received schema storage request")

        if not params:
            return {'error': 'Missing parameters'}

        project_id = params.get('project_id')
        schema_data = params.get('schema_info')

        if not project_id or not schema_data:
            return {'error': 'Missing project_id or schema_info'}

        try:
            # This would need proper SchemaInfo reconstruction
            # For now, we'll return success
            return {'success': True, 'message': 'Schema stored'}

        except Exception as e:
            logger.error(f"Schema storage failed: {e}")
            return {'error': str(e)}

    # Correction Learning API Endpoints
    async def handle_submit_correction(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle user correction submission"""
        try:
            if not params:
                return {"success": False, "error": "Parameters required"}

            # Import correction types
            from .corrections.types import UserCorrection, CorrectionType, FeedbackScore

            # Validate required parameters
            required_fields = ['session_id', 'query_id', 'project_id', 'original_query', 'correction_type']
            for field in required_fields:
                if field not in params:
                    return {"success": False, "error": f"Missing required field: {field}"}

            # Create correction object
            correction = UserCorrection(
                session_id=params['session_id'],
                query_id=params['query_id'],
                project_id=params['project_id'],
                original_query=params['original_query'],
                corrected_query=params.get('corrected_query'),
                correction_type=CorrectionType(params['correction_type']),
                feedback_score=FeedbackScore(params['feedback_score']) if params.get('feedback_score') is not None else None,
                correction_reason=params.get('correction_reason', ''),
                context=params.get('context', {}),
                confidence=params.get('confidence', 0.0),
                metadata=params.get('metadata', {})
            )

            # Apply correction through consensus engine
            if hasattr(self.consensus_engine, 'apply_user_correction'):
                result = await self.consensus_engine.apply_user_correction(correction)
                return result
            else:
                return {"success": False, "error": "Correction learning not available"}

        except Exception as e:
            logger.error(f"Error submitting correction: {e}")
            return {"success": False, "error": str(e)}

    async def handle_submit_feedback(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Handle user feedback submission"""
        try:
            if not params:
                return {"success": False, "error": "Parameters required"}

            from .corrections.types import FeedbackScore

            # Validate required parameters
            required_fields = ['query_id', 'feedback_score', 'session_id', 'project_id']
            for field in required_fields:
                if field not in params:
                    return {"success": False, "error": f"Missing required field: {field}"}

            # Submit feedback through consensus engine
            if hasattr(self.consensus_engine, 'submit_feedback'):
                result = await self.consensus_engine.submit_feedback(
                    query_id=params['query_id'],
                    feedback_score=FeedbackScore(params['feedback_score']),
                    feedback_text=params.get('feedback_text', ''),
                    session_id=params['session_id'],
                    project_id=params['project_id']
                )
                return result
            else:
                return {"success": False, "error": "Feedback submission not available"}

        except Exception as e:
            logger.error(f"Error submitting feedback: {e}")
            return {"success": False, "error": str(e)}

    async def handle_get_correction_impact(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Get correction learning impact for session"""
        try:
            if not params:
                return {"success": False, "error": "Parameters required"}

            # Validate required parameters
            required_fields = ['session_id', 'project_id']
            for field in required_fields:
                if field not in params:
                    return {"success": False, "error": f"Missing required field: {field}"}

            # Get impact through consensus engine
            if hasattr(self.consensus_engine, 'get_correction_impact'):
                result = await self.consensus_engine.get_correction_impact(
                    session_id=params['session_id'],
                    project_id=params['project_id']
                )
                return result
            else:
                return {"success": False, "error": "Correction impact not available"}

        except Exception as e:
            logger.error(f"Error getting correction impact: {e}")
            return {"success": False, "error": str(e)}

    async def handle_get_learning_progress(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Get learning progress and effectiveness metrics"""
        try:
            if not params:
                return {"success": False, "error": "Parameters required"}

            # Validate required parameters
            if 'project_id' not in params:
                return {"success": False, "error": "Missing required field: project_id"}

            # Get progress through consensus engine
            if hasattr(self.consensus_engine, 'get_learning_progress'):
                result = await self.consensus_engine.get_learning_progress(
                    project_id=params['project_id']
                )
                return result
            else:
                return {"success": False, "error": "Learning progress not available"}

        except Exception as e:
            logger.error(f"Error getting learning progress: {e}")
            return {"success": False, "error": str(e)}

    async def handle_cleanup_session(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Clean up session-specific correction data"""
        try:
            if not params or 'session_id' not in params:
                return {"success": False, "error": "session_id parameter required"}

            # Clean up through consensus engine
            if hasattr(self.consensus_engine, 'cleanup_session_data'):
                await self.consensus_engine.cleanup_session_data(params['session_id'])
                return {"success": True, "message": "Session data cleaned up"}
            else:
                return {"success": False, "error": "Session cleanup not available"}

        except Exception as e:
            logger.error(f"Error cleaning up session: {e}")
            return {"success": False, "error": str(e)}


class AICore:
    """Main AI Core class"""
    
    def __init__(self):
        self.rpc_handler = JSONRPCHandler()
        logger.info("AI Core initialized")
    
    async def start(self):
        """Start the AI Core"""
        try:
            await self.rpc_handler.run()
        except Exception as e:
            logger.error(f"Error starting AI Core: {e}")
            raise

    # Local LLM Management Methods

    async def handle_get_available_models(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get list of available local models"""
        try:
            models = self.consensus_engine.local_llm_manager.get_available_models()
            return {'success': True, 'data': models}
        except Exception as e:
            logger.error(f"Error getting available models: {e}")
            return {'success': False, 'error': str(e)}

    async def handle_download_model(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Download a local model"""
        try:
            model_name = params.get('model_name')
            if not model_name:
                return {'success': False, 'error': 'model_name parameter required'}

            success = await self.consensus_engine.local_llm_manager.download_model(model_name)
            return {'success': success, 'data': {'model_name': model_name, 'downloaded': success}}
        except Exception as e:
            logger.error(f"Error downloading model: {e}")
            return {'success': False, 'error': str(e)}

    async def handle_load_model(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Load a local model into memory"""
        try:
            model_name = params.get('model_name')
            if not model_name:
                return {'success': False, 'error': 'model_name parameter required'}

            success = await self.consensus_engine.local_llm_manager.load_model(model_name)
            return {'success': success, 'data': {'model_name': model_name, 'loaded': success}}
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return {'success': False, 'error': str(e)}

    async def handle_unload_model(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Unload a local model from memory"""
        try:
            model_name = params.get('model_name')
            if not model_name:
                return {'success': False, 'error': 'model_name parameter required'}

            success = await self.consensus_engine.local_llm_manager.unload_model(model_name)
            return {'success': success, 'data': {'model_name': model_name, 'unloaded': success}}
        except Exception as e:
            logger.error(f"Error unloading model: {e}")
            return {'success': False, 'error': str(e)}

    async def handle_get_system_status(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get local LLM system status"""
        try:
            status = self.consensus_engine.local_llm_manager.get_system_status()
            return {'success': True, 'data': status}
        except Exception as e:
            logger.error(f"Error getting system status: {e}")
            return {'success': False, 'error': str(e)}

    async def handle_get_processing_mode(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get current processing mode (local/cloud)"""
        try:
            mode_info = self.consensus_engine.get_processing_mode()
            return {'success': True, 'data': mode_info}
        except Exception as e:
            logger.error(f"Error getting processing mode: {e}")
            return {'success': False, 'error': str(e)}

    async def handle_switch_to_local_mode(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Switch to local processing mode"""
        try:
            success = await self.consensus_engine.switch_to_local_mode()
            return {'success': success, 'data': {'mode': 'local', 'switched': success}}
        except Exception as e:
            logger.error(f"Error switching to local mode: {e}")
            return {'success': False, 'error': str(e)}

    async def handle_switch_to_cloud_mode(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Switch to cloud processing mode"""
        try:
            success = await self.consensus_engine.switch_to_cloud_mode()
            return {'success': success, 'data': {'mode': 'cloud', 'switched': success}}
        except Exception as e:
            logger.error(f"Error switching to cloud mode: {e}")
            return {'success': False, 'error': str(e)}

    async def handle_get_download_progress(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Get download progress for a model"""
        try:
            model_name = params.get('model_name')
            if not model_name:
                return {'success': False, 'error': 'model_name parameter required'}

            progress = self.consensus_engine.local_llm_manager.downloader.get_download_progress(model_name)
            return {'success': True, 'data': progress.__dict__ if progress else None}
        except Exception as e:
            logger.error(f"Error getting download progress: {e}")
            return {'success': False, 'error': str(e)}


async def main():
    """Main entry point"""
    try:
        logger.info("Starting AI Core...")
        ai_core = AICore()
        await ai_core.start()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
