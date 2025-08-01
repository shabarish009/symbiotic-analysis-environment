"""
Database Manager for Project Cortex
Handles SQLite database operations, schema management, and data persistence.
"""

import sqlite3
import json
import time
import hashlib
import logging
import asyncio
import aiosqlite
import os
import secrets
from typing import List, Dict, Any, Optional, Tuple
from contextlib import asynccontextmanager
from pathlib import Path

from .types import (
    ProjectInfo, SchemaInfo, QueryHistoryEntry, LearnedPattern, 
    MemoryStats, MemoryStatus, PatternType
)
from .config import MemoryConfig

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages SQLite database operations for Project Cortex"""
    
    def __init__(self, config: MemoryConfig):
        self.config = config
        self.db_path = Path(config.database_path)
        self.connection_pool = []
        self.pool_lock = asyncio.Lock()
        self._initialized = False

        # Security: Database encryption key management
        self.encryption_key = None
        if config.enable_encryption:
            self._setup_encryption()

        # Performance tracking
        self.query_count = 0
        self.total_query_time = 0.0
        self.slow_queries = []

    def _setup_encryption(self) -> None:
        """Setup database encryption key management"""
        key_file = self.db_path.parent / ".cortex_key"

        if key_file.exists():
            # Load existing key
            try:
                with open(key_file, 'rb') as f:
                    self.encryption_key = f.read()
                logger.info("Loaded existing encryption key")
            except Exception as e:
                logger.error(f"Failed to load encryption key: {e}")
                raise RuntimeError("Database encryption key corrupted")
        else:
            # Generate new key
            self.encryption_key = secrets.token_bytes(32)  # 256-bit key
            try:
                # Secure key storage with restricted permissions
                with open(key_file, 'wb') as f:
                    f.write(self.encryption_key)
                os.chmod(key_file, 0o600)  # Owner read/write only
                logger.info("Generated new encryption key")
            except Exception as e:
                logger.error(f"Failed to save encryption key: {e}")
                raise RuntimeError("Cannot secure database encryption key")

    async def _create_connection(self) -> aiosqlite.Connection:
        """Create a new database connection with proper security settings"""
        conn = await aiosqlite.connect(
            self.db_path,
            timeout=self.config.connection_timeout
        )

        # Apply encryption if enabled
        if self.config.enable_encryption and self.encryption_key:
            # Use PRAGMA key for SQLite encryption (SQLCipher compatible)
            key_hex = self.encryption_key.hex()
            await conn.execute(f"PRAGMA key = 'x\"{key_hex}\"'")

        # Security and performance settings
        await conn.execute("PRAGMA foreign_keys = ON")
        await conn.execute("PRAGMA journal_mode = WAL")
        await conn.execute("PRAGMA synchronous = NORMAL")
        await conn.execute("PRAGMA cache_size = 10000")
        await conn.execute("PRAGMA temp_store = MEMORY")

        # Security: Prevent unauthorized access
        await conn.execute("PRAGMA secure_delete = ON")

        return conn

    async def initialize(self) -> None:
        """Initialize database and create schema"""
        if self._initialized:
            return
            
        logger.info(f"Initializing Project Cortex database at {self.db_path}")
        
        # Ensure database directory exists
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Create database schema
        await self._create_schema()
        
        # Initialize connection pool
        await self._initialize_connection_pool()
        
        # Run database integrity check with recovery
        integrity_ok = await self._integrity_check_with_recovery()
        if not integrity_ok:
            logger.warning("Database integrity issues detected but recovery completed")

        self._initialized = True
        logger.info("Project Cortex database initialized successfully")
    
    async def _create_schema(self) -> None:
        """Create database schema"""
        schema_sql = """
        -- Core project and context tables
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at REAL DEFAULT (julianday('now')),
            last_accessed REAL DEFAULT (julianday('now')),
            metadata TEXT DEFAULT '{}'
        );
        
        CREATE TABLE IF NOT EXISTS database_schemas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            schema_name TEXT NOT NULL,
            table_name TEXT NOT NULL,
            column_info TEXT NOT NULL,
            relationships TEXT DEFAULT '[]',
            indexes TEXT DEFAULT '[]',
            constraints TEXT DEFAULT '[]',
            last_updated REAL DEFAULT (julianday('now')),
            metadata TEXT DEFAULT '{}',
            UNIQUE(project_id, schema_name, table_name)
        );
        
        CREATE TABLE IF NOT EXISTS query_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            query_text TEXT NOT NULL,
            query_hash TEXT NOT NULL,
            context TEXT DEFAULT '{}',
            consensus_result TEXT DEFAULT '{}',
            success_score REAL DEFAULT 0.0,
            execution_time REAL DEFAULT 0.0,
            timestamp REAL DEFAULT (julianday('now')),
            user_feedback INTEGER DEFAULT NULL,
            metadata TEXT DEFAULT '{}'
        );
        
        CREATE TABLE IF NOT EXISTS learned_patterns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            pattern_type TEXT NOT NULL,
            pattern_data TEXT NOT NULL,
            confidence REAL NOT NULL DEFAULT 0.0,
            usage_count INTEGER DEFAULT 1,
            last_used REAL DEFAULT (julianday('now')),
            created_at REAL DEFAULT (julianday('now')),
            metadata TEXT DEFAULT '{}'
        );
        
        CREATE TABLE IF NOT EXISTS context_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cache_key TEXT UNIQUE NOT NULL,
            context_data TEXT NOT NULL,
            expiry_time REAL NOT NULL,
            access_count INTEGER DEFAULT 0,
            created_at REAL DEFAULT (julianday('now'))
        );
        
        -- Performance indexes
        CREATE INDEX IF NOT EXISTS idx_projects_last_accessed ON projects(last_accessed);
        CREATE INDEX IF NOT EXISTS idx_schemas_project_id ON database_schemas(project_id);
        CREATE INDEX IF NOT EXISTS idx_schemas_table ON database_schemas(project_id, schema_name, table_name);
        CREATE INDEX IF NOT EXISTS idx_query_history_project ON query_history(project_id);
        CREATE INDEX IF NOT EXISTS idx_query_history_hash ON query_history(query_hash);
        CREATE INDEX IF NOT EXISTS idx_query_history_timestamp ON query_history(timestamp);
        CREATE INDEX IF NOT EXISTS idx_patterns_project ON learned_patterns(project_id);
        CREATE INDEX IF NOT EXISTS idx_patterns_type ON learned_patterns(pattern_type);
        CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON learned_patterns(confidence);
        CREATE INDEX IF NOT EXISTS idx_cache_key ON context_cache(cache_key);
        CREATE INDEX IF NOT EXISTS idx_cache_expiry ON context_cache(expiry_time);
        
        -- Database metadata table
        CREATE TABLE IF NOT EXISTS db_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at REAL DEFAULT (julianday('now'))
        );
        
        -- User corrections table for learning system
        CREATE TABLE IF NOT EXISTS user_corrections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL CHECK(length(session_id) <= 100),
            query_id TEXT NOT NULL CHECK(length(query_id) <= 100),
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            original_query TEXT NOT NULL CHECK(length(original_query) <= 10000),
            corrected_query TEXT CHECK(corrected_query IS NULL OR length(corrected_query) <= 10000),
            correction_type TEXT NOT NULL CHECK(correction_type IN ('edit', 'replacement', 'refinement', 'feedback', 'suggestion')),
            feedback_score INTEGER CHECK(feedback_score IS NULL OR feedback_score BETWEEN -1 AND 1),
            correction_reason TEXT CHECK(correction_reason IS NULL OR length(correction_reason) <= 1000),
            context TEXT DEFAULT '{}' CHECK(json_valid(context)),
            timestamp REAL DEFAULT (julianday('now')) NOT NULL,
            applied BOOLEAN DEFAULT FALSE NOT NULL,
            confidence REAL DEFAULT 0.0 CHECK(confidence BETWEEN 0.0 AND 1.0),
            metadata TEXT DEFAULT '{}' CHECK(json_valid(metadata)),
            created_at REAL DEFAULT (julianday('now')) NOT NULL,
            updated_at REAL DEFAULT (julianday('now')) NOT NULL
        );

        -- Correction patterns table
        CREATE TABLE IF NOT EXISTS correction_patterns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            pattern_type TEXT NOT NULL CHECK(pattern_type IN ('query_structure', 'terminology', 'conditions', 'joins', 'style', 'feedback')),
            pattern_data TEXT NOT NULL CHECK(json_valid(pattern_data)),
            source_corrections TEXT NOT NULL CHECK(json_valid(source_corrections)), -- JSON array of correction IDs
            confidence REAL NOT NULL DEFAULT 0.0 CHECK(confidence BETWEEN 0.0 AND 1.0),
            usage_count INTEGER DEFAULT 0 CHECK(usage_count >= 0),
            success_rate REAL DEFAULT 0.0 CHECK(success_rate BETWEEN 0.0 AND 1.0),
            created_at REAL DEFAULT (julianday('now')) NOT NULL,
            last_applied REAL DEFAULT (julianday('now')) NOT NULL,
            metadata TEXT DEFAULT '{}' CHECK(json_valid(metadata)),
            is_active BOOLEAN DEFAULT TRUE NOT NULL,
            version INTEGER DEFAULT 1 NOT NULL
        );

        -- Session learning cache table
        CREATE TABLE IF NOT EXISTS session_learning (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL CHECK(length(session_id) <= 100),
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            learning_data TEXT NOT NULL CHECK(json_valid(learning_data)),
            corrections_applied TEXT DEFAULT '[]' CHECK(json_valid(corrections_applied)),
            patterns_learned TEXT DEFAULT '[]' CHECK(json_valid(patterns_learned)),
            created_at REAL DEFAULT (julianday('now')) NOT NULL,
            updated_at REAL DEFAULT (julianday('now')) NOT NULL,
            expires_at REAL NOT NULL CHECK(expires_at > created_at),
            is_active BOOLEAN DEFAULT TRUE NOT NULL,
            UNIQUE(session_id, project_id)
        );

        -- Enhanced indexes for correction learning performance
        CREATE INDEX IF NOT EXISTS idx_corrections_session ON user_corrections(session_id);
        CREATE INDEX IF NOT EXISTS idx_corrections_project ON user_corrections(project_id);
        CREATE INDEX IF NOT EXISTS idx_corrections_timestamp ON user_corrections(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_corrections_query_id ON user_corrections(query_id);
        CREATE INDEX IF NOT EXISTS idx_corrections_type ON user_corrections(correction_type);
        CREATE INDEX IF NOT EXISTS idx_corrections_confidence ON user_corrections(confidence DESC);
        CREATE INDEX IF NOT EXISTS idx_corrections_applied ON user_corrections(applied);
        CREATE INDEX IF NOT EXISTS idx_corrections_session_project ON user_corrections(session_id, project_id);
        CREATE INDEX IF NOT EXISTS idx_corrections_project_timestamp ON user_corrections(project_id, timestamp DESC);

        CREATE INDEX IF NOT EXISTS idx_correction_patterns_project ON correction_patterns(project_id);
        CREATE INDEX IF NOT EXISTS idx_correction_patterns_confidence ON correction_patterns(confidence DESC);
        CREATE INDEX IF NOT EXISTS idx_correction_patterns_type ON correction_patterns(pattern_type);
        CREATE INDEX IF NOT EXISTS idx_correction_patterns_active ON correction_patterns(is_active);
        CREATE INDEX IF NOT EXISTS idx_correction_patterns_usage ON correction_patterns(usage_count DESC);
        CREATE INDEX IF NOT EXISTS idx_correction_patterns_success ON correction_patterns(success_rate DESC);
        CREATE INDEX IF NOT EXISTS idx_correction_patterns_project_active ON correction_patterns(project_id, is_active);

        CREATE INDEX IF NOT EXISTS idx_session_learning_session ON session_learning(session_id);
        CREATE INDEX IF NOT EXISTS idx_session_learning_expires ON session_learning(expires_at);
        CREATE INDEX IF NOT EXISTS idx_session_learning_active ON session_learning(is_active);
        CREATE INDEX IF NOT EXISTS idx_session_learning_session_project ON session_learning(session_id, project_id);

        -- Triggers for automatic maintenance
        CREATE TRIGGER IF NOT EXISTS update_correction_timestamp
        AFTER UPDATE ON user_corrections
        FOR EACH ROW
        BEGIN
            UPDATE user_corrections SET updated_at = julianday('now') WHERE id = NEW.id;
        END;

        CREATE TRIGGER IF NOT EXISTS update_pattern_timestamp
        AFTER UPDATE ON correction_patterns
        FOR EACH ROW
        BEGIN
            UPDATE correction_patterns SET last_applied = julianday('now') WHERE id = NEW.id;
        END;

        CREATE TRIGGER IF NOT EXISTS update_session_learning_timestamp
        AFTER UPDATE ON session_learning
        FOR EACH ROW
        BEGIN
            UPDATE session_learning SET updated_at = julianday('now') WHERE id = NEW.id;
        END;

        -- Trigger to automatically clean up expired session learning
        CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions
        AFTER INSERT ON session_learning
        FOR EACH ROW
        WHEN (SELECT COUNT(*) FROM session_learning WHERE expires_at < julianday('now')) > 100
        BEGIN
            DELETE FROM session_learning WHERE expires_at < julianday('now');
        END;

        -- Trigger to update pattern usage statistics
        CREATE TRIGGER IF NOT EXISTS update_pattern_usage
        AFTER UPDATE OF usage_count ON correction_patterns
        FOR EACH ROW
        WHEN NEW.usage_count > OLD.usage_count
        BEGIN
            UPDATE correction_patterns
            SET success_rate = CASE
                WHEN NEW.usage_count > 0 THEN
                    (OLD.success_rate * OLD.usage_count + 1.0) / NEW.usage_count
                ELSE 0.0
            END
            WHERE id = NEW.id;
        END;

        -- Insert schema version
        INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('schema_version', '1.2');
        INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('created_at', julianday('now'));
        INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('correction_learning_enabled', 'true');
        """
        
        # Use secure connection for schema creation
        db = await self._create_connection()
        try:
            await db.executescript(schema_sql)
            await db.commit()
            logger.info("Database schema created successfully")
        finally:
            await db.close()
    
    async def _initialize_connection_pool(self) -> None:
        """Initialize connection pool with secure connections"""
        async with self.pool_lock:
            for _ in range(self.config.connection_pool_size):
                conn = await self._create_connection()
                self.connection_pool.append(conn)

        logger.info(f"Connection pool initialized with {len(self.connection_pool)} secure connections")
    
    @asynccontextmanager
    async def get_connection(self):
        """Get connection from pool"""
        async with self.pool_lock:
            if not self.connection_pool:
                # Create new secure connection if pool is empty
                conn = await self._create_connection()
            else:
                conn = self.connection_pool.pop()
        
        try:
            yield conn
        finally:
            async with self.pool_lock:
                if len(self.connection_pool) < self.config.connection_pool_size:
                    self.connection_pool.append(conn)
                else:
                    await conn.close()
    
    async def _integrity_check_with_recovery(self) -> bool:
        """Perform database integrity check with automatic recovery"""
        try:
            async with self.get_connection() as db:
                cursor = await db.execute("PRAGMA integrity_check")
                result = await cursor.fetchone()

                if result and result[0] == "ok":
                    logger.info("Database integrity check passed")
                    return True
                else:
                    logger.error(f"Database integrity check failed: {result}")
                    return await self._attempt_database_recovery()

        except Exception as e:
            logger.error(f"Database integrity check error: {e}")
            return await self._attempt_database_recovery()

    async def _attempt_database_recovery(self) -> bool:
        """Attempt to recover corrupted database"""
        logger.warning("Attempting database recovery...")

        try:
            # Create backup of corrupted database
            backup_path = f"{self.db_path}.corrupted.{int(time.time())}"
            if self.db_path.exists():
                import shutil
                shutil.copy2(self.db_path, backup_path)
                logger.info(f"Corrupted database backed up to: {backup_path}")

            # Remove corrupted database
            if self.db_path.exists():
                self.db_path.unlink()

            # Recreate database schema
            await self._create_schema()

            # Verify new database
            async with self.get_connection() as db:
                cursor = await db.execute("PRAGMA integrity_check")
                result = await cursor.fetchone()

                if result and result[0] == "ok":
                    logger.info("Database recovery successful - new database created")
                    return True
                else:
                    logger.error("Database recovery failed - new database also corrupted")
                    return False

        except Exception as e:
            logger.error(f"Database recovery failed: {e}")
            return False
    
    async def create_project(self, project_id: str, name: str, metadata: Optional[Dict[str, Any]] = None) -> ProjectInfo:
        """Create a new project"""
        project = ProjectInfo(
            id=project_id,
            name=name,
            metadata=metadata or {}
        )
        
        async with self.get_connection() as db:
            await db.execute(
                """INSERT OR REPLACE INTO projects (id, name, created_at, last_accessed, metadata)
                   VALUES (?, ?, ?, ?, ?)""",
                (project.id, project.name, project.created_at, project.last_accessed, 
                 json.dumps(project.metadata))
            )
            await db.commit()
            
        logger.info(f"Created project: {project_id}")
        return project
    
    async def get_project(self, project_id: str) -> Optional[ProjectInfo]:
        """Get project by ID"""
        async with self.get_connection() as db:
            cursor = await db.execute(
                "SELECT id, name, created_at, last_accessed, metadata FROM projects WHERE id = ?",
                (project_id,)
            )
            row = await cursor.fetchone()
            
            if row:
                return ProjectInfo(
                    id=row[0],
                    name=row[1],
                    created_at=row[2],
                    last_accessed=row[3],
                    metadata=json.loads(row[4])
                )
            return None
    
    async def update_project_access(self, project_id: str) -> None:
        """Update project last accessed time"""
        async with self.get_connection() as db:
            await db.execute(
                "UPDATE projects SET last_accessed = julianday('now') WHERE id = ?",
                (project_id,)
            )
            await db.commit()
    
    async def store_schema_info(self, project_id: str, schema_info: SchemaInfo) -> None:
        """Store database schema information"""
        async with self.get_connection() as db:
            await db.execute(
                """INSERT OR REPLACE INTO database_schemas 
                   (project_id, schema_name, table_name, column_info, relationships, 
                    indexes, constraints, last_updated, metadata)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (project_id, schema_info.schema_name, schema_info.table_name,
                 json.dumps(schema_info.columns), json.dumps(schema_info.relationships),
                 json.dumps(schema_info.indexes), json.dumps(schema_info.constraints),
                 schema_info.last_updated, json.dumps(schema_info.metadata))
            )
            await db.commit()
            
        logger.debug(f"Stored schema info for {schema_info.schema_name}.{schema_info.table_name}")
    
    async def get_schemas_for_project(self, project_id: str) -> List[SchemaInfo]:
        """Get all schemas for a project"""
        schemas = []
        
        async with self.get_connection() as db:
            cursor = await db.execute(
                """SELECT schema_name, table_name, column_info, relationships, 
                          indexes, constraints, last_updated, metadata
                   FROM database_schemas WHERE project_id = ?
                   ORDER BY schema_name, table_name""",
                (project_id,)
            )
            
            async for row in cursor:
                schema = SchemaInfo(
                    schema_name=row[0],
                    table_name=row[1],
                    columns=json.loads(row[2]),
                    relationships=json.loads(row[3]),
                    indexes=json.loads(row[4]),
                    constraints=json.loads(row[5]),
                    last_updated=row[6],
                    metadata=json.loads(row[7])
                )
                schemas.append(schema)
                
        return schemas

    def _generate_query_hash(self, query: str) -> str:
        """Generate hash for query deduplication"""
        # Normalize query for hashing
        normalized = query.strip().lower()
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]

    async def store_query_history(self, entry: QueryHistoryEntry) -> int:
        """Store query history entry"""
        if not entry.query_hash:
            entry.query_hash = self._generate_query_hash(entry.query_text)

        async with self.get_connection() as db:
            cursor = await db.execute(
                """INSERT INTO query_history
                   (project_id, query_text, query_hash, context, consensus_result,
                    success_score, execution_time, timestamp, user_feedback, metadata)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (entry.project_id, entry.query_text, entry.query_hash,
                 json.dumps(entry.context), json.dumps(entry.consensus_result),
                 entry.success_score, entry.execution_time, entry.timestamp,
                 entry.user_feedback, json.dumps(entry.metadata))
            )
            await db.commit()
            entry.id = cursor.lastrowid

        logger.debug(f"Stored query history entry: {entry.id}")
        return entry.id

    async def get_query_history(self, project_id: str, limit: int = 100,
                               offset: int = 0) -> List[QueryHistoryEntry]:
        """Get query history for project"""
        entries = []

        async with self.get_connection() as db:
            cursor = await db.execute(
                """SELECT id, project_id, query_text, query_hash, context, consensus_result,
                          success_score, execution_time, timestamp, user_feedback, metadata
                   FROM query_history WHERE project_id = ?
                   ORDER BY timestamp DESC LIMIT ? OFFSET ?""",
                (project_id, limit, offset)
            )

            async for row in cursor:
                entry = QueryHistoryEntry(
                    id=row[0],
                    project_id=row[1],
                    query_text=row[2],
                    query_hash=row[3],
                    context=json.loads(row[4]),
                    consensus_result=json.loads(row[5]),
                    success_score=row[6],
                    execution_time=row[7],
                    timestamp=row[8],
                    user_feedback=row[9],
                    metadata=json.loads(row[10])
                )
                entries.append(entry)

        return entries

    async def find_similar_queries(self, project_id: str, query_hash: str,
                                  limit: int = 5) -> List[QueryHistoryEntry]:
        """Find similar queries based on hash and success score"""
        entries = []

        async with self.get_connection() as db:
            cursor = await db.execute(
                """SELECT id, project_id, query_text, query_hash, context, consensus_result,
                          success_score, execution_time, timestamp, user_feedback, metadata
                   FROM query_history
                   WHERE project_id = ? AND query_hash = ? AND success_score > 0.7
                   ORDER BY success_score DESC, timestamp DESC LIMIT ?""",
                (project_id, query_hash, limit)
            )

            async for row in cursor:
                entry = QueryHistoryEntry(
                    id=row[0],
                    project_id=row[1],
                    query_text=row[2],
                    query_hash=row[3],
                    context=json.loads(row[4]),
                    consensus_result=json.loads(row[5]),
                    success_score=row[6],
                    execution_time=row[7],
                    timestamp=row[8],
                    user_feedback=row[9],
                    metadata=json.loads(row[10])
                )
                entries.append(entry)

        return entries

    async def store_learned_pattern(self, pattern: LearnedPattern) -> int:
        """Store learned pattern"""
        async with self.get_connection() as db:
            cursor = await db.execute(
                """INSERT INTO learned_patterns
                   (project_id, pattern_type, pattern_data, confidence, usage_count,
                    last_used, created_at, metadata)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (pattern.project_id, pattern.pattern_type.value, json.dumps(pattern.pattern_data),
                 pattern.confidence, pattern.usage_count, pattern.last_used,
                 pattern.created_at, json.dumps(pattern.metadata))
            )
            await db.commit()
            pattern.id = cursor.lastrowid

        logger.debug(f"Stored learned pattern: {pattern.id}")
        return pattern.id

    async def get_learned_patterns(self, project_id: str, pattern_type: Optional[PatternType] = None,
                                  min_confidence: float = 0.0, limit: int = 50) -> List[LearnedPattern]:
        """Get learned patterns for project"""
        patterns = []

        query = """SELECT id, project_id, pattern_type, pattern_data, confidence,
                          usage_count, last_used, created_at, metadata
                   FROM learned_patterns WHERE project_id = ? AND confidence >= ?"""
        params = [project_id, min_confidence]

        if pattern_type:
            query += " AND pattern_type = ?"
            params.append(pattern_type.value)

        query += " ORDER BY confidence DESC, usage_count DESC LIMIT ?"
        params.append(limit)

        async with self.get_connection() as db:
            cursor = await db.execute(query, params)

            async for row in cursor:
                pattern = LearnedPattern(
                    id=row[0],
                    project_id=row[1],
                    pattern_type=PatternType(row[2]),
                    pattern_data=json.loads(row[3]),
                    confidence=row[4],
                    usage_count=row[5],
                    last_used=row[6],
                    created_at=row[7],
                    metadata=json.loads(row[8])
                )
                patterns.append(pattern)

        return patterns

    async def update_pattern_usage(self, pattern_id: int) -> None:
        """Update pattern usage statistics"""
        async with self.get_connection() as db:
            await db.execute(
                """UPDATE learned_patterns
                   SET usage_count = usage_count + 1, last_used = julianday('now')
                   WHERE id = ?""",
                (pattern_id,)
            )
            await db.commit()

    async def get_memory_stats(self, project_id: Optional[str] = None) -> MemoryStats:
        """Get memory system statistics"""
        stats = MemoryStats()

        async with self.get_connection() as db:
            # Project count
            cursor = await db.execute("SELECT COUNT(*) FROM projects")
            stats.project_count = (await cursor.fetchone())[0]

            # Schema count
            if project_id:
                cursor = await db.execute(
                    "SELECT COUNT(*) FROM database_schemas WHERE project_id = ?",
                    (project_id,)
                )
            else:
                cursor = await db.execute("SELECT COUNT(*) FROM database_schemas")
            stats.schema_count = (await cursor.fetchone())[0]

            # Query count
            if project_id:
                cursor = await db.execute(
                    "SELECT COUNT(*) FROM query_history WHERE project_id = ?",
                    (project_id,)
                )
            else:
                cursor = await db.execute("SELECT COUNT(*) FROM query_history")
            stats.query_count = (await cursor.fetchone())[0]

            # Pattern count
            if project_id:
                cursor = await db.execute(
                    "SELECT COUNT(*) FROM learned_patterns WHERE project_id = ?",
                    (project_id,)
                )
            else:
                cursor = await db.execute("SELECT COUNT(*) FROM learned_patterns")
            stats.pattern_count = (await cursor.fetchone())[0]

            # Database size
            cursor = await db.execute("PRAGMA page_count")
            page_count = (await cursor.fetchone())[0]
            cursor = await db.execute("PRAGMA page_size")
            page_size = (await cursor.fetchone())[0]
            stats.database_size_mb = (page_count * page_size) / (1024 * 1024)

        # Performance stats
        if self.query_count > 0:
            stats.avg_retrieval_time = self.total_query_time / self.query_count

        stats.health_status = MemoryStatus.SUCCESS
        return stats

    async def cleanup_old_data(self, retention_days: int = 365) -> Dict[str, int]:
        """Clean up old data based on retention policy"""
        cutoff_time = time.time() - (retention_days * 24 * 3600)
        cleanup_stats = {'queries_deleted': 0, 'patterns_deleted': 0, 'cache_deleted': 0}

        async with self.get_connection() as db:
            # Clean up old query history
            cursor = await db.execute(
                "DELETE FROM query_history WHERE timestamp < ?",
                (cutoff_time,)
            )
            cleanup_stats['queries_deleted'] = cursor.rowcount

            # Clean up unused patterns (low confidence, not used recently)
            cursor = await db.execute(
                """DELETE FROM learned_patterns
                   WHERE confidence < ? AND last_used < ?""",
                (self.config.min_pattern_confidence, cutoff_time)
            )
            cleanup_stats['patterns_deleted'] = cursor.rowcount

            # Clean up expired cache entries
            cursor = await db.execute(
                "DELETE FROM context_cache WHERE expiry_time < julianday('now')"
            )
            cleanup_stats['cache_deleted'] = cursor.rowcount

            await db.commit()

        logger.info(f"Cleanup completed: {cleanup_stats}")
        return cleanup_stats

    async def vacuum_database(self) -> None:
        """Vacuum database to reclaim space"""
        async with self.get_connection() as db:
            await db.execute("VACUUM")

        logger.info("Database vacuum completed")

    async def backup_database(self, backup_path: str) -> bool:
        """Create database backup"""
        try:
            async with self.get_connection() as db:
                await db.execute(f"VACUUM INTO '{backup_path}'")

            logger.info(f"Database backup created: {backup_path}")
            return True

        except Exception as e:
            logger.error(f"Database backup failed: {e}")
            return False

    async def close(self) -> None:
        """Close all database connections"""
        async with self.pool_lock:
            for conn in self.connection_pool:
                await conn.close()
            self.connection_pool.clear()

        logger.info("Database connections closed")

    # Correction Learning Methods
    async def get_session_learning(self, session_id: str, project_id: str):
        """Get session learning data"""
        from ..corrections.manager import CorrectionManager
        correction_manager = CorrectionManager(self)
        return await correction_manager.get_session_learning(session_id, project_id)

    async def store_session_learning(self, session_learning):
        """Store session learning data"""
        from ..corrections.manager import CorrectionManager
        correction_manager = CorrectionManager(self)
        return await correction_manager.store_session_learning(session_learning)

    async def cleanup_expired_session_learning(self):
        """Clean up expired session learning data"""
        from ..corrections.manager import CorrectionManager
        correction_manager = CorrectionManager(self)
        return await correction_manager.cleanup_expired_session_learning()
