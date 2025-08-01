"""
Correction Manager
Database operations and management for correction learning system.
"""

import json
import logging
import time
from typing import Dict, Any, List, Optional

from .types import (
    UserCorrection, CorrectionPattern, SessionLearning, CorrectionStats,
    CorrectionType, FeedbackScore, CorrectionPatternType
)

logger = logging.getLogger(__name__)


class CorrectionManager:
    """Manages database operations for correction learning"""
    
    def __init__(self, db_manager):
        self.db_manager = db_manager
    
    async def store_correction(self, correction: UserCorrection) -> Optional[int]:
        """Store a user correction in the database"""
        try:
            async with self.db_manager.get_connection() as db:
                cursor = await db.execute("""
                    INSERT INTO user_corrections (
                        session_id, query_id, project_id, original_query, corrected_query,
                        correction_type, feedback_score, correction_reason, context,
                        timestamp, applied, confidence, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    correction.session_id,
                    correction.query_id,
                    correction.project_id,
                    correction.original_query,
                    correction.corrected_query,
                    correction.correction_type.value,
                    correction.feedback_score.value if correction.feedback_score else None,
                    correction.correction_reason,
                    json.dumps(correction.context),
                    correction.timestamp,
                    correction.applied,
                    correction.confidence,
                    json.dumps(correction.metadata)
                ))
                
                correction_id = cursor.lastrowid
                await db.commit()
                
                logger.debug(f"Stored correction with ID: {correction_id}")
                return correction_id
                
        except Exception as e:
            logger.error(f"Error storing correction: {e}")
            return None
    
    async def get_correction(self, correction_id: int) -> Optional[UserCorrection]:
        """Get a correction by ID"""
        try:
            async with self.db_manager.get_connection() as db:
                cursor = await db.execute("""
                    SELECT id, session_id, query_id, project_id, original_query, corrected_query,
                           correction_type, feedback_score, correction_reason, context,
                           timestamp, applied, confidence, metadata
                    FROM user_corrections
                    WHERE id = ?
                """, (correction_id,))
                
                row = await cursor.fetchone()
                if row:
                    return self._row_to_correction(row)
                
                return None
                
        except Exception as e:
            logger.error(f"Error getting correction {correction_id}: {e}")
            return None
    
    async def get_corrections_for_session(self, session_id: str, 
                                        project_id: str) -> List[UserCorrection]:
        """Get all corrections for a session"""
        try:
            async with self.db_manager.get_connection() as db:
                cursor = await db.execute("""
                    SELECT id, session_id, query_id, project_id, original_query, corrected_query,
                           correction_type, feedback_score, correction_reason, context,
                           timestamp, applied, confidence, metadata
                    FROM user_corrections
                    WHERE session_id = ? AND project_id = ?
                    ORDER BY timestamp ASC
                """, (session_id, project_id))
                
                corrections = []
                async for row in cursor:
                    correction = self._row_to_correction(row)
                    if correction:
                        corrections.append(correction)
                
                return corrections
                
        except Exception as e:
            logger.error(f"Error getting corrections for session {session_id}: {e}")
            return []
    
    async def get_corrections_for_project(self, project_id: str, 
                                        limit: int = 100) -> List[UserCorrection]:
        """Get recent corrections for a project"""
        try:
            async with self.db_manager.get_connection() as db:
                cursor = await db.execute("""
                    SELECT id, session_id, query_id, project_id, original_query, corrected_query,
                           correction_type, feedback_score, correction_reason, context,
                           timestamp, applied, confidence, metadata
                    FROM user_corrections
                    WHERE project_id = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                """, (project_id, limit))
                
                corrections = []
                async for row in cursor:
                    correction = self._row_to_correction(row)
                    if correction:
                        corrections.append(correction)
                
                return corrections
                
        except Exception as e:
            logger.error(f"Error getting corrections for project {project_id}: {e}")
            return []
    
    async def store_correction_pattern(self, pattern: CorrectionPattern) -> Optional[int]:
        """Store a correction pattern in the database"""
        try:
            async with self.db_manager.get_connection() as db:
                cursor = await db.execute("""
                    INSERT INTO correction_patterns (
                        project_id, pattern_type, pattern_data, source_corrections,
                        confidence, usage_count, success_rate, created_at, last_applied, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    pattern.project_id,
                    pattern.pattern_type.value,
                    json.dumps(pattern.pattern_data),
                    json.dumps(pattern.source_corrections),
                    pattern.confidence,
                    pattern.usage_count,
                    pattern.success_rate,
                    pattern.created_at,
                    pattern.last_applied,
                    json.dumps(pattern.metadata)
                ))
                
                pattern_id = cursor.lastrowid
                await db.commit()
                
                logger.debug(f"Stored correction pattern with ID: {pattern_id}")
                return pattern_id
                
        except Exception as e:
            logger.error(f"Error storing correction pattern: {e}")
            return None
    
    async def get_correction_patterns(self, project_id: str) -> List[CorrectionPattern]:
        """Get correction patterns for a project"""
        try:
            async with self.db_manager.get_connection() as db:
                cursor = await db.execute("""
                    SELECT id, project_id, pattern_type, pattern_data, source_corrections,
                           confidence, usage_count, success_rate, created_at, last_applied, metadata
                    FROM correction_patterns
                    WHERE project_id = ?
                    ORDER BY confidence DESC, usage_count DESC
                """, (project_id,))
                
                patterns = []
                async for row in cursor:
                    pattern = self._row_to_correction_pattern(row)
                    if pattern:
                        patterns.append(pattern)
                
                return patterns
                
        except Exception as e:
            logger.error(f"Error getting correction patterns for project {project_id}: {e}")
            return []
    
    async def store_session_learning(self, session_learning: SessionLearning) -> Optional[int]:
        """Store session learning data"""
        try:
            async with self.db_manager.get_connection() as db:
                # Use INSERT OR REPLACE to handle updates
                cursor = await db.execute("""
                    INSERT OR REPLACE INTO session_learning (
                        session_id, project_id, learning_data, created_at, expires_at
                    ) VALUES (?, ?, ?, ?, ?)
                """, (
                    session_learning.session_id,
                    session_learning.project_id,
                    json.dumps(session_learning.learning_data),
                    session_learning.created_at,
                    session_learning.expires_at
                ))
                
                learning_id = cursor.lastrowid
                await db.commit()
                
                return learning_id
                
        except Exception as e:
            logger.error(f"Error storing session learning: {e}")
            return None
    
    async def get_session_learning(self, session_id: str, 
                                 project_id: str) -> Optional[SessionLearning]:
        """Get session learning data"""
        try:
            async with self.db_manager.get_connection() as db:
                cursor = await db.execute("""
                    SELECT id, session_id, project_id, learning_data, created_at, expires_at
                    FROM session_learning
                    WHERE session_id = ? AND project_id = ?
                """, (session_id, project_id))
                
                row = await cursor.fetchone()
                if row:
                    return SessionLearning(
                        id=row[0],
                        session_id=row[1],
                        project_id=row[2],
                        learning_data=json.loads(row[3]),
                        created_at=row[4],
                        expires_at=row[5]
                    )
                
                return None
                
        except Exception as e:
            logger.error(f"Error getting session learning: {e}")
            return None
    
    async def cleanup_expired_session_learning(self) -> int:
        """Clean up expired session learning data"""
        try:
            current_time = time.time()
            
            async with self.db_manager.get_connection() as db:
                cursor = await db.execute("""
                    DELETE FROM session_learning
                    WHERE expires_at < ?
                """, (current_time,))
                
                deleted_count = cursor.rowcount
                await db.commit()
                
                logger.info(f"Cleaned up {deleted_count} expired session learning records")
                return deleted_count
                
        except Exception as e:
            logger.error(f"Error cleaning up expired session learning: {e}")
            return 0
    
    async def get_correction_statistics(self, project_id: str) -> CorrectionStats:
        """Get correction statistics for a project"""
        try:
            stats = CorrectionStats()
            
            async with self.db_manager.get_connection() as db:
                # Total corrections
                cursor = await db.execute("""
                    SELECT COUNT(*) FROM user_corrections WHERE project_id = ?
                """, (project_id,))
                row = await cursor.fetchone()
                stats.total_corrections = row[0] if row else 0
                
                # Corrections by type
                cursor = await db.execute("""
                    SELECT correction_type, COUNT(*) 
                    FROM user_corrections 
                    WHERE project_id = ?
                    GROUP BY correction_type
                """, (project_id,))
                
                async for row in cursor:
                    stats.corrections_by_type[row[0]] = row[1]
                
                # Average confidence
                cursor = await db.execute("""
                    SELECT AVG(confidence) 
                    FROM user_corrections 
                    WHERE project_id = ? AND confidence > 0
                """, (project_id,))
                row = await cursor.fetchone()
                stats.average_confidence = row[0] if row and row[0] else 0.0
                
                # Patterns learned
                cursor = await db.execute("""
                    SELECT COUNT(*) FROM correction_patterns WHERE project_id = ?
                """, (project_id,))
                row = await cursor.fetchone()
                stats.patterns_learned = row[0] if row else 0
                
                # Success rate (positive feedback ratio)
                cursor = await db.execute("""
                    SELECT 
                        SUM(CASE WHEN feedback_score > 0 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) 
                    FROM user_corrections 
                    WHERE project_id = ? AND feedback_score IS NOT NULL
                """, (project_id,))
                row = await cursor.fetchone()
                stats.success_rate = row[0] if row and row[0] else 0.0
                
                # User satisfaction (average feedback score normalized)
                cursor = await db.execute("""
                    SELECT AVG(feedback_score) 
                    FROM user_corrections 
                    WHERE project_id = ? AND feedback_score IS NOT NULL
                """, (project_id,))
                row = await cursor.fetchone()
                if row and row[0] is not None:
                    stats.user_satisfaction = (row[0] + 1) / 2  # Normalize -1,1 to 0,1
                
                # Learning velocity
                if stats.total_corrections > 0:
                    stats.learning_velocity = stats.patterns_learned / stats.total_corrections
                
                return stats
                
        except Exception as e:
            logger.error(f"Error getting correction statistics: {e}")
            return CorrectionStats()
    
    def _row_to_correction(self, row) -> Optional[UserCorrection]:
        """Convert database row to UserCorrection object"""
        try:
            return UserCorrection(
                id=row[0],
                session_id=row[1],
                query_id=row[2],
                project_id=row[3],
                original_query=row[4],
                corrected_query=row[5],
                correction_type=CorrectionType(row[6]),
                feedback_score=FeedbackScore(row[7]) if row[7] is not None else None,
                correction_reason=row[8],
                context=json.loads(row[9]) if row[9] else {},
                timestamp=row[10],
                applied=row[11],
                confidence=row[12],
                metadata=json.loads(row[13]) if row[13] else {}
            )
        except Exception as e:
            logger.error(f"Error converting row to correction: {e}")
            return None
    
    def _row_to_correction_pattern(self, row) -> Optional[CorrectionPattern]:
        """Convert database row to CorrectionPattern object"""
        try:
            return CorrectionPattern(
                id=row[0],
                project_id=row[1],
                pattern_type=CorrectionPatternType(row[2]),
                pattern_data=json.loads(row[3]) if row[3] else {},
                source_corrections=json.loads(row[4]) if row[4] else [],
                confidence=row[5],
                usage_count=row[6],
                success_rate=row[7],
                created_at=row[8],
                last_applied=row[9],
                metadata=json.loads(row[10]) if row[10] else {}
            )
        except Exception as e:
            logger.error(f"Error converting row to correction pattern: {e}")
            return None
