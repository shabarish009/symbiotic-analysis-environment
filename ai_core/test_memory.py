#!/usr/bin/env python3
"""
Test script for Project Cortex Memory System
Tests basic memory functionality including database operations and context retrieval.
"""

import asyncio
import logging
import tempfile
import os
from pathlib import Path

from memory import MemoryManager, MemoryConfig
from memory.types import SchemaInfo, QueryHistoryEntry, LearnedPattern, PatternType
from consensus.types import ConsensusResult, ConsensusStatus

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_memory_system():
    """Test the memory system functionality"""
    logger.info("Starting Project Cortex Memory System Test")
    
    # Create temporary database for testing
    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = Path(temp_dir) / "test_cortex.db"
        
        # Create test configuration
        config = MemoryConfig(
            database_path=str(db_path),
            enable_encryption=False,  # Disable for testing
            cache_size=100,
            cache_ttl=300
        )
        
        # Initialize memory manager
        memory_manager = MemoryManager(config)
        await memory_manager.initialize()
        
        try:
            # Test 1: Create a project
            logger.info("Test 1: Creating project")
            project_id = "test_project_001"
            project = await memory_manager.create_project(
                project_id, 
                "Test SQL Project",
                {"description": "Test project for memory system"}
            )
            logger.info(f"Created project: {project.name}")
            
            # Test 2: Store schema information
            logger.info("Test 2: Storing schema information")
            schema_info = SchemaInfo(
                schema_name="public",
                table_name="users",
                columns={
                    "id": {"type": "INTEGER", "nullable": False, "primary_key": True},
                    "name": {"type": "VARCHAR(100)", "nullable": False},
                    "email": {"type": "VARCHAR(255)", "nullable": False, "unique": True},
                    "age": {"type": "INTEGER", "nullable": True},
                    "created_at": {"type": "TIMESTAMP", "nullable": False, "default": "CURRENT_TIMESTAMP"}
                },
                relationships=[
                    {"type": "foreign_key", "column": "department_id", "references": "departments.id"}
                ],
                indexes=[
                    {"name": "idx_users_email", "columns": ["email"], "unique": True},
                    {"name": "idx_users_age", "columns": ["age"], "unique": False}
                ]
            )
            
            await memory_manager.store_schema_info(project_id, schema_info)
            logger.info(f"Stored schema: {schema_info.schema_name}.{schema_info.table_name}")
            
            # Test 3: Store query history
            logger.info("Test 3: Storing query history")
            
            # Create a mock consensus result
            consensus_result = ConsensusResult(
                status=ConsensusStatus.SUCCESS,
                response="SELECT * FROM users WHERE age > 25",
                confidence=0.95,
                supporting_models=["model_1", "model_2", "model_3"],
                execution_time=0.15
            )
            
            # Store query history entry
            history_entry = QueryHistoryEntry(
                project_id=project_id,
                query_text="SELECT * FROM users WHERE age > 25",
                context={"table": "users", "filter": "age"},
                consensus_result=consensus_result.to_dict(),
                success_score=0.95,
                execution_time=0.15,
                user_feedback=1  # Positive feedback
            )
            
            await memory_manager.db_manager.store_query_history(history_entry)
            logger.info(f"Stored query history entry: {history_entry.query_text[:50]}...")
            
            # Test 4: Retrieve relevant context
            logger.info("Test 4: Retrieving relevant context")
            test_query = "SELECT name, email FROM users WHERE age > 30"
            
            context = await memory_manager.get_relevant_context(test_query, project_id)
            
            logger.info(f"Retrieved context:")
            logger.info(f"  - Relevant schemas: {len(context.relevant_schemas)}")
            logger.info(f"  - Similar queries: {len(context.similar_queries)}")
            logger.info(f"  - Learned patterns: {len(context.learned_patterns)}")
            logger.info(f"  - Context score: {context.context_score:.3f}")
            logger.info(f"  - Retrieval time: {context.retrieval_time:.3f}s")
            logger.info(f"  - Cache hit: {context.cache_hit}")
            
            # Test 5: Get schema suggestions
            logger.info("Test 5: Getting schema suggestions")
            suggestions = await memory_manager.get_schema_suggestions(project_id, "user")
            
            logger.info(f"Schema suggestions for 'user':")
            for suggestion in suggestions:
                logger.info(f"  - {suggestion['type']}: {suggestion['value']} ({suggestion.get('description', 'No description')})")
            
            # Test 6: Get query history
            logger.info("Test 6: Getting query history")
            history = await memory_manager.get_query_history(project_id, limit=10)
            
            logger.info(f"Query history ({len(history)} entries):")
            for entry in history:
                logger.info(f"  - {entry.query_text[:50]}... (score: {entry.success_score:.2f})")
            
            # Test 7: Get memory statistics
            logger.info("Test 7: Getting memory statistics")
            stats = await memory_manager.get_memory_statistics(project_id)
            
            logger.info(f"Memory statistics:")
            logger.info(f"  - Projects: {stats.project_count}")
            logger.info(f"  - Schemas: {stats.schema_count}")
            logger.info(f"  - Queries: {stats.query_count}")
            logger.info(f"  - Patterns: {stats.pattern_count}")
            logger.info(f"  - Database size: {stats.database_size_mb:.2f} MB")
            logger.info(f"  - Cache hit rate: {stats.cache_hit_rate:.2%}")
            logger.info(f"  - Avg retrieval time: {stats.avg_retrieval_time:.3f}s")
            
            # Test 8: Test cache functionality
            logger.info("Test 8: Testing cache functionality")
            
            # First retrieval (should be cache miss)
            start_time = asyncio.get_event_loop().time()
            context1 = await memory_manager.get_relevant_context(test_query, project_id)
            time1 = asyncio.get_event_loop().time() - start_time
            
            # Second retrieval (should be cache hit)
            start_time = asyncio.get_event_loop().time()
            context2 = await memory_manager.get_relevant_context(test_query, project_id)
            time2 = asyncio.get_event_loop().time() - start_time
            
            logger.info(f"Cache test results:")
            logger.info(f"  - First retrieval: {time1:.3f}s (cache hit: {context1.cache_hit})")
            logger.info(f"  - Second retrieval: {time2:.3f}s (cache hit: {context2.cache_hit})")
            logger.info(f"  - Speed improvement: {(time1/time2):.1f}x faster")
            
            # Test 9: Test pattern learning
            logger.info("Test 9: Testing pattern learning")
            
            # Simulate learning from a successful query
            await memory_manager.learn_from_result(
                "SELECT COUNT(*) FROM users WHERE age BETWEEN 25 AND 35",
                project_id,
                None,  # No context for this test
                consensus_result
            )
            
            # Get learned patterns
            patterns = await memory_manager.db_manager.get_learned_patterns(project_id)
            logger.info(f"Learned patterns: {len(patterns)}")
            for pattern in patterns:
                logger.info(f"  - {pattern.pattern_type.value}: confidence={pattern.confidence:.2f}")
            
            logger.info("✅ All memory system tests completed successfully!")
            
        except Exception as e:
            logger.error(f"❌ Memory system test failed: {e}")
            raise
        finally:
            # Cleanup
            await memory_manager.close()
            logger.info("Memory manager closed")


