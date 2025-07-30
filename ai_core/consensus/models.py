"""
Model Execution System
Handles parallel execution of multiple AI models with isolation and timeout management.
"""

import asyncio
import time
import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from contextlib import asynccontextmanager

from .types import ModelResponse, ModelStatus, QueryContext
from .config import ModelConfig

logger = logging.getLogger(__name__)


class ModelSandbox:
    """Provides isolation for model execution"""
    
    def __init__(self, memory_limit_mb: int = 500, cpu_limit_percent: int = 70):
        self.memory_limit_mb = memory_limit_mb
        self.cpu_limit_percent = cpu_limit_percent
    
    @asynccontextmanager
    async def isolate(self):
        """Context manager for model isolation"""
        # In a production environment, this would implement actual sandboxing
        # For now, we provide a basic isolation context
        try:
            logger.debug("Entering model sandbox")
            yield
        finally:
            logger.debug("Exiting model sandbox")


class TimeoutManager:
    """Manages execution timeouts for models"""
    
    def __init__(self):
        self.start_time = None
        self.elapsed_time = 0.0
    
    async def execute_with_timeout(self, coro, timeout: float):
        """Execute coroutine with timeout"""
        self.start_time = time.time()
        try:
            result = await asyncio.wait_for(coro, timeout=timeout)
            self.elapsed_time = time.time() - self.start_time
            return result
        except asyncio.TimeoutError:
            self.elapsed_time = time.time() - self.start_time
            raise
        except Exception as e:
            self.elapsed_time = time.time() - self.start_time
            raise


class BaseModel(ABC):
    """Abstract base class for AI models"""
    
    def __init__(self, config: ModelConfig):
        self.config = config
        self.model_id = config.model_id
        self.model_type = config.model_type
        self.weight = config.weight
        self.timeout = config.timeout
        self.max_retries = config.max_retries
        self.enabled = config.enabled
        
    @abstractmethod
    async def generate_response(self, query: str, context: Optional[QueryContext] = None) -> str:
        """Generate response for the given query"""
        pass
    
    @abstractmethod
    async def get_confidence(self, query: str, response: str) -> float:
        """Get confidence score for the response"""
        pass
    
    async def health_check(self) -> bool:
        """Check if the model is healthy and ready"""
        try:
            test_response = await self.generate_response("test", None)
            return len(test_response.strip()) > 0
        except Exception as e:
            logger.warning(f"Health check failed for model {self.model_id}: {e}")
            return False


class MockModel(BaseModel):
    """Mock model implementation for testing"""
    
    def __init__(self, config: ModelConfig):
        super().__init__(config)
        self.response_pattern = config.config.get('response_pattern', 'default')
        self.base_confidence = config.config.get('base_confidence', 0.8)
        self.response_delay = config.config.get('response_delay', 0.1)
        
    async def generate_response(self, query: str, context: Optional[QueryContext] = None) -> str:
        """Generate a mock response based on the pattern"""
        # Simulate processing time
        await asyncio.sleep(self.response_delay)
        
        query_lower = query.lower()
        
        if self.response_pattern == "analytical":
            if "sql" in query_lower or "database" in query_lower:
                return f"Based on analytical assessment: {query}. I recommend using proper indexing and query optimization techniques."
            elif "data" in query_lower:
                return f"From an analytical perspective: {query}. Consider data validation and statistical significance."
            else:
                return f"Analytical response to: {query}. This requires systematic evaluation of the available information."
        
        elif self.response_pattern == "creative":
            if "sql" in query_lower or "database" in query_lower:
                return f"Creative approach to: {query}. Consider using innovative query patterns and modern database features."
            elif "data" in query_lower:
                return f"Creative insight on: {query}. Explore unconventional data visualization and analysis methods."
            else:
                return f"Creative perspective on: {query}. Think outside the box and consider alternative approaches."
        
        elif self.response_pattern == "conservative":
            if "sql" in query_lower or "database" in query_lower:
                return f"Conservative recommendation for: {query}. Stick to well-tested SQL patterns and established best practices."
            elif "data" in query_lower:
                return f"Conservative analysis of: {query}. Use proven statistical methods and validated data sources."
            else:
                return f"Conservative response to: {query}. Follow established procedures and industry standards."
        
        else:
            return f"Standard response to: {query}. This is a general-purpose answer from {self.model_id}."
    
    async def get_confidence(self, query: str, response: str) -> float:
        """Calculate confidence based on response characteristics"""
        # Simple confidence calculation based on response length and content
        base_confidence = self.base_confidence
        
        # Adjust based on response length
        if len(response) < 50:
            base_confidence *= 0.8
        elif len(response) > 200:
            base_confidence *= 1.1
        
        # Adjust based on query complexity
        if len(query.split()) > 10:
            base_confidence *= 0.9
        
        # Add some randomness to simulate real model behavior
        import random
        confidence_variation = random.uniform(-0.1, 0.1)
        final_confidence = max(0.0, min(1.0, base_confidence + confidence_variation))
        
        return final_confidence


class ModelExecutor:
    """Executes queries on individual models with isolation and timeout"""
    
    def __init__(self, model: BaseModel):
        self.model = model
        self.sandbox = ModelSandbox()
        self.timeout_manager = TimeoutManager()
        
    async def execute_query(self, query: str, context: Optional[QueryContext] = None, 
                          timeout: Optional[float] = None) -> ModelResponse:
        """Execute query with isolation and timeout"""
        if not self.model.enabled:
            return ModelResponse.error(
                self.model.model_id,
                "Model is disabled",
                0.0
            )
        
        effective_timeout = timeout or self.model.timeout
        start_time = time.time()
        
        try:
            async with self.sandbox.isolate():
                # Generate response with timeout
                response_content = await self.timeout_manager.execute_with_timeout(
                    self.model.generate_response(query, context),
                    effective_timeout
                )
                
                # Get confidence score
                confidence = await self.model.get_confidence(query, response_content)
                
                return ModelResponse.success(
                    model_id=self.model.model_id,
                    content=response_content,
                    confidence=confidence,
                    execution_time=self.timeout_manager.elapsed_time
                )
                
        except asyncio.TimeoutError:
            execution_time = time.time() - start_time
            logger.warning(f"Model {self.model.model_id} timed out after {execution_time:.2f}s")
            return ModelResponse.timeout(self.model.model_id, execution_time)
            
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Model {self.model.model_id} failed: {e}")
            return ModelResponse.error(
                self.model.model_id,
                str(e),
                execution_time
            )


