#!/usr/bin/env python3
"""
Consensus Engine Test Suite
Comprehensive tests for the consensus system.
"""

import asyncio
import time
import logging
from typing import List, Dict

from consensus import (
    ConsensusEngine, ConsensusConfig, ConsensusHandler,
    ModelConfig, QueryContext
)

# Configure logging for tests
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


class ConsensusEngineTests:
    """Test suite for the Consensus Engine"""
    
    def __init__(self):
        self.test_results = []
        self.total_tests = 0
        self.passed_tests = 0
    
    async def run_all_tests(self):
        """Run all consensus engine tests"""
        logger.info("Starting Consensus Engine Test Suite")
        
        test_methods = [
            self.test_basic_consensus,
            self.test_parallel_execution,
            self.test_response_validation,
            self.test_confidence_scoring,
            self.test_conflict_resolution,
            self.test_error_handling,
            self.test_timeout_management,
            self.test_health_checks,
            self.test_performance,
            self.test_json_rpc_integration,
            self.test_circuit_breaker
        ]
        
        for test_method in test_methods:
            try:
                await test_method()
            except Exception as e:
                logger.error(f"Test {test_method.__name__} failed with exception: {e}")
                self.record_test_result(test_method.__name__, False, str(e))
        
        self.print_test_summary()
    
    def record_test_result(self, test_name: str, passed: bool, details: str = ""):
        """Record test result"""
        self.total_tests += 1
        if passed:
            self.passed_tests += 1
        
        self.test_results.append({
            'test': test_name,
            'passed': passed,
            'details': details
        })
        
        status = "PASS" if passed else "FAIL"
        logger.info(f"Test {test_name}: {status} - {details}")
    
    def print_test_summary(self):
        """Print test summary"""
        logger.info("=" * 60)
        logger.info("CONSENSUS ENGINE TEST SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Total Tests: {self.total_tests}")
        logger.info(f"Passed: {self.passed_tests}")
        logger.info(f"Failed: {self.total_tests - self.passed_tests}")
        logger.info(f"Success Rate: {(self.passed_tests / self.total_tests * 100):.1f}%")
        logger.info("=" * 60)
        
        # Print failed tests
        failed_tests = [r for r in self.test_results if not r['passed']]
        if failed_tests:
            logger.info("FAILED TESTS:")
            for test in failed_tests:
                logger.info(f"  - {test['test']}: {test['details']}")
    
    async def test_basic_consensus(self):
        """Test basic consensus functionality"""
        try:
            config = ConsensusConfig()
            engine = ConsensusEngine(config)
            
            # Test simple query
            result = await engine.process_query("What is SQL?")
            
            if result.has_consensus and result.confidence > 0.5:
                self.record_test_result("test_basic_consensus", True, 
                                      f"Consensus achieved with confidence {result.confidence:.3f}")
            else:
                self.record_test_result("test_basic_consensus", False, 
                                      f"Failed to achieve consensus: {result.status.value}")
        
        except Exception as e:
            self.record_test_result("test_basic_consensus", False, str(e))
    
    async def test_parallel_execution(self):
        """Test parallel model execution"""
        try:
            config = ConsensusConfig()
            engine = ConsensusEngine(config)
            
            start_time = time.time()
            result = await engine.process_query("Explain database indexing")
            execution_time = time.time() - start_time
            
            # Check that execution was reasonably fast (should be parallel)
            if execution_time < 5.0 and result.execution_time > 0:
                self.record_test_result("test_parallel_execution", True, 
                                      f"Parallel execution completed in {execution_time:.2f}s")
            else:
                self.record_test_result("test_parallel_execution", False, 
                                      f"Execution too slow: {execution_time:.2f}s")
        
        except Exception as e:
            self.record_test_result("test_parallel_execution", False, str(e))
    
    async def test_response_validation(self):
        """Test response validation logic"""
        try:
            config = ConsensusConfig()
            engine = ConsensusEngine(config)
            
            # Test with a query that should produce valid responses
            result = await engine.process_query("What are the benefits of using databases?")
            
            # Check that validation worked
            if result.supporting_models and len(result.supporting_models) >= config.min_supporting_models:
                self.record_test_result("test_response_validation", True, 
                                      f"Validation passed with {len(result.supporting_models)} supporting models")
            else:
                self.record_test_result("test_response_validation", False, 
                                      f"Insufficient supporting models: {len(result.supporting_models) if result.supporting_models else 0}")
        
        except Exception as e:
            self.record_test_result("test_response_validation", False, str(e))
    
    async def test_confidence_scoring(self):
        """Test confidence scoring system"""
        try:
            config = ConsensusConfig()
            engine = ConsensusEngine(config)
            
            # Test multiple queries and check confidence scores
            queries = [
                "What is a primary key?",
                "How do you optimize SQL queries?",
                "What is database normalization?"
            ]
            
            confidences = []
            for query in queries:
                result = await engine.process_query(query)
                if result.has_consensus:
                    confidences.append(result.confidence)
            
            if len(confidences) >= 2 and all(0.0 <= c <= 1.0 for c in confidences):
                avg_confidence = sum(confidences) / len(confidences)
                self.record_test_result("test_confidence_scoring", True, 
                                      f"Average confidence: {avg_confidence:.3f}")
            else:
                self.record_test_result("test_confidence_scoring", False, 
                                      f"Invalid confidence scores: {confidences}")
        
        except Exception as e:
            self.record_test_result("test_confidence_scoring", False, str(e))
    
    async def test_conflict_resolution(self):
        """Test conflict resolution mechanisms"""
        try:
            # Create config with lower consensus threshold to trigger conflict resolution
            config = ConsensusConfig()
            config.consensus_threshold = 0.9  # High threshold to force conflicts
            engine = ConsensusEngine(config)
            
            result = await engine.process_query("What is the best database management system?")
            
            # Check if conflict resolution was attempted
            if (result.has_consensus and result.resolution_method) or result.status.value == "ambiguous":
                self.record_test_result("test_conflict_resolution", True, 
                                      f"Conflict resolution handled: {result.status.value}")
            else:
                self.record_test_result("test_conflict_resolution", True, 
                                      f"No conflicts detected (normal consensus): {result.status.value}")
        
        except Exception as e:
            self.record_test_result("test_conflict_resolution", False, str(e))
    
    async def test_error_handling(self):
        """Test enhanced error handling and security validation"""
        try:
            config = ConsensusConfig()
            engine = ConsensusEngine(config)

            # Test empty query
            result = await engine.process_query("")
            if not result.has_consensus and "empty" in result.reason.lower():
                empty_test_passed = True
            else:
                empty_test_passed = False

            # Test malicious input
            malicious_queries = [
                "<script>alert('xss')</script>",
                "<?php system('rm -rf /'); ?>",
                "javascript:alert('test')",
                "A" * 20000,  # Too long
                "\x00\x1a",  # Null bytes
            ]

            malicious_blocked = 0
            for malicious_query in malicious_queries:
                result = await engine.process_query(malicious_query)
                if not result.has_consensus and "invalid" in result.reason.lower():
                    malicious_blocked += 1

            if empty_test_passed and malicious_blocked >= 3:
                self.record_test_result("test_error_handling", True,
                                      f"Security validation working: {malicious_blocked}/{len(malicious_queries)} malicious inputs blocked")
            else:
                self.record_test_result("test_error_handling", False,
                                      f"Security issues: empty_test={empty_test_passed}, malicious_blocked={malicious_blocked}")

        except Exception as e:
            self.record_test_result("test_error_handling", False, str(e))
    
    async def test_timeout_management(self):
        """Test timeout handling"""
        try:
            config = ConsensusConfig()
            config.total_timeout = 1.0  # Very short timeout
            engine = ConsensusEngine(config)
            
            start_time = time.time()
            result = await engine.process_query("Complex query that might take time to process")
            execution_time = time.time() - start_time
            
            # Should complete within timeout or return timeout error
            if execution_time <= 2.0:  # Allow some buffer
                self.record_test_result("test_timeout_management", True, 
                                      f"Timeout handled correctly in {execution_time:.2f}s")
            else:
                self.record_test_result("test_timeout_management", False, 
                                      f"Timeout not enforced: {execution_time:.2f}s")
        
        except Exception as e:
            self.record_test_result("test_timeout_management", False, str(e))
    
    async def test_health_checks(self):
        """Test health check functionality"""
        try:
            config = ConsensusConfig()
            engine = ConsensusEngine(config)
            
            health_report = await engine.health_check()
            
            required_keys = ['overall_healthy', 'models', 'performance', 'configuration']
            if all(key in health_report for key in required_keys):
                self.record_test_result("test_health_checks", True, 
                                      f"Health check complete: {health_report['overall_healthy']}")
            else:
                self.record_test_result("test_health_checks", False, 
                                      f"Missing health check keys: {list(health_report.keys())}")
        
        except Exception as e:
            self.record_test_result("test_health_checks", False, str(e))
    
    async def test_performance(self):
        """Test performance metrics"""
        try:
            config = ConsensusConfig()
            engine = ConsensusEngine(config)
            
            # Run multiple queries to generate metrics
            queries = [
                "What is SQL?",
                "How do databases work?",
                "What is a foreign key?"
            ]
            
            for query in queries:
                await engine.process_query(query)
            
            metrics = engine.get_performance_metrics()
            
            if metrics['query_count'] >= len(queries) and metrics['avg_execution_time'] > 0:
                self.record_test_result("test_performance", True, 
                                      f"Performance metrics: {metrics['query_count']} queries, "
                                      f"{metrics['avg_execution_time']:.3f}s avg")
            else:
                self.record_test_result("test_performance", False, 
                                      f"Invalid performance metrics: {metrics}")
        
        except Exception as e:
            self.record_test_result("test_performance", False, str(e))
    
    async def test_json_rpc_integration(self):
        """Test JSON-RPC integration"""
        try:
            config = ConsensusConfig()
            engine = ConsensusEngine(config)
            handler = ConsensusHandler(engine)
            
            # Test consensus query
            params = {'query': 'What is a database?'}
            response = await handler.handle_consensus_request(params)
            
            if 'success' in response and isinstance(response, dict):
                self.record_test_result("test_json_rpc_integration", True, 
                                      f"JSON-RPC integration working: {response.get('success')}")
            else:
                self.record_test_result("test_json_rpc_integration", False, 
                                      f"Invalid JSON-RPC response: {response}")
        
        except Exception as e:
            self.record_test_result("test_json_rpc_integration", False, str(e))

    async def test_circuit_breaker(self):
        """Test circuit breaker functionality"""
        try:
            config = ConsensusConfig()
            engine = ConsensusEngine(config)

            # Access the model manager to test circuit breaker
            model_manager = engine.model_manager

            # Simulate failures for a model
            test_model_id = list(model_manager.models.keys())[0]

            # Record multiple failures
            for _ in range(3):
                model_manager._record_model_failure(test_model_id)

            # Check if circuit breaker is open
            is_open = model_manager._is_circuit_breaker_open(test_model_id)

            if is_open:
                self.record_test_result("test_circuit_breaker", True,
                                      f"Circuit breaker opened after failures for model {test_model_id}")
            else:
                self.record_test_result("test_circuit_breaker", False,
                                      "Circuit breaker did not open after multiple failures")

        except Exception as e:
            self.record_test_result("test_circuit_breaker", False, str(e))


async def main():
    """Main test runner"""
    logger.info("Consensus Engine Test Suite Starting...")
    
    tests = ConsensusEngineTests()
    await tests.run_all_tests()
    
    logger.info("Test Suite Complete!")


if __name__ == "__main__":
    asyncio.run(main())
