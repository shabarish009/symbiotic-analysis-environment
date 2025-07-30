"""
Context Cache for Project Cortex
High-performance in-memory cache for frequently accessed context data.
"""

import time
import asyncio
import logging
from typing import Dict, Any, Optional, Tuple
from collections import OrderedDict
from dataclasses import dataclass

from .types import MemoryContext

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Cache entry with metadata"""
    data: MemoryContext
    created_at: float
    last_accessed: float
    access_count: int
    expiry_time: float
    
    def is_expired(self) -> bool:
        """Check if entry is expired"""
        return time.time() > self.expiry_time
    
    def touch(self) -> None:
        """Update access time and count"""
        self.last_accessed = time.time()
        self.access_count += 1


class ContextCache:
    """LRU cache with TTL for memory context data"""
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 3600):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = asyncio.Lock()
        
        # Statistics
        self.hits = 0
        self.misses = 0
        self.evictions = 0
        self.expirations = 0
        
        # Background cleanup task
        self._cleanup_task = asyncio.create_task(self._background_cleanup())
        
    async def get(self, key: str) -> Optional[MemoryContext]:
        """Get item from cache"""
        async with self._lock:
            if key not in self._cache:
                self.misses += 1
                return None
                
            entry = self._cache[key]
            
            # Check if expired
            if entry.is_expired():
                del self._cache[key]
                self.expirations += 1
                self.misses += 1
                return None
                
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            entry.touch()
            self.hits += 1
            
            logger.debug(f"Cache hit for key: {key[:8]}...")
            return entry.data
    
    async def set(self, key: str, value: MemoryContext, ttl: Optional[int] = None) -> None:
        """Set item in cache"""
        async with self._lock:
            current_time = time.time()
            expiry_time = current_time + (ttl or self.default_ttl)
            
            entry = CacheEntry(
                data=value,
                created_at=current_time,
                last_accessed=current_time,
                access_count=1,
                expiry_time=expiry_time
            )
            
            # Remove existing entry if present
            if key in self._cache:
                del self._cache[key]
                
            # Add new entry
            self._cache[key] = entry
            
            # Evict oldest entries if over capacity
            while len(self._cache) > self.max_size:
                oldest_key = next(iter(self._cache))
                del self._cache[oldest_key]
                self.evictions += 1
                
            logger.debug(f"Cache set for key: {key[:8]}... (TTL: {ttl or self.default_ttl}s)")
    
    async def delete(self, key: str) -> bool:
        """Delete item from cache"""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                logger.debug(f"Cache delete for key: {key[:8]}...")
                return True
            return False
    
    async def clear(self) -> None:
        """Clear all cache entries"""
        async with self._lock:
            self._cache.clear()
            logger.info("Cache cleared")
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        async with self._lock:
            total_requests = self.hits + self.misses
            hit_rate = self.hits / total_requests if total_requests > 0 else 0.0
            
            return {
                'size': len(self._cache),
                'max_size': self.max_size,
                'hits': self.hits,
                'misses': self.misses,
                'hit_rate': hit_rate,
                'evictions': self.evictions,
                'expirations': self.expirations,
                'total_requests': total_requests
            }
    
    async def get_memory_usage(self) -> Dict[str, Any]:
        """Estimate memory usage of cache"""
        async with self._lock:
            # Rough estimation of memory usage
            entry_count = len(self._cache)
            
            # Estimate average entry size (rough approximation)
            avg_entry_size = 1024  # 1KB per entry (conservative estimate)
            total_size_bytes = entry_count * avg_entry_size
            
            return {
                'entries': entry_count,
                'estimated_size_bytes': total_size_bytes,
                'estimated_size_mb': total_size_bytes / (1024 * 1024)
            }
    
    async def _background_cleanup(self) -> None:
        """Background task to clean up expired entries"""
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes
                
                async with self._lock:
                    current_time = time.time()
                    expired_keys = []
                    
                    for key, entry in self._cache.items():
                        if entry.is_expired():
                            expired_keys.append(key)
                    
                    for key in expired_keys:
                        del self._cache[key]
                        self.expirations += 1
                    
                    if expired_keys:
                        logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")
                        
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cache cleanup error: {e}")
    
    async def close(self) -> None:
        """Close cache and cleanup resources"""
        self._cleanup_task.cancel()
        try:
            await self._cleanup_task
        except asyncio.CancelledError:
            pass
        
        await self.clear()
        logger.info("Context cache closed")


class QueryCache:
    """Specialized cache for query results"""
    
    def __init__(self, max_size: int = 500, default_ttl: int = 1800):
        self.context_cache = ContextCache(max_size, default_ttl)
        
    async def get_query_result(self, query_hash: str) -> Optional[Dict[str, Any]]:
        """Get cached query result"""
        context = await self.context_cache.get(f"query:{query_hash}")
        if context and hasattr(context, 'metadata') and 'cached_result' in context.metadata:
            return context.metadata['cached_result']
        return None
    
    async def cache_query_result(self, query_hash: str, result: Dict[str, Any], 
                                ttl: Optional[int] = None) -> None:
        """Cache query result"""
        # Create a minimal context with cached result
        context = MemoryContext()
        context.metadata['cached_result'] = result
        context.metadata['cached_at'] = time.time()
        
        await self.context_cache.set(f"query:{query_hash}", context, ttl)
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get query cache statistics"""
        return await self.context_cache.get_stats()
    
    async def close(self) -> None:
        """Close query cache"""
        await self.context_cache.close()


