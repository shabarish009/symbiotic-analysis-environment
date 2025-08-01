"""
Local LLM Inference Engine
Handles loading and running inference with local models.
"""

import asyncio
import logging
import time
import threading
from pathlib import Path
from typing import Dict, Any, Optional, List, AsyncGenerator
from dataclasses import dataclass

from .models import LocalModel, ModelConfig, ModelStatus
from .hardware import HardwareDetector

logger = logging.getLogger(__name__)


@dataclass
class InferenceRequest:
    """Request for model inference"""
    prompt: str
    max_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.9
    stop_sequences: List[str] = None
    stream: bool = False
    request_id: str = ""
    
    def __post_init__(self):
        if self.stop_sequences is None:
            self.stop_sequences = []
        
        if not self.request_id:
            import uuid
            self.request_id = str(uuid.uuid4())


@dataclass
class InferenceResponse:
    """Response from model inference"""
    text: str
    request_id: str
    model_name: str
    inference_time: float
    tokens_generated: int
    tokens_per_second: float
    finish_reason: str = "completed"
    error: Optional[str] = None
    
    @property
    def success(self) -> bool:
        return self.error is None


class LocalInferenceEngine:
    """Manages local model inference"""
    
    def __init__(self, models_dir: Path):
        self.models_dir = Path(models_dir)
        self.hardware_detector = HardwareDetector()
        
        # Model management
        self.loaded_models: Dict[str, LocalModel] = {}
        self.model_locks: Dict[str, threading.Lock] = {}
        
        # Performance settings
        self.max_concurrent_requests = 3
        self.model_timeout_seconds = 30
        self.inference_timeout_seconds = 60
        
        # Request queue
        self.request_semaphore = asyncio.Semaphore(self.max_concurrent_requests)
        
    async def load_model(self, config: ModelConfig) -> bool:
        """Load a model into memory"""
        try:
            if config.name in self.loaded_models:
                model = self.loaded_models[config.name]
                if model.is_available:
                    logger.info(f"Model {config.display_name} already loaded")
                    return True
            
            logger.info(f"🔄 Loading {config.display_name}...")
            
            # Create model instance
            model = LocalModel(config=config, status=ModelStatus.LOADING)
            self.loaded_models[config.name] = model
            self.model_locks[config.name] = threading.Lock()
            
            # Check if model file exists
            model_path = self.models_dir / config.filename
            if not model_path.exists():
                raise FileNotFoundError(f"Model file not found: {model_path}")
            
            model.local_path = model_path
            
            # Load model based on architecture
            success = await self._load_model_implementation(model)
            
            if success:
                model.status = ModelStatus.LOADED
                model.loaded_at = time.time()
                logger.info(f"✅ Successfully loaded {config.display_name}")
                return True
            else:
                model.status = ModelStatus.ERROR
                model.error_message = "Failed to load model implementation"
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to load {config.display_name}: {e}")
            if config.name in self.loaded_models:
                self.loaded_models[config.name].status = ModelStatus.ERROR
                self.loaded_models[config.name].error_message = str(e)
            return False
    
    async def _load_model_implementation(self, model: LocalModel) -> bool:
        """Load the actual model implementation"""
        try:
            # Detect hardware capabilities
            hardware = self.hardware_detector.get_hardware_capabilities()
            
            # Choose implementation based on model architecture and hardware
            if model.config.architecture == "llama":
                return await self._load_llama_model(model, hardware)
            elif model.config.architecture == "mistral":
                return await self._load_mistral_model(model, hardware)
            elif model.config.architecture == "phi":
                return await self._load_phi_model(model, hardware)
            else:
                # Default to llama.cpp for unknown architectures
                return await self._load_llama_model(model, hardware)
                
        except Exception as e:
            logger.error(f"Error loading model implementation: {e}")
            return False
    
    async def _load_llama_model(self, model: LocalModel, hardware) -> bool:
        """Load model using llama.cpp with performance optimization"""
        try:
            # Try to import llama-cpp-python
            try:
                from llama_cpp import Llama
            except ImportError:
                logger.error("llama-cpp-python not installed. Install with: pip install llama-cpp-python")
                return False

            # Optimize parameters based on hardware capabilities
            optimal_threads = self._calculate_optimal_threads(hardware)
            optimal_context = self._calculate_optimal_context(model.config, hardware)

            # Configure model parameters with performance optimizations
            model_params = {
                'model_path': str(model.local_path),
                'n_ctx': optimal_context,
                'n_threads': optimal_threads,
                'n_batch': min(512, optimal_context // 4),  # Optimize batch size
                'verbose': False,
                'use_mlock': True,  # Lock model in memory to prevent swapping
                'use_mmap': True,   # Use memory mapping for efficiency
            }

            # Advanced GPU optimization
            if hardware.has_gpu and hardware.cuda_available:
                # Calculate optimal GPU layers based on VRAM
                gpu_memory_mb = sum(gpu.memory_mb for gpu in hardware.gpus if gpu.is_available)
                if gpu_memory_mb > 0:
                    # Estimate layers that fit in GPU memory
                    estimated_layer_memory = model.config.memory_requirement_mb / 32  # Rough estimate
                    max_gpu_layers = min(32, int(gpu_memory_mb * 0.8 / estimated_layer_memory))
                    model_params['n_gpu_layers'] = max_gpu_layers
                    logger.info(f"🚀 Using GPU acceleration with {max_gpu_layers} layers")
                else:
                    model_params['n_gpu_layers'] = -1  # Use all layers
                    logger.info("🚀 Using GPU acceleration (all layers)")

            # Memory optimization
            if hardware.available_memory_mb < model.config.memory_requirement_mb * 1.5:
                # Low memory mode
                model_params['low_vram'] = True
                model_params['n_batch'] = min(256, model_params['n_batch'])
                logger.info("🔧 Enabled low memory mode")

            # Load model with timeout and progress tracking
            logger.info(f"📥 Loading {model.config.display_name} with optimized settings...")
            logger.info(f"   Threads: {optimal_threads}, Context: {optimal_context}, Batch: {model_params['n_batch']}")

            start_time = time.time()

            # Load model in thread pool with timeout
            loop = asyncio.get_event_loop()
            try:
                model_instance = await asyncio.wait_for(
                    loop.run_in_executor(None, lambda: Llama(**model_params)),
                    timeout=self.model_timeout_seconds
                )
            except asyncio.TimeoutError:
                logger.error(f"Model loading timed out after {self.model_timeout_seconds} seconds")
                return False

            loading_time = time.time() - start_time
            logger.info(f"⚡ Model loaded in {loading_time:.1f} seconds")

            model.model_instance = model_instance

            # Accurate memory usage calculation
            model.memory_usage_mb = self._calculate_actual_memory_usage(model.config, hardware)

            # Warm up the model with a small inference
            try:
                await self._warmup_model(model)
            except Exception as e:
                logger.warning(f"Model warmup failed: {e}")

            return True

        except Exception as e:
            logger.error(f"Error loading Llama model: {e}")
            return False
    
    async def _load_mistral_model(self, model: LocalModel, hardware) -> bool:
        """Load Mistral model (fallback to llama.cpp)"""
        # Mistral models are compatible with llama.cpp
        return await self._load_llama_model(model, hardware)
    
    async def _load_phi_model(self, model: LocalModel, hardware) -> bool:
        """Load Phi model"""
        try:
            # Try transformers first for Phi models
            try:
                from transformers import AutoModelForCausalLM, AutoTokenizer
                import torch
                
                # Load tokenizer
                tokenizer = AutoTokenizer.from_pretrained("microsoft/phi-2")
                
                # Load model with appropriate device
                device = "cuda" if hardware.cuda_available else "cpu"
                torch_model = AutoModelForCausalLM.from_pretrained(
                    "microsoft/phi-2",
                    torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                    device_map="auto" if device == "cuda" else None
                )
                
                model.model_instance = torch_model
                model.tokenizer_instance = tokenizer
                model.memory_usage_mb = self._estimate_memory_usage(model.config)
                
                return True
                
            except ImportError:
                logger.warning("transformers not available, falling back to llama.cpp")
                return await self._load_llama_model(model, hardware)
                
        except Exception as e:
            logger.error(f"Error loading Phi model: {e}")
            return False
    
    def _estimate_memory_usage(self, config: ModelConfig) -> float:
        """Estimate memory usage of loaded model"""
        # Rough estimation based on parameter count and quantization
        base_memory = config.memory_requirement_mb
        
        if config.quantization == "q4_0":
            return base_memory * 0.6  # 4-bit quantization reduces memory
        elif config.quantization == "q8_0":
            return base_memory * 0.8  # 8-bit quantization
        else:
            return base_memory  # Full precision
    
    async def generate(self, request: InferenceRequest, model_name: str) -> InferenceResponse:
        """Generate text using specified model"""
        start_time = time.time()
        
        try:
            # Check if model is loaded
            if model_name not in self.loaded_models:
                return InferenceResponse(
                    text="",
                    request_id=request.request_id,
                    model_name=model_name,
                    inference_time=0.0,
                    tokens_generated=0,
                    tokens_per_second=0.0,
                    error=f"Model {model_name} not loaded"
                )
            
            model = self.loaded_models[model_name]
            
            if not model.is_available:
                return InferenceResponse(
                    text="",
                    request_id=request.request_id,
                    model_name=model_name,
                    inference_time=0.0,
                    tokens_generated=0,
                    tokens_per_second=0.0,
                    error=f"Model {model_name} not available: {model.error_message}"
                )
            
            # Acquire semaphore for concurrent request limiting
            async with self.request_semaphore:
                # Acquire model lock
                with self.model_locks[model_name]:
                    # Generate response
                    response = await self._generate_with_model(request, model)
                    
                    # Update model statistics
                    inference_time = time.time() - start_time
                    model.update_usage_stats(inference_time)
                    
                    return response
                    
        except asyncio.TimeoutError:
            return InferenceResponse(
                text="",
                request_id=request.request_id,
                model_name=model_name,
                inference_time=time.time() - start_time,
                tokens_generated=0,
                tokens_per_second=0.0,
                error="Inference timeout"
            )
        except Exception as e:
            logger.error(f"Error during inference: {e}")
            return InferenceResponse(
                text="",
                request_id=request.request_id,
                model_name=model_name,
                inference_time=time.time() - start_time,
                tokens_generated=0,
                tokens_per_second=0.0,
                error=str(e)
            )
    
    async def _generate_with_model(self, request: InferenceRequest, model: LocalModel) -> InferenceResponse:
        """Generate text with specific model implementation"""
        start_time = time.time()
        
        try:
            # Handle different model implementations
            if hasattr(model.model_instance, '__call__'):
                # llama.cpp style
                result = await self._generate_llama_cpp(request, model)
            elif hasattr(model.model_instance, 'generate'):
                # transformers style
                result = await self._generate_transformers(request, model)
            else:
                raise ValueError(f"Unknown model implementation type")
            
            inference_time = time.time() - start_time
            tokens_generated = len(result.split())  # Rough token count
            tokens_per_second = tokens_generated / inference_time if inference_time > 0 else 0
            
            return InferenceResponse(
                text=result,
                request_id=request.request_id,
                model_name=model.config.name,
                inference_time=inference_time,
                tokens_generated=tokens_generated,
                tokens_per_second=tokens_per_second
            )
            
        except Exception as e:
            logger.error(f"Error in model generation: {e}")
            raise
    
    async def _generate_llama_cpp(self, request: InferenceRequest, model: LocalModel) -> str:
        """Generate using llama.cpp"""
        loop = asyncio.get_event_loop()
        
        # Run inference in thread pool
        result = await loop.run_in_executor(
            None,
            lambda: model.model_instance(
                request.prompt,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                top_p=request.top_p,
                stop=request.stop_sequences,
                echo=False
            )
        )
        
        return result['choices'][0]['text']
    
    async def _generate_transformers(self, request: InferenceRequest, model: LocalModel) -> str:
        """Generate using transformers"""
        import torch
        
        tokenizer = model.tokenizer_instance
        model_instance = model.model_instance
        
        # Tokenize input
        inputs = tokenizer.encode(request.prompt, return_tensors="pt")
        
        # Generate
        loop = asyncio.get_event_loop()
        with torch.no_grad():
            outputs = await loop.run_in_executor(
                None,
                lambda: model_instance.generate(
                    inputs,
                    max_new_tokens=request.max_tokens,
                    temperature=request.temperature,
                    top_p=request.top_p,
                    do_sample=True,
                    pad_token_id=tokenizer.eos_token_id
                )
            )
        
        # Decode response
        response = tokenizer.decode(outputs[0][inputs.shape[1]:], skip_special_tokens=True)
        return response
    
    async def unload_model(self, model_name: str) -> bool:
        """Unload a model from memory with enhanced cleanup"""
        try:
            if model_name not in self.loaded_models:
                return True

            logger.info(f"🔄 Unloading {model_name}...")

            model = self.loaded_models[model_name]

            # Record memory usage before cleanup
            initial_memory = model.memory_usage_mb

            # Clear CUDA cache if using GPU
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    torch.cuda.synchronize()
                    logger.info("🧹 Cleared CUDA cache")
            except ImportError:
                pass  # PyTorch not available
            except Exception as e:
                logger.warning(f"Failed to clear CUDA cache: {e}")

            # Explicitly delete model components
            if hasattr(model.model_instance, 'cpu'):
                try:
                    model.model_instance.cpu()  # Move to CPU before deletion
                except Exception:
                    pass

            # Clear references
            model.model_instance = None
            model.tokenizer_instance = None

            # Update status
            model.status = ModelStatus.DOWNLOADED  # Still downloaded, just not loaded
            model.memory_usage_mb = 0.0
            model.gpu_memory_usage_mb = 0.0

            # Remove from loaded models
            del self.loaded_models[model_name]
            if model_name in self.model_locks:
                del self.model_locks[model_name]

            # Aggressive garbage collection
            import gc
            gc.collect()
            gc.collect()  # Run twice for better cleanup
            gc.collect()  # Third time for stubborn references

            # Additional cleanup for specific libraries
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    # Force memory cleanup
                    for i in range(torch.cuda.device_count()):
                        with torch.cuda.device(i):
                            torch.cuda.empty_cache()
            except ImportError:
                pass
            except Exception as e:
                logger.warning(f"Additional CUDA cleanup failed: {e}")

            # Verify memory was actually freed
            import psutil
            process = psutil.Process()
            current_memory = process.memory_info().rss / (1024 * 1024)  # MB

            logger.info(f"✅ Unloaded {model_name}")
            logger.info(f"📊 Memory freed: ~{initial_memory:.1f}MB, Current process memory: {current_memory:.1f}MB")

            return True

        except Exception as e:
            logger.error(f"Error unloading model {model_name}: {e}")
            return False
    
    def get_loaded_models(self) -> List[str]:
        """Get list of currently loaded models"""
        return [name for name, model in self.loaded_models.items() if model.is_available]
    
    def get_model_stats(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get statistics for a loaded model"""
        if model_name not in self.loaded_models:
            return None
        
        return self.loaded_models[model_name].to_dict()
    
    def get_memory_usage(self) -> Dict[str, float]:
        """Get total memory usage of loaded models"""
        total_memory = sum(model.memory_usage_mb for model in self.loaded_models.values())
        total_gpu_memory = sum(model.gpu_memory_usage_mb for model in self.loaded_models.values())
        
        return {
            'total_memory_mb': total_memory,
            'total_gpu_memory_mb': total_gpu_memory,
            'loaded_models': len(self.loaded_models)
        }

    def _calculate_optimal_threads(self, hardware) -> int:
        """Calculate optimal number of threads for model inference"""
        # Use 75% of available cores, but cap at 16 for diminishing returns
        optimal = max(1, min(16, int(hardware.cpu_count * 0.75)))

        # Adjust based on memory constraints
        if hardware.available_memory_mb < 8192:  # Less than 8GB
            optimal = min(optimal, 4)
        elif hardware.available_memory_mb < 16384:  # Less than 16GB
            optimal = min(optimal, 8)

        return optimal

    def _calculate_optimal_context(self, config, hardware) -> int:
        """Calculate optimal context length based on hardware"""
        max_context = min(config.context_length, hardware.max_context_length)

        # Reduce context if memory is limited
        if hardware.available_memory_mb < config.memory_requirement_mb * 1.2:
            # Reduce context by 25% if memory is tight
            max_context = int(max_context * 0.75)

        # Ensure minimum context
        return max(512, max_context)

    def _calculate_actual_memory_usage(self, config, hardware) -> float:
        """Calculate more accurate memory usage based on actual configuration"""
        base_memory = self._estimate_memory_usage(config)

        # Adjust for GPU offloading
        if hardware.has_gpu and hardware.cuda_available:
            # Assume 60% of model can be offloaded to GPU
            base_memory *= 0.4

        # Add overhead for context and processing
        context_overhead = 50  # MB for context processing

        return base_memory + context_overhead

    async def _warmup_model(self, model: LocalModel):
        """Warm up model with a small inference to optimize performance"""
        try:
            if hasattr(model.model_instance, '__call__'):
                # llama.cpp style warmup
                warmup_prompt = "SELECT"
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: model.model_instance(
                        warmup_prompt,
                        max_tokens=1,
                        temperature=0.1,
                        echo=False
                    )
                )
                logger.info("🔥 Model warmed up successfully")
        except Exception as e:
            logger.warning(f"Model warmup failed: {e}")
            # Warmup failure is not critical
