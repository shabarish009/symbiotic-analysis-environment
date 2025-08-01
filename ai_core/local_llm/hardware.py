"""
Hardware Detection and Optimization
Detects system capabilities and optimizes model selection and performance.
"""

import logging
import platform
import psutil
import subprocess
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class GPUInfo:
    """Information about a GPU device"""
    name: str
    memory_mb: int
    compute_capability: Optional[str] = None
    driver_version: Optional[str] = None
    is_available: bool = False


@dataclass
class HardwareCapabilities:
    """System hardware capabilities"""
    # CPU Information
    cpu_count: int
    cpu_model: str
    cpu_architecture: str
    
    # Memory Information
    total_memory_mb: int
    available_memory_mb: int
    memory_usage_percent: float
    
    # GPU Information
    has_gpu: bool
    gpus: List[GPUInfo]
    cuda_available: bool = False
    rocm_available: bool = False
    
    # Storage Information
    available_storage_gb: float
    
    # Performance Characteristics
    estimated_inference_speed: float = 1.0  # Relative to baseline
    recommended_model_size: str = "7B"
    max_context_length: int = 4096
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'cpu_count': self.cpu_count,
            'cpu_model': self.cpu_model,
            'cpu_architecture': self.cpu_architecture,
            'total_memory_mb': self.total_memory_mb,
            'available_memory_mb': self.available_memory_mb,
            'memory_usage_percent': self.memory_usage_percent,
            'has_gpu': self.has_gpu,
            'gpus': [
                {
                    'name': gpu.name,
                    'memory_mb': gpu.memory_mb,
                    'compute_capability': gpu.compute_capability,
                    'driver_version': gpu.driver_version,
                    'is_available': gpu.is_available
                }
                for gpu in self.gpus
            ],
            'cuda_available': self.cuda_available,
            'rocm_available': self.rocm_available,
            'available_storage_gb': self.available_storage_gb,
            'estimated_inference_speed': self.estimated_inference_speed,
            'recommended_model_size': self.recommended_model_size,
            'max_context_length': self.max_context_length
        }