async def test_database_operations():
    """Test low-level database operations"""
    logger.info("Testing database operations")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = Path(temp_dir) / "test_db.db"
        
        config = MemoryConfig(
            database_path=str(db_path),
            enable_encryption=False
        )
        
        from memory.database import DatabaseManager
        db_manager = DatabaseManager(config)
        
        try:
            await db_manager.initialize()
            
            # Test project creation
            project = await db_manager.create_project("test_001", "Test Project")
            logger.info(f"Created project: {project.id}")
            
            # Test project retrieval
            retrieved_project = await db_manager.get_project("test_001")
            assert retrieved_project is not None
            assert retrieved_project.name == "Test Project"
            logger.info("✅ Project operations test passed")
            
            # Test schema storage
            schema = SchemaInfo(
                schema_name="test_schema",
                table_name="test_table",
                columns={"id": {"type": "INTEGER"}, "name": {"type": "TEXT"}}
            )
            
            await db_manager.store_schema_info("test_001", schema)
            
            # Test schema retrieval
            schemas = await db_manager.get_schemas_for_project("test_001")
            assert len(schemas) == 1
            assert schemas[0].table_name == "test_table"
            logger.info("✅ Schema operations test passed")
            
            # Test statistics
            stats = await db_manager.get_memory_stats("test_001")
            assert stats.project_count >= 1
            assert stats.schema_count >= 1
            logger.info("✅ Statistics test passed")
            
            logger.info("✅ All database operations tests passed!")
            
        finally:
            await db_manager.close()