class ModelManager:
    """Manages multiple models and their execution with circuit breaker pattern"""

    def __init__(self, model_configs: List[ModelConfig]):
        self.models: Dict[str, BaseModel] = {}
        self.executors: Dict[str, ModelExecutor] = {}

        # IMPROVEMENT: Circuit breaker pattern for model failure handling
        self.model_failure_counts: Dict[str, int] = {}
        self.model_last_failure_time: Dict[str, float] = {}
        self.circuit_breaker_threshold = 3  # Failures before circuit opens
        self.circuit_breaker_timeout = 60.0  # Seconds before retry

        for config in model_configs:
            self._create_model(config)
    
    def _create_model(self, config: ModelConfig) -> BaseModel:
        """Create a model instance based on configuration"""
        if config.model_type == "mock":
            model = MockModel(config)
        else:
            # In the future, add support for other model types
            raise ValueError(f"Unsupported model type: {config.model_type}")
        
        self.models[config.model_id] = model
        self.executors[config.model_id] = ModelExecutor(model)

        # Initialize circuit breaker state
        self.model_failure_counts[config.model_id] = 0
        self.model_last_failure_time[config.model_id] = 0.0

        logger.info(f"Created model {config.model_id} of type {config.model_type}")
        return model
    
    def _is_circuit_breaker_open(self, model_id: str) -> bool:
        """Check if circuit breaker is open for a model"""
        failure_count = self.model_failure_counts.get(model_id, 0)
        last_failure_time = self.model_last_failure_time.get(model_id, 0.0)

        if failure_count >= self.circuit_breaker_threshold:
            # Circuit is open, check if timeout has passed
            if time.time() - last_failure_time < self.circuit_breaker_timeout:
                return True
            else:
                # Reset circuit breaker after timeout
                self.model_failure_counts[model_id] = 0
                logger.info(f"Circuit breaker reset for model {model_id}")
                return False

        return False

    def _record_model_failure(self, model_id: str):
        """Record a model failure for circuit breaker"""
        self.model_failure_counts[model_id] = self.model_failure_counts.get(model_id, 0) + 1
        self.model_last_failure_time[model_id] = time.time()

        if self.model_failure_counts[model_id] >= self.circuit_breaker_threshold:
            logger.warning(f"Circuit breaker opened for model {model_id} after {self.model_failure_counts[model_id]} failures")

    def _record_model_success(self, model_id: str):
        """Record a model success for circuit breaker"""
        if self.model_failure_counts.get(model_id, 0) > 0:
            self.model_failure_counts[model_id] = max(0, self.model_failure_counts[model_id] - 1)

    async def execute_parallel_queries(self, query: str, context: Optional[QueryContext] = None,
                                     timeout: Optional[float] = None) -> List[ModelResponse]:
        """Execute query on all enabled models in parallel with circuit breaker protection"""
        enabled_models = [model_id for model_id, model in self.models.items()
                         if model.enabled and not self._is_circuit_breaker_open(model_id)]

        if not enabled_models:
            logger.warning("No enabled models available for query execution (circuit breakers may be open)")
            return []

        logger.info(f"Executing query on {len(enabled_models)} models: {enabled_models}")

        # Create tasks for parallel execution
        tasks = []
        for model_id in enabled_models:
            executor = self.executors[model_id]
            task = asyncio.create_task(
                executor.execute_query(query, context, timeout),
                name=f"model_{model_id}"
            )
            tasks.append(task)
        
        # Wait for all tasks to complete
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results and handle exceptions with circuit breaker updates
        processed_responses = []
        for i, response in enumerate(responses):
            model_id = enabled_models[i]

            if isinstance(response, Exception):
                logger.error(f"Task for model {model_id} raised exception: {response}")
                self._record_model_failure(model_id)
                processed_responses.append(
                    ModelResponse.error(model_id, str(response), 0.0)
                )
            else:
                # Update circuit breaker based on response status
                if response.status.value == "success":
                    self._record_model_success(model_id)
                elif response.status.value in ["error", "timeout"]:
                    self._record_model_failure(model_id)

                processed_responses.append(response)

        logger.info(f"Completed parallel execution: {len(processed_responses)} responses")
        return processed_responses
    
    async def health_check_all(self) -> Dict[str, bool]:
        """Perform health check on all models"""
        results = {}
        
        for model_id, model in self.models.items():
            try:
                is_healthy = await model.health_check()
                results[model_id] = is_healthy
                logger.debug(f"Model {model_id} health check: {'PASS' if is_healthy else 'FAIL'}")
            except Exception as e:
                logger.error(f"Health check failed for model {model_id}: {e}")
                results[model_id] = False
        
        return results
    
    def get_model_info(self) -> Dict[str, Dict[str, Any]]:
        """Get information about all models"""
        info = {}
        for model_id, model in self.models.items():
            info[model_id] = {
                'model_type': model.model_type,
                'weight': model.weight,
                'timeout': model.timeout,
                'enabled': model.enabled,
                'max_retries': model.max_retries
            }
        return info
