"""
Memory Manager for Project Cortex
Main orchestrator for AI memory operations, context retrieval, and learning.
"""

import asyncio
import time
import logging
import hashlib
import json
from typing import List, Dict, Any, Optional
from collections import defaultdict

from ..consensus.types import ConsensusResult, QueryContext
from .database import DatabaseManager
from .types import (
    MemoryContext, QueryHistoryEntry, LearnedPattern, SchemaInfo,
    MemoryStats, PatternType, ProjectInfo
)
from .config import MemoryConfig
from .cache import ContextCache
from .learning import PatternLearner

logger = logging.getLogger(__name__)


class MemoryManager:
    """Main memory manager for Project Cortex"""
    
    def __init__(self, config: MemoryConfig):
        self.config = config
        self.db_manager = DatabaseManager(config)
        self.cache = ContextCache(config.cache_size, config.cache_ttl)
        self.pattern_learner = PatternLearner(config)
        
        # Performance tracking
        self.retrieval_times = []
        self.cache_hits = 0
        self.cache_misses = 0
        
        # Background tasks
        self._cleanup_task = None
        self._initialized = False
        
    async def initialize(self) -> None:
        """Initialize memory manager"""
        if self._initialized:
            return
            
        logger.info("Initializing Project Cortex Memory Manager")
        
        # Initialize database
        await self.db_manager.initialize()
        
        # Start background cleanup task
        if self.config.auto_cleanup_enabled:
            self._cleanup_task = asyncio.create_task(self._background_cleanup())
            
        self._initialized = True
        logger.info("Memory Manager initialized successfully")
    
    async def get_relevant_context(self, query: str, project_id: str, 
                                  context: Optional[QueryContext] = None) -> MemoryContext:
        """Retrieve relevant context for a query"""
        start_time = time.time()
        
        # Generate cache key
        cache_key = self._generate_cache_key(query, project_id, context)
        
        # Check cache first
        cached_context = await self.cache.get(cache_key)
        if cached_context:
            self.cache_hits += 1
            cached_context.cache_hit = True
            cached_context.retrieval_time = time.time() - start_time
            return cached_context
            
        self.cache_misses += 1
        
        # Build memory context from database
        memory_context = MemoryContext()
        
        try:
            # PERFORMANCE OPTIMIZATION: Single optimized query for all context data
            memory_context = await self._get_context_optimized(query, project_id, context)
            
            # Calculate context relevance score
            memory_context.context_score = self._calculate_context_score(memory_context)
            
            # Set metadata
            memory_context.retrieval_time = time.time() - start_time
            memory_context.cache_hit = False
            
            # Cache the result
            await self.cache.set(cache_key, memory_context)
            
            # Track performance
            self.retrieval_times.append(memory_context.retrieval_time)
            
            logger.debug(f"Retrieved context for query in {memory_context.retrieval_time:.3f}s")
            
        except Exception as e:
            logger.error(f"Error retrieving context: {e}")
            memory_context.metadata['error'] = str(e)
            
        return memory_context
    
    async def learn_from_result(self, query: str, project_id: str, 
                               context: QueryContext, result: ConsensusResult,
                               user_feedback: Optional[int] = None) -> None:
        """Learn from query execution result"""
        try:
            # Store query history
            history_entry = QueryHistoryEntry(
                project_id=project_id,
                query_text=query,
                query_hash=self._generate_query_hash(query),
                context=context.to_dict() if context else {},
                consensus_result=result.to_dict(),
                success_score=result.confidence,
                execution_time=result.execution_time,
                user_feedback=user_feedback,
                metadata={
                    'status': result.status.value,
                    'supporting_models': result.supporting_models,
                    'resolution_method': result.resolution_method
                }
            )
            
            await self.db_manager.store_query_history(history_entry)
            
            # Learn patterns from successful queries
            if result.confidence > self.config.min_pattern_confidence:
                patterns = await self.pattern_learner.extract_patterns(
                    query, context, result
                )
                
                for pattern in patterns:
                    pattern.project_id = project_id
                    await self.db_manager.store_learned_pattern(pattern)
                    
            logger.debug(f"Learned from query result: confidence={result.confidence:.3f}")
            
        except Exception as e:
            logger.error(f"Error learning from result: {e}")
    
    async def get_schema_suggestions(self, project_id: str, partial_query: str) -> List[Dict[str, Any]]:
        """Get schema-based suggestions for query completion"""
        suggestions = []
        
        try:
            # Get relevant schemas
            schemas = await self.db_manager.get_schemas_for_project(project_id)
            
            # Extract table and column suggestions
            for schema in schemas:
                # Table suggestions
                if partial_query.lower() in schema.table_name.lower():
                    suggestions.append({
                        'type': 'table',
                        'value': schema.table_name,
                        'schema': schema.schema_name,
                        'description': f"Table in {schema.schema_name} schema"
                    })
                
                # Column suggestions
                for column_name, column_info in schema.columns.items():
                    if partial_query.lower() in column_name.lower():
                        suggestions.append({
                            'type': 'column',
                            'value': column_name,
                            'table': schema.table_name,
                            'schema': schema.schema_name,
                            'data_type': column_info.get('type', 'unknown'),
                            'description': f"Column in {schema.schema_name}.{schema.table_name}"
                        })
                        
        except Exception as e:
            logger.error(f"Error getting schema suggestions: {e}")
            
        return suggestions[:self.config.max_context_items]
    
    async def get_query_history(self, project_id: str, limit: int = 50, 
                               filters: Optional[Dict[str, Any]] = None) -> List[QueryHistoryEntry]:
        """Get query history with optional filters"""
        try:
            return await self.db_manager.get_query_history(project_id, limit)
        except Exception as e:
            logger.error(f"Error getting query history: {e}")
            return []
    
    async def get_memory_statistics(self, project_id: Optional[str] = None) -> MemoryStats:
        """Get memory system statistics"""
        try:
            stats = await self.db_manager.get_memory_stats(project_id)
            
            # Add cache statistics
            if self.cache_hits + self.cache_misses > 0:
                stats.cache_hit_rate = self.cache_hits / (self.cache_hits + self.cache_misses)
                
            # Add average retrieval time
            if self.retrieval_times:
                stats.avg_retrieval_time = sum(self.retrieval_times) / len(self.retrieval_times)
                
            return stats
            
        except Exception as e:
            logger.error(f"Error getting memory statistics: {e}")
            return MemoryStats()
    
    async def create_project(self, project_id: str, name: str, 
                           metadata: Optional[Dict[str, Any]] = None) -> ProjectInfo:
        """Create a new project"""
        return await self.db_manager.create_project(project_id, name, metadata)
    
    async def store_schema_info(self, project_id: str, schema_info: SchemaInfo) -> None:
        """Store database schema information"""
        await self.db_manager.store_schema_info(project_id, schema_info)
    
    def _generate_cache_key(self, query: str, project_id: str, 
                           context: Optional[QueryContext]) -> str:
        """Generate cache key for context retrieval"""
        key_parts = [query.strip().lower(), project_id]
        
        if context:
            # Add relevant context parts to key
            if hasattr(context, 'database_schemas') and context.database_schemas:
                key_parts.append(str(sorted(context.database_schemas)))
                
        key_string = '|'.join(key_parts)
        return hashlib.sha256(key_string.encode()).hexdigest()[:16]
    
    def _generate_query_hash(self, query: str) -> str:
        """Generate hash for query deduplication"""
        normalized = query.strip().lower()
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]
    
    async def _get_relevant_schemas(self, query: str, project_id: str, 
                                   context: Optional[QueryContext]) -> List[SchemaInfo]:
        """Get schemas relevant to the query"""
        try:
            all_schemas = await self.db_manager.get_schemas_for_project(project_id)
            
            # Simple relevance filtering based on query content
            relevant_schemas = []
            query_lower = query.lower()
            
            for schema in all_schemas:
                # Check if table name is mentioned in query
                if schema.table_name.lower() in query_lower:
                    relevant_schemas.append(schema)
                    continue
                    
                # Check if any column names are mentioned
                for column_name in schema.columns.keys():
                    if column_name.lower() in query_lower:
                        relevant_schemas.append(schema)
                        break
                        
            return relevant_schemas[:self.config.max_context_items // 2]
            
        except Exception as e:
            logger.error(f"Error getting relevant schemas: {e}")
            return []
    
    async def _get_similar_queries(self, query: str, project_id: str) -> List[QueryHistoryEntry]:
        """Get similar queries from history"""
        try:
            query_hash = self._generate_query_hash(query)
            return await self.db_manager.find_similar_queries(
                project_id, query_hash, limit=5
            )
        except Exception as e:
            logger.error(f"Error getting similar queries: {e}")
            return []
    
    async def _get_relevant_patterns(self, query: str, project_id: str, 
                                    context: Optional[QueryContext]) -> List[LearnedPattern]:
        """Get learned patterns relevant to the query"""
        try:
            return await self.db_manager.get_learned_patterns(
                project_id, 
                min_confidence=self.config.min_pattern_confidence,
                limit=10
            )
        except Exception as e:
            logger.error(f"Error getting relevant patterns: {e}")
            return []
    
    async def _get_user_preferences(self, project_id: str) -> Dict[str, Any]:
        """Get user preferences for the project"""
        try:
            patterns = await self.db_manager.get_learned_patterns(
                project_id, 
                pattern_type=PatternType.USER_PREFERENCE,
                min_confidence=0.5
            )
            
            preferences = {}
            for pattern in patterns:
                preferences.update(pattern.pattern_data)
                
            return preferences
            
        except Exception as e:
            logger.error(f"Error getting user preferences: {e}")
            return {}
    
    def _calculate_context_score(self, context: MemoryContext) -> float:
        """Calculate relevance score for retrieved context"""
        score = 0.0
        
        # Schema relevance
        if context.relevant_schemas:
            score += min(len(context.relevant_schemas) * 0.2, 0.4)
            
        # Query history relevance
        if context.similar_queries:
            avg_success = sum(q.success_score for q in context.similar_queries) / len(context.similar_queries)
            score += avg_success * 0.3
            
        # Pattern relevance
        if context.learned_patterns:
            avg_confidence = sum(p.confidence for p in context.learned_patterns) / len(context.learned_patterns)
            score += avg_confidence * 0.3
            
        return min(score, 1.0)

    async def _get_context_optimized(self, query: str, project_id: str,
                                    context: Optional[QueryContext]) -> MemoryContext:
        """PERFORMANCE OPTIMIZED: Single query to get all context data"""
        memory_context = MemoryContext()
        query_hash = self._generate_query_hash(query)
        query_lower = query.lower()

        async with self.db_manager.get_connection() as db:
            # Update project access time (non-blocking)
            asyncio.create_task(self._update_project_access_async(project_id))

            # Single optimized query for schemas with relevance filtering
            schema_cursor = await db.execute("""
                SELECT schema_name, table_name, column_info, relationships,
                       indexes, constraints, last_updated, metadata
                FROM database_schemas
                WHERE project_id = ?
                AND (LOWER(table_name) LIKE ? OR LOWER(schema_name) LIKE ?)
                ORDER BY
                    CASE WHEN LOWER(table_name) LIKE ? THEN 1 ELSE 2 END,
                    last_updated DESC
                LIMIT ?
            """, (project_id, f'%{query_lower[:20]}%', f'%{query_lower[:20]}%',
                  f'%{query_lower[:20]}%', self.config.max_context_items // 2))

            schemas = []
            async for row in schema_cursor:
                schema = SchemaInfo(
                    schema_name=row[0], table_name=row[1],
                    columns=json.loads(row[2]), relationships=json.loads(row[3]),
                    indexes=json.loads(row[4]), constraints=json.loads(row[5]),
                    last_updated=row[6], metadata=json.loads(row[7])
                )
                schemas.append(schema)
            memory_context.relevant_schemas = schemas

            # Single optimized query for similar queries
            query_cursor = await db.execute("""
                SELECT id, project_id, query_text, query_hash, context, consensus_result,
                       success_score, execution_time, timestamp, user_feedback, metadata
                FROM query_history
                WHERE project_id = ? AND (query_hash = ? OR success_score > 0.7)
                ORDER BY
                    CASE WHEN query_hash = ? THEN 1 ELSE 2 END,
                    success_score DESC, timestamp DESC
                LIMIT 5
            """, (project_id, query_hash, query_hash))

            similar_queries = []
            async for row in query_cursor:
                entry = QueryHistoryEntry(
                    id=row[0], project_id=row[1], query_text=row[2], query_hash=row[3],
                    context=json.loads(row[4]), consensus_result=json.loads(row[5]),
                    success_score=row[6], execution_time=row[7], timestamp=row[8],
                    user_feedback=row[9], metadata=json.loads(row[10])
                )
                similar_queries.append(entry)
            memory_context.similar_queries = similar_queries

            # Single optimized query for learned patterns
            pattern_cursor = await db.execute("""
                SELECT id, project_id, pattern_type, pattern_data, confidence,
                       usage_count, last_used, created_at, metadata
                FROM learned_patterns
                WHERE project_id = ? AND confidence >= ?
                ORDER BY confidence DESC, usage_count DESC
                LIMIT 10
            """, (project_id, self.config.min_pattern_confidence))

            patterns = []
            async for row in pattern_cursor:
                pattern = LearnedPattern(
                    id=row[0], project_id=row[1], pattern_type=PatternType(row[2]),
                    pattern_data=json.loads(row[3]), confidence=row[4],
                    usage_count=row[5], last_used=row[6], created_at=row[7],
                    metadata=json.loads(row[8])
                )
                patterns.append(pattern)
            memory_context.learned_patterns = patterns

            # Get user preferences from patterns
            pref_patterns = [p for p in patterns if p.pattern_type == PatternType.USER_PREFERENCE]
            preferences = {}
            for pattern in pref_patterns:
                preferences.update(pattern.pattern_data)
            memory_context.user_preferences = preferences

        return memory_context

    async def _update_project_access_async(self, project_id: str) -> None:
        """Non-blocking project access time update"""
        try:
            await self.db_manager.update_project_access(project_id)
        except Exception as e:
            logger.warning(f"Failed to update project access time: {e}")

    async def _background_cleanup(self) -> None:
        """Background task for periodic cleanup"""
        while True:
            try:
                await asyncio.sleep(self.config.cleanup_interval_hours * 3600)
                
                logger.info("Starting background cleanup")
                cleanup_stats = await self.db_manager.cleanup_old_data(
                    self.config.query_retention_days
                )
                logger.info(f"Background cleanup completed: {cleanup_stats}")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Background cleanup error: {e}")
    
    async def close(self) -> None:
        """Close memory manager and cleanup resources"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
                
        await self.db_manager.close()
        logger.info("Memory Manager closed")
