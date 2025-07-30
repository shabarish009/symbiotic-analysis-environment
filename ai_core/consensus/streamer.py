"""
Thought Process Streamer
Handles real-time streaming of AI thought process information.
"""

import asyncio
import time
import uuid
import logging
from typing import Dict, List, Callable, Any, Optional
from dataclasses import dataclass

from .types import ThoughtProcessStep, ModelThought, ConsensusThought, ResolutionThought

logger = logging.getLogger(__name__)


@dataclass
class ThoughtProcessSubscriber:
    """Subscriber for thought process updates"""
    subscriber_id: str
    callback: Callable[[Dict[str, Any]], None]
    query_id: Optional[str] = None
    active: bool = True


class ThoughtProcessStreamer:
    """Manages real-time streaming of thought process information"""
    
    def __init__(self):
        self.subscribers: Dict[str, ThoughtProcessSubscriber] = {}
        self.active_queries: Dict[str, Dict[str, Any]] = {}
        self.query_history: List[Dict[str, Any]] = []
        self.max_history_size = 100
        
    def subscribe(self, callback: Callable[[Dict[str, Any]], None], 
                  query_id: Optional[str] = None) -> str:
        """Subscribe to thought process updates"""
        subscriber_id = str(uuid.uuid4())
        subscriber = ThoughtProcessSubscriber(
            subscriber_id=subscriber_id,
            callback=callback,
            query_id=query_id
        )
        self.subscribers[subscriber_id] = subscriber
        
        logger.debug(f"New thought process subscriber: {subscriber_id}")
        return subscriber_id
    
    def unsubscribe(self, subscriber_id: str):
        """Unsubscribe from thought process updates"""
        if subscriber_id in self.subscribers:
            self.subscribers[subscriber_id].active = False
            del self.subscribers[subscriber_id]
            logger.debug(f"Unsubscribed thought process subscriber: {subscriber_id}")
    
    async def start_query_stream(self, query_id: str, query: str, expected_steps: List[str]):
        """Start streaming for a new query"""
        query_data = {
            'query_id': query_id,
            'query': query[:100] + ('...' if len(query) > 100 else ''),
            'expected_steps': expected_steps,
            'start_time': time.time(),
            'current_step': 'initiated',
            'progress': 0.0,
            'steps': []
        }
        
        self.active_queries[query_id] = query_data
        
        # Emit query start event
        await self._emit_update({
            'type': 'query_started',
            'query_id': query_id,
            'data': query_data
        })
        
        logger.info(f"Started thought process stream for query: {query_id}")
    
    async def emit_step(self, query_id: str, step: ThoughtProcessStep):
        """Emit a thought process step update"""
        if query_id not in self.active_queries:
            logger.warning(f"Attempted to emit step for unknown query: {query_id}")
            return
        
        query_data = self.active_queries[query_id]
        query_data['steps'].append(step.to_dict())
        query_data['current_step'] = step.step_type
        query_data['progress'] = step.progress
        
        # Emit step update
        await self._emit_update({
            'type': 'step_update',
            'query_id': query_id,
            'step': step.to_dict(),
            'query_progress': step.progress
        })
        
        logger.debug(f"Emitted step '{step.step_type}' for query {query_id}")
    
    async def emit_model_thoughts(self, query_id: str, model_thoughts: List[ModelThought]):
        """Emit model thought process information"""
        if query_id not in self.active_queries:
            return
        
        thoughts_data = [thought.to_dict() for thought in model_thoughts]
        
        await self._emit_update({
            'type': 'model_thoughts',
            'query_id': query_id,
            'model_thoughts': thoughts_data
        })
        
        logger.debug(f"Emitted model thoughts for query {query_id}: {len(model_thoughts)} models")
    
    async def emit_consensus_thought(self, query_id: str, consensus_thought: ConsensusThought):
        """Emit consensus process information"""
        if query_id not in self.active_queries:
            return
        
        await self._emit_update({
            'type': 'consensus_thought',
            'query_id': query_id,
            'consensus_thought': consensus_thought.to_dict()
        })
        
        logger.debug(f"Emitted consensus thought for query {query_id}")
    
    async def emit_resolution_thought(self, query_id: str, resolution_thought: ResolutionThought):
        """Emit conflict resolution information"""
        if query_id not in self.active_queries:
            return
        
        await self._emit_update({
            'type': 'resolution_thought',
            'query_id': query_id,
            'resolution_thought': resolution_thought.to_dict()
        })
        
        logger.debug(f"Emitted resolution thought for query {query_id}")
    
    async def complete_query_stream(self, query_id: str, final_result: Dict[str, Any]):
        """Complete the thought process stream for a query"""
        if query_id not in self.active_queries:
            return
        
        query_data = self.active_queries[query_id]
        query_data['end_time'] = time.time()
        query_data['total_duration'] = query_data['end_time'] - query_data['start_time']
        query_data['final_result'] = final_result
        query_data['completed'] = True
        
        # Emit completion event
        await self._emit_update({
            'type': 'query_completed',
            'query_id': query_id,
            'final_result': final_result,
            'total_duration': query_data['total_duration']
        })
        
        # Move to history
        self._archive_query(query_id)
        
        logger.info(f"Completed thought process stream for query: {query_id}")
    
    async def emit_error(self, query_id: str, error_message: str, error_type: str = 'general'):
        """Emit an error in the thought process"""
        await self._emit_update({
            'type': 'error',
            'query_id': query_id,
            'error_message': error_message,
            'error_type': error_type,
            'timestamp': time.time()
        })
        
        logger.error(f"Emitted error for query {query_id}: {error_message}")
    
    async def _emit_update(self, update_data: Dict[str, Any]):
        """Emit update to all relevant subscribers with enhanced error handling"""
        query_id = update_data.get('query_id')

        # Add timestamp if not present
        if 'timestamp' not in update_data:
            update_data['timestamp'] = time.time()

        # IMPROVEMENT: Add update validation
        if not self._validate_update_data(update_data):
            logger.warning(f"Invalid update data for query {query_id}: {update_data}")
            return

        # Send to subscribers with enhanced error handling
        failed_subscribers = []
        for subscriber in list(self.subscribers.values()):
            if not subscriber.active:
                continue

            # Check if subscriber is interested in this query
            if subscriber.query_id and subscriber.query_id != query_id:
                continue

            try:
                # Call subscriber callback (could be async or sync)
                if asyncio.iscoroutinefunction(subscriber.callback):
                    # IMPROVEMENT: Add timeout for async callbacks
                    await asyncio.wait_for(subscriber.callback(update_data), timeout=5.0)
                else:
                    subscriber.callback(update_data)
            except asyncio.TimeoutError:
                logger.error(f"Subscriber {subscriber.subscriber_id} callback timed out")
                failed_subscribers.append(subscriber.subscriber_id)
            except Exception as e:
                logger.error(f"Error calling subscriber {subscriber.subscriber_id}: {e}")
                failed_subscribers.append(subscriber.subscriber_id)

        # IMPROVEMENT: Clean up failed subscribers
        for subscriber_id in failed_subscribers:
            if subscriber_id in self.subscribers:
                self.subscribers[subscriber_id].active = False
                logger.info(f"Marked subscriber {subscriber_id} as inactive due to callback failure")

    def _validate_update_data(self, update_data: Dict[str, Any]) -> bool:
        """Validate update data structure"""
        required_fields = ['type', 'query_id', 'timestamp']

        for field in required_fields:
            if field not in update_data:
                return False

        # Validate update type
        valid_types = ['query_started', 'step_update', 'model_thoughts', 'consensus_thought',
                      'resolution_thought', 'query_completed', 'error']
        if update_data['type'] not in valid_types:
            return False

        return True
    
    def _archive_query(self, query_id: str):
        """Archive completed query to history"""
        if query_id in self.active_queries:
            query_data = self.active_queries[query_id]
            self.query_history.append(query_data)
            
            # Maintain history size limit
            if len(self.query_history) > self.max_history_size:
                self.query_history = self.query_history[-self.max_history_size:]
            
            # Remove from active queries
            del self.active_queries[query_id]
    
    def get_query_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get historical thought process data"""
        return self.query_history[-limit:] if limit else self.query_history
    
    def get_active_queries(self) -> Dict[str, Dict[str, Any]]:
        """Get currently active queries"""
        return self.active_queries.copy()
    
    def cleanup_inactive_subscribers(self):
        """Remove inactive subscribers"""
        inactive_ids = [sid for sid, sub in self.subscribers.items() if not sub.active]
        for sid in inactive_ids:
            del self.subscribers[sid]
        
        if inactive_ids:
            logger.debug(f"Cleaned up {len(inactive_ids)} inactive subscribers")


# Global thought process streamer instance
thought_process_streamer = ThoughtProcessStreamer()