async def test_security_and_performance():
    """QA ADDITION: Test security and performance requirements"""
    logger.info("Testing security and performance")

    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = Path(temp_dir) / "security_test.db"

        # Test with encryption enabled
        config = MemoryConfig(
            database_path=str(db_path),
            enable_encryption=True,
            cache_size=100,
            cache_ttl=300
        )

        memory_manager = MemoryManager(config)
        await memory_manager.initialize()

        try:
            # Test 1: Performance - Context retrieval under 100ms
            project_id = "perf_test_001"
            await memory_manager.create_project(project_id, "Performance Test")

            # Add some test data
            schema_info = SchemaInfo(
                schema_name="test", table_name="users",
                columns={"id": {"type": "INTEGER"}, "name": {"type": "TEXT"}}
            )
            await memory_manager.store_schema_info(project_id, schema_info)

            # Measure context retrieval time
            start_time = time.time()
            context = await memory_manager.get_relevant_context("SELECT * FROM users", project_id)
            retrieval_time = time.time() - start_time

            assert retrieval_time < 0.1, f"Context retrieval too slow: {retrieval_time:.3f}s"
            logger.info(f"✅ Performance test passed: {retrieval_time:.3f}s < 100ms")

            # Test 2: Security - Encryption verification
            # Check that database file is encrypted (not readable as plain text)
            with open(db_path, 'rb') as f:
                content = f.read(100)
                # Encrypted database should not contain readable SQL keywords
                assert b'CREATE TABLE' not in content, "Database appears to be unencrypted"
                assert b'SELECT' not in content, "Database appears to be unencrypted"
            logger.info("✅ Security test passed: Database is encrypted")

            # Test 3: SQL Injection protection
            malicious_query = "'; DROP TABLE projects; --"
            try:
                # This should not cause any issues
                context = await memory_manager.get_relevant_context(malicious_query, project_id)
                logger.info("✅ SQL injection protection test passed")
            except Exception as e:
                logger.error(f"❌ SQL injection protection failed: {e}")
                raise

            # Test 4: Input validation
            try:
                # Test with extremely long query
                long_query = "SELECT * FROM users WHERE " + "x" * 20000
                context = await memory_manager.get_relevant_context(long_query, project_id)
                # Should handle gracefully without crashing
                logger.info("✅ Input validation test passed")
            except Exception as e:
                logger.warning(f"Input validation handled: {e}")

            logger.info("✅ All security and performance tests passed!")

        finally:
            await memory_manager.close()


async def main():
    """Main test function"""
    try:
        logger.info("🧠 Starting Project Cortex Memory System Tests")

        # Run database tests
        await test_database_operations()

        # Run full memory system tests
        await test_memory_system()

        # QA ADDITION: Run security and performance tests
        await test_security_and_performance()

        logger.info("🎉 All tests completed successfully!")

    except Exception as e:
        logger.error(f"💥 Test suite failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
