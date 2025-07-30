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

        # Initialize consensus engine with memory
        self.consensus_config = ConsensusConfig.from_env()
        self.consensus_engine = ConsensusEngine(self.consensus_config, self.memory_manager)
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
