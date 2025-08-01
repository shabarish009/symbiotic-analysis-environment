"""
Local LLM Manager
Central orchestration for local model management, download, and inference.
"""

import asyncio
import logging
import json
from pathlib import Path
from typing import Dict, Any, Optional, List, Callable

from .models import LocalModel, ModelConfig, ModelStatus, AVAILABLE_MODELS, get_recommended_model
from .downloader import ModelDownloader, DownloadProgress
from .inference import LocalInferenceEngine, InferenceRequest, InferenceResponse
from .hardware import HardwareDetector
from .security import run_security_vulnerability_scan

logger = logging.getLogger(__name__)


class LocalLLMManager:
    """Central manager for local LLM operations"""
    
    def __init__(self, models_dir: Optional[Path] = None):
        # Directory setup
        if models_dir is None:
            models_dir = Path.home() / ".shelby" / "models"
        
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        # Component initialization
        self.downloader = ModelDownloader(self.models_dir)
        self.inference_engine = LocalInferenceEngine(self.models_dir)
        self.hardware_detector = HardwareDetector()
        
        # State management
        self.available_models = AVAILABLE_MODELS.copy()
        self.model_states: Dict[str, LocalModel] = {}
        self.active_model: Optional[str] = None
        
        # Configuration
        self.config_file = self.models_dir / "config.json"
        self.load_configuration()
        
        # Security check status
        self.security_scan_completed = False
        self.security_scan_results: Optional[Dict[str, Any]] = None

        # Circuit breaker for reliability
        self.failure_count = 0
        self.max_failures = 5
        self.circuit_open = False
        self.circuit_open_time = 0
        self.circuit_timeout = 300  # 5 minutes
        self.last_operation_time = 0

        logger.info(f"🚀 LocalLLMManager initialized with models directory: {self.models_dir}")
    
    async def initialize(self) -> bool:
        """Initialize the LLM manager"""
        try:
            logger.info("🔧 Initializing Local LLM Manager...")
            
            # Run mandatory security scan (Zeus Directive)
            await self.run_security_scan()
            
            # Detect hardware capabilities
            hardware = self.hardware_detector.get_hardware_capabilities()
            logger.info(f"Hardware detected: {hardware.cpu_count} CPU cores, {hardware.available_memory_mb}MB RAM")
            
            # Initialize model states
            await self.refresh_model_states()
            
            # Auto-select and load recommended model if none is active
            if not self.active_model:
                await self.auto_setup_recommended_model()
            
            logger.info("✅ Local LLM Manager initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Local LLM Manager: {e}")
            return False
    
    async def run_security_scan(self) -> Dict[str, Any]:
        """Run mandatory security vulnerability scan"""
        logger.info("🔒 Running mandatory security vulnerability scan...")
        
        try:
            self.security_scan_results = run_security_vulnerability_scan()
            self.security_scan_completed = True
            
            if self.security_scan_results['vulnerabilities_found'] > 0:
                logger.error("❌ CRITICAL: Security vulnerabilities detected!")
                for issue in self.security_scan_results['critical_issues']:
                    logger.error(f"  - {issue}")
                
                # In production, this should prevent system startup
                logger.error("⚠️  System should not proceed with vulnerabilities present")
            else:
                logger.info("✅ Security scan passed - no vulnerabilities detected")
            
            return self.security_scan_results
            
        except Exception as e:
            logger.error(f"💥 Security scan failed: {e}")
            self.security_scan_results = {
                'scan_completed': False,
                'error': str(e),
                'vulnerabilities_found': -1  # Unknown state
            }
            return self.security_scan_results
    
    async def refresh_model_states(self):
        """Refresh the state of all available models"""
        for model_name, config in self.available_models.items():
            if self.downloader.is_model_downloaded(config):
                if model_name not in self.model_states:
                    self.model_states[model_name] = LocalModel(
                        config=config,
                        status=ModelStatus.DOWNLOADED,
                        local_path=self.downloader.get_model_path(config)
                    )
                else:
                    self.model_states[model_name].status = ModelStatus.DOWNLOADED
                    self.model_states[model_name].local_path = self.downloader.get_model_path(config)
            else:
                if model_name not in self.model_states:
                    self.model_states[model_name] = LocalModel(
                        config=config,
                        status=ModelStatus.NOT_DOWNLOADED
                    )
                else:
                    self.model_states[model_name].status = ModelStatus.NOT_DOWNLOADED
    
    async def auto_setup_recommended_model(self) -> bool:
        """Automatically set up the recommended model for current hardware"""
        try:
            hardware = self.hardware_detector.get_hardware_capabilities()
            recommended_model = get_recommended_model(hardware.available_memory_mb, hardware.has_gpu)
            
            logger.info(f"🎯 Recommended model for your system: {recommended_model}")
            
            # Check if recommended model is already downloaded
            if recommended_model in self.model_states:
                model_state = self.model_states[recommended_model]
                
                if model_state.status == ModelStatus.DOWNLOADED:
                    # Load the model
                    success = await self.load_model(recommended_model)
                    if success:
                        self.active_model = recommended_model
                        logger.info(f"✅ Auto-loaded recommended model: {recommended_model}")
                        return True
                elif model_state.status == ModelStatus.NOT_DOWNLOADED:
                    # Download and load the model
                    logger.info(f"📥 Auto-downloading recommended model: {recommended_model}")
                    success = await self.download_model(recommended_model)
                    if success:
                        success = await self.load_model(recommended_model)
                        if success:
                            self.active_model = recommended_model
                            logger.info(f"✅ Auto-setup completed for: {recommended_model}")
                            return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error in auto-setup: {e}")
            return False
    
    async def download_model(self, model_name: str,
                           progress_callback: Optional[Callable[[DownloadProgress], None]] = None) -> bool:
        """Download a model with circuit breaker protection"""
        if model_name not in self.available_models:
            logger.error(f"Unknown model: {model_name}")
            return False

        config = self.available_models[model_name]

        # Check if already downloaded
        if self.downloader.is_model_downloaded(config):
            logger.info(f"Model {model_name} already downloaded")
            await self.refresh_model_states()
            return True

        # Execute with circuit breaker protection
        async def download_operation():
            # Update model state
            if model_name in self.model_states:
                self.model_states[model_name].status = ModelStatus.DOWNLOADING

            # Download the model
            success = await self.downloader.download_model(config, progress_callback)

            # Update model state
            await self.refresh_model_states()

            return success

        try:
            return await self._execute_with_circuit_breaker(f"download_{model_name}", download_operation)
        except RuntimeError as e:
            logger.error(f"Download blocked by circuit breaker: {e}")
            return False
    
    async def load_model(self, model_name: str) -> bool:
        """Load a model into memory"""
        if model_name not in self.available_models:
            logger.error(f"Unknown model: {model_name}")
            return False
        
        config = self.available_models[model_name]
        
        # Check if model is downloaded
        if not self.downloader.is_model_downloaded(config):
            logger.error(f"Model {model_name} not downloaded")
            return False
        
        # Update model state
        if model_name in self.model_states:
            self.model_states[model_name].status = ModelStatus.LOADING
        
        # Load the model
        success = await self.inference_engine.load_model(config)
        
        # Update model state
        if success:
            if model_name in self.model_states:
                self.model_states[model_name].status = ModelStatus.LOADED
            
            # Set as active model if none is set
            if not self.active_model:
                self.active_model = model_name
        else:
            if model_name in self.model_states:
                self.model_states[model_name].status = ModelStatus.ERROR
        
        return success
    
    async def unload_model(self, model_name: str) -> bool:
        """Unload a model from memory"""
        success = await self.inference_engine.unload_model(model_name)
        
        if success:
            # Update model state
            if model_name in self.model_states:
                self.model_states[model_name].status = ModelStatus.DOWNLOADED
            
            # Clear active model if it was unloaded
            if self.active_model == model_name:
                self.active_model = None
        
        return success
    
    async def generate_text(self, prompt: str, model_name: Optional[str] = None, **kwargs) -> InferenceResponse:
        """Generate text using a loaded model"""
        # Use active model if none specified
        if model_name is None:
            model_name = self.active_model
        
        if not model_name:
            return InferenceResponse(
                text="",
                request_id="",
                model_name="",
                inference_time=0.0,
                tokens_generated=0,
                tokens_per_second=0.0,
                error="No model loaded"
            )
        
        # Create inference request
        request = InferenceRequest(
            prompt=prompt,
            max_tokens=kwargs.get('max_tokens', 512),
            temperature=kwargs.get('temperature', 0.7),
            top_p=kwargs.get('top_p', 0.9),
            stop_sequences=kwargs.get('stop_sequences', [])
        )
        
        # Generate response
        return await self.inference_engine.generate(request, model_name)
    
    def get_available_models(self) -> List[Dict[str, Any]]:
        """Get list of available models with their status"""
        models = []
        
        for model_name, config in self.available_models.items():
            model_info = {
                'name': model_name,
                'display_name': config.display_name,
                'description': config.description,
                'model_type': config.model_type.value,
                'file_size_mb': config.file_size_mb,
                'memory_requirement_mb': config.memory_requirement_mb,
                'parameter_count': config.parameter_count,
                'quality_score': config.quality_score,
                'recommended_for': config.recommended_for,
                'status': ModelStatus.NOT_DOWNLOADED.value
            }
            
            # Update with actual status if available
            if model_name in self.model_states:
                model_info.update(self.model_states[model_name].to_dict())
            
            models.append(model_info)
        
        return models
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get comprehensive system status"""
        hardware = self.hardware_detector.get_hardware_capabilities()
        memory_usage = self.inference_engine.get_memory_usage()
        loaded_models = self.inference_engine.get_loaded_models()
        
        return {
            'active_model': self.active_model,
            'loaded_models': loaded_models,
            'total_models_available': len(self.available_models),
            'models_downloaded': len([m for m in self.model_states.values() 
                                   if m.status in [ModelStatus.DOWNLOADED, ModelStatus.LOADED]]),
            'hardware_capabilities': hardware.to_dict(),
            'memory_usage': memory_usage,
            'security_scan_completed': self.security_scan_completed,
            'security_vulnerabilities': self.security_scan_results.get('vulnerabilities_found', -1) if self.security_scan_results else -1,
            'models_directory': str(self.models_dir),
            'models_directory_size_mb': self.downloader.get_models_directory_size()
        }
    
    def get_model_recommendations(self) -> Dict[str, Any]:
        """Get model recommendations based on current hardware"""
        hardware = self.hardware_detector.get_hardware_capabilities()
        recommended_model = get_recommended_model(hardware.available_memory_mb, hardware.has_gpu)
        
        return {
            'recommended_model': recommended_model,
            'hardware_summary': {
                'available_memory_mb': hardware.available_memory_mb,
                'has_gpu': hardware.has_gpu,
                'cuda_available': hardware.cuda_available,
                'estimated_inference_speed': hardware.estimated_inference_speed
            },
            'model_options': [
                {
                    'name': name,
                    'display_name': config.display_name,
                    'suitable': config.memory_requirement_mb <= hardware.available_memory_mb,
                    'performance_estimate': hardware.estimated_inference_speed * config.inference_speed_tokens_per_sec
                }
                for name, config in self.available_models.items()
            ]
        }
    
    def load_configuration(self):
        """Load configuration from file"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    self.active_model = config.get('active_model')
                    logger.info(f"Loaded configuration: active_model={self.active_model}")
        except Exception as e:
            logger.warning(f"Could not load configuration: {e}")
    
    def save_configuration(self):
        """Save configuration to file"""
        try:
            config = {
                'active_model': self.active_model,
                'last_updated': time.time()
            }
            
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
                
        except Exception as e:
            logger.error(f"Could not save configuration: {e}")
    
    async def cleanup(self):
        """Cleanup resources"""
        try:
            # Unload all models
            for model_name in list(self.inference_engine.loaded_models.keys()):
                await self.unload_model(model_name)
            
            # Save configuration
            self.save_configuration()
            
            logger.info("✅ Local LLM Manager cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
    
    def __del__(self):
        """Destructor"""
        try:
            # Save configuration on destruction
            self.save_configuration()
        except Exception:
            pass  # Ignore errors during destruction

    def _check_circuit_breaker(self) -> bool:
        """Check if circuit breaker allows operation"""
        current_time = time.time()

        # If circuit is open, check if timeout has passed
        if self.circuit_open:
            if current_time - self.circuit_open_time > self.circuit_timeout:
                # Reset circuit breaker
                self.circuit_open = False
                self.failure_count = 0
                logger.info("🔄 Circuit breaker reset - attempting to resume operations")
                return True
            else:
                remaining = self.circuit_timeout - (current_time - self.circuit_open_time)
                logger.warning(f"⚡ Circuit breaker open - {remaining:.0f}s remaining")
                return False

        return True

    def _record_success(self):
        """Record successful operation"""
        if self.failure_count > 0:
            self.failure_count = max(0, self.failure_count - 1)
        self.last_operation_time = time.time()

    def _record_failure(self):
        """Record failed operation and potentially open circuit breaker"""
        self.failure_count += 1
        self.last_operation_time = time.time()

        if self.failure_count >= self.max_failures:
            self.circuit_open = True
            self.circuit_open_time = time.time()
            logger.error(f"⚡ Circuit breaker opened after {self.failure_count} failures")

    async def _execute_with_circuit_breaker(self, operation_name: str, operation_func):
        """Execute operation with circuit breaker protection"""
        if not self._check_circuit_breaker():
            raise RuntimeError(f"Circuit breaker open - {operation_name} not available")

        try:
            result = await operation_func()
            self._record_success()
            return result
        except Exception as e:
            self._record_failure()
            logger.error(f"Operation {operation_name} failed: {e}")
            raise