class HardwareDetector:
    """Detects and analyzes system hardware capabilities"""
    
    def __init__(self):
        self._cached_capabilities: Optional[HardwareCapabilities] = None
        self._cache_timestamp = 0
        self.cache_duration = 300  # 5 minutes
    
    def get_hardware_capabilities(self, force_refresh: bool = False) -> HardwareCapabilities:
        """Get comprehensive hardware capabilities"""
        import time
        
        current_time = time.time()
        
        # Use cached result if available and not expired
        if (not force_refresh and 
            self._cached_capabilities and 
            (current_time - self._cache_timestamp) < self.cache_duration):
            return self._cached_capabilities
        
        logger.info("🔍 Detecting hardware capabilities...")
        
        try:
            capabilities = HardwareCapabilities(
                # CPU Information
                cpu_count=psutil.cpu_count(logical=True),
                cpu_model=self._get_cpu_model(),
                cpu_architecture=platform.machine(),
                
                # Memory Information
                total_memory_mb=int(psutil.virtual_memory().total / (1024 * 1024)),
                available_memory_mb=int(psutil.virtual_memory().available / (1024 * 1024)),
                memory_usage_percent=psutil.virtual_memory().percent,
                
                # GPU Information
                has_gpu=False,
                gpus=[],
                
                # Storage Information
                available_storage_gb=self._get_available_storage_gb()
            )
            
            # Detect GPU capabilities
            capabilities.gpus = self._detect_gpus()
            capabilities.has_gpu = len(capabilities.gpus) > 0
            capabilities.cuda_available = self._check_cuda_availability()
            capabilities.rocm_available = self._check_rocm_availability()
            
            # Calculate performance characteristics
            self._calculate_performance_characteristics(capabilities)
            
            # Cache the result
            self._cached_capabilities = capabilities
            self._cache_timestamp = current_time
            
            logger.info(f"✅ Hardware detection complete:")
            logger.info(f"  CPU: {capabilities.cpu_count} cores, {capabilities.cpu_model}")
            logger.info(f"  Memory: {capabilities.available_memory_mb}MB available / {capabilities.total_memory_mb}MB total")
            logger.info(f"  GPU: {len(capabilities.gpus)} devices, CUDA: {capabilities.cuda_available}")
            logger.info(f"  Recommended: {capabilities.recommended_model_size} model")
            
            return capabilities
            
        except Exception as e:
            logger.error(f"Error detecting hardware capabilities: {e}")
            # Return minimal capabilities as fallback
            return HardwareCapabilities(
                cpu_count=4,
                cpu_model="Unknown",
                cpu_architecture=platform.machine(),
                total_memory_mb=8192,
                available_memory_mb=4096,
                memory_usage_percent=50.0,
                has_gpu=False,
                gpus=[],
                available_storage_gb=10.0
            )
    
    def _get_cpu_model(self) -> str:
        """Get CPU model information"""
        try:
            if platform.system() == "Windows":
                import winreg
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, 
                                   r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
                cpu_name = winreg.QueryValueEx(key, "ProcessorNameString")[0]
                winreg.CloseKey(key)
                return cpu_name.strip()
            
            elif platform.system() == "Linux":
                with open("/proc/cpuinfo", "r") as f:
                    for line in f:
                        if "model name" in line:
                            return line.split(":")[1].strip()
            
            elif platform.system() == "Darwin":  # macOS
                result = subprocess.run(
                    ["sysctl", "-n", "machdep.cpu.brand_string"],
                    capture_output=True, text=True
                )
                if result.returncode == 0:
                    return result.stdout.strip()
            
            return f"{platform.processor()} ({platform.machine()})"
            
        except Exception as e:
            logger.warning(f"Could not detect CPU model: {e}")
            return "Unknown CPU"
    
    def _detect_gpus(self) -> List[GPUInfo]:
        """Detect available GPU devices"""
        gpus = []
        
        try:
            # Try NVIDIA GPUs first
            nvidia_gpus = self._detect_nvidia_gpus()
            gpus.extend(nvidia_gpus)
            
            # Try AMD GPUs
            amd_gpus = self._detect_amd_gpus()
            gpus.extend(amd_gpus)
            
        except Exception as e:
            logger.warning(f"Error detecting GPUs: {e}")
        
        return gpus
    
    def _detect_nvidia_gpus(self) -> List[GPUInfo]:
        """Detect NVIDIA GPUs using nvidia-smi"""
        gpus = []
        
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total,driver_version", 
                 "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line.strip():
                        parts = [p.strip() for p in line.split(',')]
                        if len(parts) >= 3:
                            gpus.append(GPUInfo(
                                name=parts[0],
                                memory_mb=int(parts[1]),
                                driver_version=parts[2],
                                is_available=True
                            ))
            
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            pass  # nvidia-smi not available
        except Exception as e:
            logger.warning(f"Error detecting NVIDIA GPUs: {e}")
        
        return gpus
    
    def _detect_amd_gpus(self) -> List[GPUInfo]:
        """Detect AMD GPUs using rocm-smi"""
        gpus = []
        
        try:
            result = subprocess.run(
                ["rocm-smi", "--showproductname", "--showmeminfo", "vram"],
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode == 0:
                # Parse rocm-smi output (simplified)
                lines = result.stdout.strip().split('\n')
                for line in lines:
                    if "GPU" in line and ":" in line:
                        # This is a simplified parser - real implementation would be more robust
                        gpus.append(GPUInfo(
                            name="AMD GPU",
                            memory_mb=8192,  # Default assumption
                            is_available=True
                        ))
                        break
            
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            pass  # rocm-smi not available
        except Exception as e:
            logger.warning(f"Error detecting AMD GPUs: {e}")
        
        return gpus
    
    def _check_cuda_availability(self) -> bool:
        """Check if CUDA is available"""
        try:
            import torch
            return torch.cuda.is_available()
        except ImportError:
            pass
        
        try:
            result = subprocess.run(
                ["nvcc", "--version"],
                capture_output=True, text=True, timeout=5
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            pass
        
        return False
    
    def _check_rocm_availability(self) -> bool:
        """Check if ROCm is available"""
        try:
            result = subprocess.run(
                ["rocm-smi", "--version"],
                capture_output=True, text=True, timeout=5
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            pass
        
        return False
    
    def _get_available_storage_gb(self) -> float:
        """Get available storage space in GB"""
        try:
            disk_usage = psutil.disk_usage('.')
            return disk_usage.free / (1024 ** 3)
        except Exception as e:
            logger.warning(f"Could not detect available storage: {e}")
            return 10.0  # Default assumption
    
    def _calculate_performance_characteristics(self, capabilities: HardwareCapabilities):
        """Calculate performance characteristics based on hardware"""
        # Base performance score
        performance_score = 1.0
        
        # CPU contribution
        cpu_score = min(capabilities.cpu_count / 8.0, 2.0)  # Normalize to 8 cores
        performance_score *= cpu_score
        
        # Memory contribution
        memory_score = min(capabilities.available_memory_mb / 8192.0, 2.0)  # Normalize to 8GB
        performance_score *= memory_score
        
        # GPU contribution
        if capabilities.has_gpu and capabilities.cuda_available:
            performance_score *= 2.0  # GPU acceleration bonus
        
        capabilities.estimated_inference_speed = performance_score
        
        # Recommend model size based on available memory
        if capabilities.available_memory_mb < 4000:
            capabilities.recommended_model_size = "2.7B"
            capabilities.max_context_length = 2048
        elif capabilities.available_memory_mb < 6000:
            capabilities.recommended_model_size = "7B"
            capabilities.max_context_length = 4096
        elif capabilities.available_memory_mb < 12000:
            capabilities.recommended_model_size = "7B"
            capabilities.max_context_length = 8192
        else:
            capabilities.recommended_model_size = "13B"
            capabilities.max_context_length = 8192
    
    def get_optimal_model_config(self, available_models: List[str]) -> Optional[str]:
        """Get optimal model configuration for current hardware"""
        capabilities = self.get_hardware_capabilities()
        
        # Simple model selection based on available memory
        if capabilities.available_memory_mb < 4000:
            preferred_models = ["phi-2"]
        elif capabilities.available_memory_mb < 6000:
            preferred_models = ["mistral-7b-instruct", "code-llama-7b-instruct"]
        else:
            preferred_models = ["sqlcoder-7b", "mistral-7b-instruct", "code-llama-7b-instruct"]
        
        # Return first available preferred model
        for model in preferred_models:
            if model in available_models:
                return model
        
        # Fallback to first available model
        return available_models[0] if available_models else None
    
    def estimate_inference_time(self, model_size: str, context_length: int) -> float:
        """Estimate inference time for given model and context"""
        capabilities = self.get_hardware_capabilities()
        
        # Base time estimates (in seconds)
        base_times = {
            "2.7B": 2.0,
            "7B": 5.0,
            "13B": 10.0
        }
        
        base_time = base_times.get(model_size, 5.0)
        
        # Adjust for hardware performance
        adjusted_time = base_time / capabilities.estimated_inference_speed
        
        # Adjust for context length
        context_factor = min(context_length / 2048.0, 2.0)
        adjusted_time *= context_factor
        
        return adjusted_time