class SchemaCache:
    """Specialized cache for database schema information"""
    
    def __init__(self, max_size: int = 200, default_ttl: int = 7200):  # 2 hours TTL
        self.context_cache = ContextCache(max_size, default_ttl)
        
    async def get_project_schemas(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get cached project schemas"""
        context = await self.context_cache.get(f"schemas:{project_id}")
        if context and hasattr(context, 'metadata') and 'schemas' in context.metadata:
            return context.metadata['schemas']
        return None
    
    async def cache_project_schemas(self, project_id: str, schemas: Dict[str, Any], 
                                   ttl: Optional[int] = None) -> None:
        """Cache project schemas"""
        context = MemoryContext()
        context.metadata['schemas'] = schemas
        context.metadata['cached_at'] = time.time()
        
        await self.context_cache.set(f"schemas:{project_id}", context, ttl)
    
    async def invalidate_project(self, project_id: str) -> None:
        """Invalidate cached schemas for a project"""
        await self.context_cache.delete(f"schemas:{project_id}")
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get schema cache statistics"""
        return await self.context_cache.get_stats()
    
    async def close(self) -> None:
        """Close schema cache"""
        await self.context_cache.close()


class MultiLevelCache:
    """Multi-level cache combining different cache types"""
    
    def __init__(self, config):
        self.context_cache = ContextCache(
            max_size=config.cache_size,
            default_ttl=config.cache_ttl
        )
        self.query_cache = QueryCache(
            max_size=config.cache_size // 2,
            default_ttl=config.cache_ttl // 2
        )
        self.schema_cache = SchemaCache(
            max_size=config.cache_size // 4,
            default_ttl=config.cache_ttl * 2
        )
        
    async def get_context(self, key: str) -> Optional[MemoryContext]:
        """Get context from cache"""
        return await self.context_cache.get(key)
    
    async def set_context(self, key: str, context: MemoryContext, ttl: Optional[int] = None) -> None:
        """Set context in cache"""
        await self.context_cache.set(key, context, ttl)
    
    async def get_query_result(self, query_hash: str) -> Optional[Dict[str, Any]]:
        """Get query result from cache"""
        return await self.query_cache.get_query_result(query_hash)
    
    async def cache_query_result(self, query_hash: str, result: Dict[str, Any], 
                                ttl: Optional[int] = None) -> None:
        """Cache query result"""
        await self.query_cache.cache_query_result(query_hash, result, ttl)
    
    async def get_project_schemas(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get project schemas from cache"""
        return await self.schema_cache.get_project_schemas(project_id)
    
    async def cache_project_schemas(self, project_id: str, schemas: Dict[str, Any], 
                                   ttl: Optional[int] = None) -> None:
        """Cache project schemas"""
        await self.schema_cache.cache_project_schemas(project_id, schemas, ttl)
    
    async def get_combined_stats(self) -> Dict[str, Any]:
        """Get combined statistics from all caches"""
        context_stats = await self.context_cache.get_stats()
        query_stats = await self.query_cache.get_stats()
        schema_stats = await self.schema_cache.get_stats()
        
        return {
            'context_cache': context_stats,
            'query_cache': query_stats,
            'schema_cache': schema_stats,
            'total_entries': (
                context_stats['size'] + 
                query_stats['size'] + 
                schema_stats['size']
            ),
            'combined_hit_rate': (
                (context_stats['hits'] + query_stats['hits'] + schema_stats['hits']) /
                max(1, context_stats['total_requests'] + query_stats['total_requests'] + schema_stats['total_requests'])
            )
        }
    
    async def close(self) -> None:
        """Close all caches"""
        await self.context_cache.close()
        await self.query_cache.close()
        await self.schema_cache.close()
        logger.info("Multi-level cache closed")
